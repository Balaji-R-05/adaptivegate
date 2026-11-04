/**
 * Compares BM25-only, embedding-only, and hybrid routing accuracy over a
 * synthetic tool catalog (dataset.ts) — the comparison CLAUDE.md's router
 * convention requires for every router change. Not the governance attack
 * benchmark (that's a separate, later build-order step).
 *
 * Run with: pnpm --filter @adaptivegate/benchmark run router
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bm25Route, embeddingRoute, hybridRoute, type IndexedTool } from '@adaptivegate/router';
import { pipeline } from '@huggingface/transformers';
import { QUERIES, TOOLS } from './dataset';

const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';
const TOP_K = 3;
const MODES = ['bm25', 'embedding', 'hybrid'] as const;
type Mode = (typeof MODES)[number];

async function main() {
  console.log(`Loading embedding model (${EMBEDDING_MODEL})...`);
  const extractor = await pipeline('feature-extraction', EMBEDDING_MODEL);

  async function embed(text: string): Promise<number[]> {
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data as Float32Array);
  }

  console.log(`Embedding ${TOOLS.length} tools...`);
  const indexedTools: IndexedTool[] = [];
  for (const tool of TOOLS) {
    const embedding = await embed(`${tool.name}: ${tool.description}`);
    indexedTools.push({
      name: tool.name,
      description: tool.description,
      serverId: 'benchmark',
      embedding,
    });
  }

  const scoreboard: Record<Mode, { top1: number; top3: number }> = {
    bm25: { top1: 0, top3: 0 },
    embedding: { top1: 0, top3: 0 },
    hybrid: { top1: 0, top3: 0 },
  };

  for (const { query, expected } of QUERIES) {
    const queryEmbedding = await embed(query);
    const results: Record<Mode, string[]> = {
      bm25: bm25Route(indexedTools, query, TOP_K).map((r) => r.name),
      embedding: embeddingRoute(indexedTools, queryEmbedding, TOP_K).map((r) => r.name),
      hybrid: hybridRoute(indexedTools, query, queryEmbedding, TOP_K).map((r) => r.name),
    };

    for (const mode of MODES) {
      if (results[mode][0] === expected) scoreboard[mode].top1 += 1;
      if (results[mode].includes(expected)) scoreboard[mode].top3 += 1;
    }
  }

  const total = QUERIES.length;
  const report = MODES.map((mode) => ({
    mode,
    top1Accuracy: scoreboard[mode].top1 / total,
    top3Accuracy: scoreboard[mode].top3 / total,
  }));

  console.table(
    report.map((r) => ({
      mode: r.mode,
      'top-1 accuracy': `${Math.round(r.top1Accuracy * 100)}%`,
      'top-3 accuracy': `${Math.round(r.top3Accuracy * 100)}%`,
    })),
  );

  const resultsDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'experiments');
  mkdirSync(resultsDir, { recursive: true });
  const outPath = join(
    resultsDir,
    `router-benchmark-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        config: {
          embeddingModel: EMBEDDING_MODEL,
          topK: TOP_K,
          toolCount: TOOLS.length,
          queryCount: total,
        },
        note: 'No randomness involved in this run — embedding model output is deterministic for fixed input, so there is no seed to record.',
        results: report,
      },
      null,
      2,
    ),
  );
  console.log(`Saved results to ${outPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
