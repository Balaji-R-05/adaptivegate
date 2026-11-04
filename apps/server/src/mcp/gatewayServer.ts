import { db, servers, toolEmbeddings } from '@adaptivegate/db';
import { hybridRoute, type IndexedTool } from '@adaptivegate/router';
import type { ServerAuth } from '@adaptivegate/shared';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { embedText } from '../embeddings/embed';
import { callDownstreamTool, connectDownstream } from './downstreamClient';

const DEFAULT_TOP_K = 5;

const searchToolsInput = z.object({
  query: z.string().min(1),
  topK: z.number().int().positive().max(20).optional(),
});

const callToolInput = z.object({
  name: z.string().min(1),
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

async function findToolServer(userId: string, toolName: string): Promise<ToolServer | null> {
  const [row] = await db
    .select({ url: servers.url, auth: servers.auth })
    .from(toolEmbeddings)
    .innerJoin(servers, eq(toolEmbeddings.serverId, servers.id))
    .where(and(eq(toolEmbeddings.userId, userId), eq(toolEmbeddings.toolName, toolName)))
    .limit(1);

  return row ?? null;
}

// The gateway always exposes exactly these two meta-tools, instead of
// proxying every downstream tool directly — MCP's tools/list has no query
// parameter, so there's no task description to route against at list time.
// search_tools runs the hybrid router (packages/core/router) over the
// user's indexed tools across *all* their servers; call_tool forwards to
// whichever real downstream server owns the named tool.
export function createGatewayServer(userId: string): Server {
  const server = new Server(
    { name: 'adaptivegate-gateway', version: '0.0.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'search_tools',
        description:
          'Search the tools available across your connected MCP servers. Call this first with a short natural-language description of what you need, then call call_tool with the matching tool name.',
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
        description: 'Call a real tool found via search_tools, by its exact name.',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            arguments: { type: 'object' },
          },
          required: ['name'],
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

      const byName = new Map(tools.map((tool) => [tool.name, tool]));
      const results = ranked.map((match) => {
        const tool = byName.get(match.name);
        return { name: match.name, description: tool?.description, inputSchema: tool?.inputSchema };
      });

      return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
    }

    if (request.params.name === 'call_tool') {
      const input = callToolInput.parse(request.params.arguments);
      const target = await findToolServer(userId, input.name);
      if (!target) {
        throw new Error(`no tool named "${input.name}" found — call search_tools first`);
      }

      const client = await connectDownstream(target.url, target.auth);
      try {
        return await callDownstreamTool(client, { name: input.name, arguments: input.arguments });
      } finally {
        await client.close();
      }
    }

    throw new Error(
      `unknown tool "${request.params.name}" — only search_tools and call_tool are available`,
    );
  });

  return server;
}
