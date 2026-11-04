import { db, toolEmbeddings } from '@adaptivegate/db';
import { hasToolDefinitionChanged } from '@adaptivegate/governance';
import type { ServerAuth } from '@adaptivegate/shared';
import { and, eq } from 'drizzle-orm';
import { embedText, EMBEDDING_MODEL } from '../embeddings/embed';
import { recordEvent } from '../governance/auditLog';
import { connectDownstream, listDownstreamTools } from '../mcp/downstreamClient';

interface ServerRef {
  id: string;
  userId: string;
  url: string;
  auth: ServerAuth;
}

// Connects to one downstream server, embeds each of its tools, and
// upserts them into tool_embeddings. Triggered right after a server is
// created (src/api/servers.ts) and via the manual resync endpoint.
export async function syncToolsForServer(server: ServerRef): Promise<number> {
  const client = await connectDownstream(server.url, server.auth);
  let tools: Awaited<ReturnType<typeof listDownstreamTools>>['tools'];
  try {
    ({ tools } = await listDownstreamTools(client));
  } finally {
    await client.close();
  }

  for (const tool of tools) {
    const description = tool.description ?? '';
    const embedding = await embedText(`${tool.name}: ${description}`);

    const [existing] = await db
      .select({ description: toolEmbeddings.description, inputSchema: toolEmbeddings.inputSchema })
      .from(toolEmbeddings)
      .where(and(eq(toolEmbeddings.serverId, server.id), eq(toolEmbeddings.toolName, tool.name)))
      .limit(1);

    if (
      existing &&
      hasToolDefinitionChanged(
        { description: existing.description, inputSchema: existing.inputSchema },
        { description, inputSchema: tool.inputSchema },
      )
    ) {
      await recordEvent({
        userId: server.userId,
        type: 'policy_decision',
        payload: {
          kind: 'tool_definition_changed',
          tool: tool.name,
          serverId: server.id,
        },
      });
    }

    await db
      .insert(toolEmbeddings)
      .values({
        serverId: server.id,
        userId: server.userId,
        toolName: tool.name,
        description,
        inputSchema: tool.inputSchema,
        embedding,
        embeddingModel: EMBEDDING_MODEL,
      })
      .onConflictDoUpdate({
        target: [toolEmbeddings.serverId, toolEmbeddings.toolName],
        set: {
          description,
          inputSchema: tool.inputSchema,
          embedding,
          embeddingModel: EMBEDDING_MODEL,
          updatedAt: new Date(),
        },
      });
  }

  return tools.length;
}
