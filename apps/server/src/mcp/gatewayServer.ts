import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { callDownstreamTool, connectDownstream, listDownstreamTools } from './downstreamClient';

// A fresh connection per call is wasteful but simple and correct — good
// enough to prove the proxy works end to end. Connection reuse/pooling is a
// later optimization once this is doing real traffic.
export function createGatewayServer(downstreamUrl: string): Server {
  const server = new Server(
    { name: 'adaptivegate-gateway', version: '0.0.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const client = await connectDownstream(downstreamUrl);
    try {
      return await listDownstreamTools(client);
    } finally {
      await client.close();
    }
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const client = await connectDownstream(downstreamUrl);
    try {
      return await callDownstreamTool(client, request.params);
    } finally {
      await client.close();
    }
  });

  return server;
}
