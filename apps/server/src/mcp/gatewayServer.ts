import { db, servers, toolEmbeddings } from '@adaptivegate/db';
import { redactSecrets, scanForInjection } from '@adaptivegate/governance';
import { retryPolicy } from '@adaptivegate/recovery';
import { hybridRoute, type IndexedTool } from '@adaptivegate/router';
import type { ServerAuth } from '@adaptivegate/shared';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { VerifiedIdentity } from '../auth/apiKey';
import { embedText } from '../embeddings/embed';
import { findOrCreatePendingApproval, findUnconsumedApproval } from '../governance/approvals';
import { recordEvent } from '../governance/auditLog';
import { checkBudget } from '../governance/budgets';
import { evaluateCallToolPolicy } from '../governance/policyEngine';
import { callDownstreamTool, connectDownstream } from './downstreamClient';

// Pulls every text block out of a tool call's input/output so guards (redaction,
// injection scanning) can inspect it as one string without caring about shape.
function extractText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(extractText).join(' ');
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).map(extractText).join(' ');
  }
  return '';
}

// Redacts secrets/PII from a value before it's written to the audit log —
// CLAUDE.md requires logs to be redacted, but the agent still gets the real,
// unredacted result back.
function redactForLog(value: unknown): { found: string[] } {
  const { found } = redactSecrets(extractText(value));
  return { found };
}

const DEFAULT_TOP_K = 5;

const searchToolsInput = z.object({
  query: z.string().min(1),
  topK: z.number().int().positive().max(20).optional(),
});

// Tool names aren't unique across a user's different servers (two downstream
// servers can genuinely both expose a tool called the same thing — seen for
// real: two independent servers both had a `generate_qr`), so call_tool must
// take the exact (serverId, name) pair search_tools returned, not name alone.
const callToolInput = z.object({
  name: z.string().min(1),
  serverId: z.string().min(1),
  arguments: z.record(z.string(), z.unknown()).optional(),
});

interface UserTool extends IndexedTool {
  inputSchema: unknown;
}

async function loadUserTools(userId: string): Promise<UserTool[]> {
  return db
    .select({
      name: toolEmbeddings.toolName,
      description: toolEmbeddings.description,
      serverId: toolEmbeddings.serverId,
      embedding: toolEmbeddings.embedding,
      inputSchema: toolEmbeddings.inputSchema,
    })
    .from(toolEmbeddings)
    .where(eq(toolEmbeddings.userId, userId));
}

interface ToolServer {
  url: string;
  auth: ServerAuth;
}

async function findToolServer(
  userId: string,
  serverId: string,
  toolName: string,
): Promise<ToolServer | null> {
  const [row] = await db
    .select({ url: servers.url, auth: servers.auth })
    .from(toolEmbeddings)
    .innerJoin(servers, eq(toolEmbeddings.serverId, servers.id))
    .where(
      and(
        eq(toolEmbeddings.userId, userId),
        eq(toolEmbeddings.serverId, serverId),
        eq(toolEmbeddings.toolName, toolName),
      ),
    )
    .limit(1);

  return row ?? null;
}

