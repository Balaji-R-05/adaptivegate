/**
 * Measures the gateway against whatever real servers a user has actually
 * connected — token footprint, search_tools latency/relevance, and
 * call_tool latency. Unlike benchmark/router/run.ts (a synthetic, curated
 * catalog), this runs against real, messy, multi-vendor data, which is what
 * actually surfaced the serverId bug fixed in commit b2b4cb1.
 *
 * Usage: pnpm --filter @adaptivegate/server run evaluate:live-catalog -- <email>
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { db, toolEmbeddings, users } from '@adaptivegate/db';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { createGatewayServer } from '../src/mcp/gatewayServer';

// A representative spread of real queries against whatever's actually
// connected when this was last run (see docs/evaluation.md) — not meant to
// be exhaustive, just varied enough to stress cross-server disambiguation.
// `expectRelevant` is this script author's own judgment call, not a
// rigorously labeled ground truth.
const QUERIES: Array<{ query: string; expectRelevant: string[] }> = [
  { query: 'generate a QR code for a URL', expectRelevant: ['generate_qr'] },
  {
    query: 'what are the trading hours for the NYSE today',
    expectRelevant: ['get_trading_sessions', 'markets_open_now', 'is_market_open'],
  },
  {
    query: 'find SEC filings and insider trades for a public company',
    expectRelevant: ['insider_transactions', 'recent_filings', 'company_lookup'],
  },
  {
    query: 'search Azure documentation for Azure Functions',
    expectRelevant: ['microsoft_docs_search', 'microsoft_code_sample_search'],
  },
  {
    query: 'create a flowchart diagram',
    expectRelevant: ['create_diagram', 'get_drawio_reference', 'search_shapes'],
  },
  {
    query: 'ask a question about a GitHub repository codebase',
    expectRelevant: ['ask_wiki_question'],
  },
  { query: 'look up the geolocation of an IP address', expectRelevant: ['get_location', 'get_ip'] },
  {
    query: 'calculate a child growth percentile',
    expectRelevant: ['growth_percentile', 'bmi_percentile'],
  },
  {
    query: 'get UN agricultural production statistics',
    expectRelevant: ['faostat_commodity_profile', 'faostat_resolve_codes', 'faostat_list_domains'],
  },
  {
    query: 'render and extract content from a web page',
    expectRelevant: ['extract_content', 'render_page'],
  },
  {
    query: 'find up-to-date documentation for a JavaScript library',
    expectRelevant: ['resolve-library-id', 'query-docs'],
  },
  {
    query: 'search the web for recent news on a topic',
    expectRelevant: ['web_search_exa', 'firecrawl_search'],
  },
  {
    query: 'fetch the contents of a specific URL',
    expectRelevant: ['web_fetch_exa', 'firecrawl_scrape'],
  },
  {
    query: 'find federal register documents published by an agency',
    expectRelevant: ['search_documents', 'list_agencies'],
  },
  {
    query: 'look up open public comment periods on new regulations',
    expectRelevant: ['open_comment_periods'],
  },
  {
    query: 'get details for a specific federal register document number',
    expectRelevant: ['get_document', 'get_documents_batch'],
  },
];

// A representative sample of real call_tool round trips, spanning distinct
// downstream servers — measures end-to-end latency and real output size
// (governance checks included), not just search_tools' routing step.
// serverId is resolved from `rows` at runtime (see main()), not hardcoded,
// since it's a real per-account DB id.
const CALL_TOOL_SAMPLES: Array<{ tool: string; arguments: Record<string, unknown> }> = [
  { tool: 'microsoft_docs_search', arguments: { query: 'what is drizzle orm' } },
  { tool: 'resolve-library-id', arguments: { query: 'hooks', libraryName: 'React' } },
  {
    tool: 'web_search_exa',
    arguments: { query: 'latest AI agent news', objective: 'find recent news about AI agents' },
  },
  { tool: 'list_agencies', arguments: { query: 'commerce' } },
  { tool: 'search_documents', arguments: { term: 'artificial intelligence', per_page: 5 } },
];

// Rough proxy (chars/4), not a real tokenizer — good for an
// order-of-magnitude comparison, not precise token accounting.
function approxTokens(text: string): number {
  return Math.round(text.length / 4);
}

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error('usage: evaluateLiveCatalog.ts <email>');

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) throw new Error(`no user for ${email}`);

  const rows = await db
    .select({
      name: toolEmbeddings.toolName,
      description: toolEmbeddings.description,
      inputSchema: toolEmbeddings.inputSchema,
      serverId: toolEmbeddings.serverId,
    })
    .from(toolEmbeddings)
    .where(eq(toolEmbeddings.userId, user.id));

  const allToolsJson = JSON.stringify(
    rows.map((r) => ({ name: r.name, description: r.description, inputSchema: r.inputSchema })),
  );
  const metaToolsJson = JSON.stringify([
    { name: 'search_tools', description: '...', inputSchema: { type: 'object' } },
    { name: 'call_tool', description: '...', inputSchema: { type: 'object' } },
  ]);
  const allToolsTokens = approxTokens(allToolsJson);
  const metaToolsTokens = approxTokens(metaToolsJson);

  const app = new Hono();
  app.all('/mcp', async (c) => {
    const transport = new WebStandardStreamableHTTPServerTransport();
    const gateway = createGatewayServer(user.id);
    await gateway.connect(transport);
    return transport.handleRequest(c.req.raw);
  });
  const port = await new Promise<number>((resolve) => {
    serve({ fetch: app.fetch, port: 0 }, (info) => resolve(info.port));
  });
  const client = new Client({ name: 'evaluate-live-catalog', version: '0.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://localhost:${port}/mcp`)));

  const searchResults: Array<{
    query: string;
    top1: string | undefined;
    correct: boolean;
    latencyMs: number;
  }> = [];

  for (const { query, expectRelevant } of QUERIES) {
    const start = performance.now();
    const result = await client.callTool({ name: 'search_tools', arguments: { query, topK: 3 } });
    const latencyMs = performance.now() - start;

    const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? '[]';
    const matches = JSON.parse(text) as Array<{ name: string }>;
    const top1 = matches[0]?.name;
    searchResults.push({
      query,
      top1,
      correct: top1 ? expectRelevant.includes(top1) : false,
      latencyMs,
    });
  }

  const toolToServerId = new Map(rows.map((r) => [r.name, r.serverId]));

  const callResults: Array<{
    tool: string;
    serverId: string | undefined;
    ok: boolean;
    latencyMs: number;
    outputTokens: number | undefined;
    error: string | undefined;
  }> = [];

  for (const sample of CALL_TOOL_SAMPLES) {
    const serverId = toolToServerId.get(sample.tool);
    if (!serverId) {
      callResults.push({
        tool: sample.tool,
        serverId: undefined,
        ok: false,
        latencyMs: 0,
        outputTokens: undefined,
        error: 'tool not indexed for this account — skipped',
      });
      continue;
    }

    const start = performance.now();
    try {
      const result = await client.callTool({
        name: 'call_tool',
        arguments: { name: sample.tool, serverId, arguments: sample.arguments },
      });
      const latencyMs = performance.now() - start;
      const text = JSON.stringify(result.content);
      callResults.push({
        tool: sample.tool,
        serverId,
        ok: !result.isError,
        latencyMs,
        outputTokens: approxTokens(text),
        error: result.isError ? text.slice(0, 200) : undefined,
      });
    } catch (error) {
      callResults.push({
        tool: sample.tool,
        serverId,
        ok: false,
        latencyMs: performance.now() - start,
        outputTokens: undefined,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await client.close();

  const latencies = searchResults.map((r) => r.latencyMs);
  const top1Correct = searchResults.filter((r) => r.correct).length;
  const callLatencies = callResults.filter((r) => r.ok).map((r) => r.latencyMs);

  const report = {
    runAt: new Date().toISOString(),
    catalog: { serverCount: new Set(rows.map((r) => r.serverId)).size, toolCount: rows.length },
    tokenFootprint: {
      allToolsExposedDirectly: allToolsTokens,
      metaToolsOnly: metaToolsTokens,
      reductionPercent: Number((100 * (1 - metaToolsTokens / allToolsTokens)).toFixed(1)),
      method: 'approximate: chars/4, not a real tokenizer',
    },
    searchToolsRouting: {
      top1CorrectCount: top1Correct,
      totalQueries: QUERIES.length,
      note: "expectRelevant is this script's own relevance judgment, not a labeled ground-truth dataset",
      perQuery: searchResults,
    },
    searchToolsLatencyMs: {
      avg: Number((latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(0)),
      min: Number(Math.min(...latencies).toFixed(0)),
      max: Number(Math.max(...latencies).toFixed(0)),
      note: 'local CPU embedding model (Xenova/all-MiniLM-L6-v2), no GPU, no caching between calls',
    },
    callTool: {
      note: 'real end-to-end call_tool round trips through this account\'s real downstream servers, with governance (policy, budget, redaction, injection scan) in the path',
      successCount: callResults.filter((r) => r.ok).length,
      totalSamples: CALL_TOOL_SAMPLES.length,
      latencyMs:
        callLatencies.length > 0
          ? {
              avg: Number((callLatencies.reduce((a, b) => a + b, 0) / callLatencies.length).toFixed(0)),
              min: Number(Math.min(...callLatencies).toFixed(0)),
              max: Number(Math.max(...callLatencies).toFixed(0)),
            }
          : null,
      perCall: callResults,
    },
  };

  console.table(
    searchResults.map((r) => ({
      query: r.query,
      top1: r.top1,
      correct: r.correct,
      latencyMs: r.latencyMs.toFixed(0),
    })),
  );
  console.log(`\ntoken reduction: ${report.tokenFootprint.reductionPercent}%`);
  console.log(`top-1 correct: ${top1Correct}/${QUERIES.length}`);

  console.log('\n=== call_tool (real downstream round trips) ===');
  console.table(
    callResults.map((r) => ({
      tool: r.tool,
      ok: r.ok,
      latencyMs: r.latencyMs.toFixed(0),
      outputTokens: r.outputTokens ?? '-',
      error: r.error ?? '',
    })),
  );

  const resultsDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'experiments');
  mkdirSync(resultsDir, { recursive: true });
  const outPath = join(
    resultsDir,
    `live-catalog-evaluation-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nSaved results to ${outPath}`);

  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
