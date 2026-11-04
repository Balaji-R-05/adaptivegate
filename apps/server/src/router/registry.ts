import { db, toolEmbeddings } from '@adaptivegate/db';
import { embedText, EMBEDDING_MODEL } from '../embeddings/embed';
import { connectDownstream, listDownstreamTools } from '../mcp/downstreamClient';

interface ServerRef {
  id: string;
  userId: string;
  url: string;
}

// Connects to one downstream server, embeds each of its tools, and
// upserts them into tool_embeddings. Triggered right after a server is
// created (src/api/servers.ts) and via the manual resync endpoint.
export async function syncToolsForServer(server: ServerRef): Promise<number> {
  const client = await connectDownstream(server.url);
  let tools: Awaited<ReturnType<typeof listDownstreamTools>>['tools'];
  try {
    ({ tools } = await listDownstreamTools(client));
  } finally {
    await client.close();
  }

  for (const tool of tools) {
    const description = tool.description ?? '';
    const embedding = await embedText(`${tool.name}: ${description}`);

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
