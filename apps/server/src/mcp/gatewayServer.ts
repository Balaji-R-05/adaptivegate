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
import { createEventRecorder } from '../governance/auditLog';
import { checkBudget } from '../governance/budgets';
import { evaluateCallToolPolicy } from '../governance/policyEngine';
import { callDownstreamTool } from './downstreamClient';
import { evictConnection, getPooledConnection } from './downstreamPool';

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
// logs must be redacted, but the agent still gets the real, unredacted
// result back.
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

// check_policy mirrors call_tool's identifying pair, but never its
// `arguments` — the checks below (kill switch, scope, budget, policy) never
// look at call arguments, only the (tool, serverId) identity and the
// account's governance config, same as call_tool's own gating does before
// it ever reaches the downstream call.
const checkPolicyInput = z.object({
  name: z.string().min(1),
  serverId: z.string().min(1),
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
      {
        name: 'check_policy',
        description:
          'Check whether call_tool would currently allow, deny, or require approval for a tool, without actually calling it or spending any budget. Use this before a call you suspect might be blocked, to avoid wasting a real downstream round trip.',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            serverId: { type: 'string' },
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

    if (request.params.name === 'check_policy') {
      const input = checkPolicyInput.parse(request.params.arguments);

      // Deliberately a standalone read-only path, not a call into
      // call_tool's own blocking logic below — that logic also records
      // audit events and consumes a matching pending approval as a side
      // effect, neither of which belongs in a dry-run check. Mirrors
      // call_tool's gate order (kill switch, then scope, then budget, then
      // policy) without any of its side effects; keep the two in sync if
      // that order ever changes.
      if (identity && !identity.enabled) {
        return {
          content: [
            { type: 'text', text: JSON.stringify({ action: 'deny', reason: 'identity_disabled' }) },
          ],
        };
      }

      if (identity?.serverScope && !identity.serverScope.includes(input.serverId)) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ action: 'deny', reason: 'out_of_scope' }) }],
        };
      }

      const [budget, verdict] = await Promise.all([
        identity ? checkBudget(userId, identity.id, identity.budgetLimit) : null,
        evaluateCallToolPolicy(userId, input.name, identity?.policyId),
      ]);

      if (budget && !budget.allowed) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ action: 'deny', reason: 'budget_exceeded', remaining: budget.remaining }),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              action: verdict.action,
              reason: 'reason' in verdict ? verdict.reason : undefined,
            }),
          },
        ],
      };
    }

    if (request.params.name === 'call_tool') {
      const input = callToolInput.parse(request.params.arguments);
      const identityId = identity?.id ?? null;
      const recorder = createEventRecorder(userId);

      async function blockToolCall(payload: Record<string, unknown>): Promise<never> {
        await recorder.record('tool_call', {
          tool: input.name,
          serverId: input.serverId,
          identityId,
          blocked: true,
          ...payload,
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

      // The three DB reads below are independent of each other, so they run
      // concurrently instead of one-after-another — each round trip to this
      // project's remote-hosted Postgres measured 500-600ms on its own, and
      // this was the dominant cost in call_tool's latency (see
      // docs/evaluation.md), not the downstream connection. findToolServer's
      // result goes unused on the (rarer) deny/require_approval path below —
      // a deliberate trade-off: a little wasted DB work there, in exchange
      // for not adding a 4th sequential round trip on the allow path.
      const [budget, verdict, target] = await Promise.all([
        identity ? checkBudget(userId, identity.id, identity.budgetLimit) : null,
        evaluateCallToolPolicy(userId, input.name, identity?.policyId),
        findToolServer(userId, input.serverId, input.name),
      ]);

      if (budget && !budget.allowed) {
        await blockToolCall({
          reason: 'budget_exceeded',
          message: `denied: budget exceeded for this identity (limit ${String(identity?.budgetLimit)}/day)`,
        });
      }

      await recorder.record('policy_decision', {
        tool: input.name,
        serverId: input.serverId,
        identityId,
        verdict,
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

      if (!target) {
        throw new Error(
          `no tool named "${input.name}" on server "${input.serverId}" — call search_tools first`,
        );
      }

      const { result, attempts, recovered } = await retryPolicy(
        async () => {
          const client = await getPooledConnection(input.serverId, target.url, target.auth);
          try {
            return await callDownstreamTool(client, {
              name: input.name,
              arguments: input.arguments,
            });
          } catch (error) {
            // Broken connection — don't let retryPolicy's next attempt reuse it.
            await evictConnection(input.serverId, target.url, target.auth);
            throw error;
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
      await recorder.record('tool_call', {
        tool: input.name,
        serverId: input.serverId,
        identityId,
        blocked: false,
        attempts,
        recovered,
        redactedFields: [...argsRedaction.found, ...outputRedaction.found],
      });

      if (recovered) {
        await recorder.record('recovery_attempt', {
          tool: input.name,
          serverId: input.serverId,
          identityId,
          attempts,
        });
      }

      return result;
    }

    throw new Error(
      `unknown tool "${request.params.name}" — only search_tools, call_tool and check_policy are available`,
    );
  });

  return server;
}