// The gateway always exposes exactly these two meta-tools, instead of
// proxying every downstream tool directly — MCP's tools/list has no query
// parameter, so there's no task description to route against at list time.
// search_tools runs the hybrid router (packages/core/router) over the
// user's indexed tools across *all* their servers; call_tool forwards to
// whichever real downstream server owns the named tool.
export function createGatewayServer(userId: string, identity?: VerifiedIdentity): Server {
  const server = new Server(
    { name: 'adaptivegate-gateway', version: '0.0.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'search_tools',
        description:
          'Search the tools available across your connected MCP servers. Call this first with a short natural-language description of what you need, then call call_tool with the matching name and serverId exactly as returned here.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'What you need to do' },
            topK: { type: 'number', description: 'Max results (default 5)' },
          },
          required: ['query'],
        },
      },
      {
        name: 'call_tool',
        description:
          'Call a real tool found via search_tools. name alone is not enough to identify it — two different servers can expose tools with the same name — so pass the exact name and serverId search_tools returned together.',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            serverId: { type: 'string' },
            arguments: { type: 'object' },
          },
          required: ['name', 'serverId'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === 'search_tools') {
      const input = searchToolsInput.parse(request.params.arguments);
      const tools = await loadUserTools(userId);
      const queryEmbedding = await embedText(input.query);
      const ranked = hybridRoute(tools, input.query, queryEmbedding, input.topK ?? DEFAULT_TOP_K);

      // Keyed by (serverId, name) — matches the router's own identity, so a
      // shared tool name across servers resolves to the right description.
      const byKey = new Map(tools.map((tool) => [`${tool.serverId}:${tool.name}`, tool]));
      const results = ranked.map((match) => {
        const tool = byKey.get(`${match.serverId}:${match.name}`);
        return {
          name: match.name,
          serverId: match.serverId,
          description: tool?.description,
          inputSchema: tool?.inputSchema,
        };
      });

      return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
    }

    if (request.params.name === 'call_tool') {
      const input = callToolInput.parse(request.params.arguments);
      const identityId = identity?.id ?? null;

      async function blockToolCall(payload: Record<string, unknown>): Promise<never> {
        await recordEvent({
          userId,
          type: 'tool_call',
          payload: { tool: input.name, serverId: input.serverId, identityId, blocked: true, ...payload },
        });
        throw new Error(payload.message as string);
      }

      // Kill switch: denies every call for this identity immediately,
      // before scope, budget or policy are even checked.
      if (identity && !identity.enabled) {
        await blockToolCall({ reason: 'identity_disabled', message: 'denied: identity disabled' });
      }

      // Scope: null serverScope means "every connected server is in scope".
      if (identity?.serverScope && !identity.serverScope.includes(input.serverId)) {
        await blockToolCall({
          reason: 'out_of_scope',
          message: `denied: server "${input.serverId}" is outside this identity's scope`,
        });
      }

      if (identity) {
        const budget = await checkBudget(userId, identity.id, identity.budgetLimit);
        if (!budget.allowed) {
          await blockToolCall({
            reason: 'budget_exceeded',
            message: `denied: budget exceeded for this identity (limit ${String(identity.budgetLimit)}/day)`,
          });
        }
      }

      const verdict = await evaluateCallToolPolicy(userId, input.name, identity?.policyId);
      await recordEvent({
        userId,
        type: 'policy_decision',
        payload: { tool: input.name, serverId: input.serverId, identityId, verdict },
      });

      if (verdict.action === 'require_approval') {
        const approvalKey = { userId, identityId, tool: input.name, serverId: input.serverId };
        const unblocked = await findUnconsumedApproval(approvalKey);
        if (!unblocked) {
          await findOrCreatePendingApproval(
            approvalKey,
            input.arguments as Record<string, unknown> | undefined,
            verdict.ruleName,
          );
          await blockToolCall({
            reason: 'pending_approval',
            verdict,
            message: `blocked (requires approval — check the dashboard's Approvals page): ${verdict.reason}`,
          });
        }
        // else: an operator already approved a matching request — fall
        // through and let this call proceed, same as an "allow" verdict.
      } else if (verdict.action !== 'allow') {
        await blockToolCall({ reason: 'policy_denied', verdict, message: `denied by policy: ${verdict.reason}` });
      }

      const target = await findToolServer(userId, input.serverId, input.name);
      if (!target) {
        throw new Error(
          `no tool named "${input.name}" on server "${input.serverId}" — call search_tools first`,
        );
      }

      const { result, attempts, recovered } = await retryPolicy(
        async () => {
          const client = await connectDownstream(target.url, target.auth);
          try {
            return await callDownstreamTool(client, {
              name: input.name,
              arguments: input.arguments,
            });
          } finally {
            await client.close();
          }
        },
        { maxAttempts: 3, baseDelayMs: 200 },
      ).run();

      const injection = scanForInjection(extractText((result as CallToolResult).content));
      if (injection.flagged) {
        await blockToolCall({ reason: 'injection_scan', matches: injection.matches, message: `blocked: downstream output flagged by injection scan (${input.name})` });
      }

      const argsRedaction = redactForLog(input.arguments);
      const outputRedaction = redactForLog((result as CallToolResult).content);
      await recordEvent({
        userId,
        type: 'tool_call',
        payload: {
          tool: input.name,
          serverId: input.serverId,
          identityId,
          blocked: false,
          attempts,
          recovered,
          redactedFields: [...argsRedaction.found, ...outputRedaction.found],
        },
      });

      if (recovered) {
        await recordEvent({
          userId,
          type: 'recovery_attempt',
          payload: { tool: input.name, serverId: input.serverId, identityId, attempts },
        });
      }

      return result;
    }

    throw new Error(
      `unknown tool "${request.params.name}" — only search_tools and call_tool are available`,
    );
  });

  return server;
}
