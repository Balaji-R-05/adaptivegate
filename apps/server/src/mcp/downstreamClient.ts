import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';

// Wraps one downstream MCP server behind a plain connect/listTools/callTool
// surface. gatewayServer.ts decides which server to connect to for a given
// tool, using the hybrid router's registry (packages/core/router).
export async function connectDownstream(url: string): Promise<Client> {
  const client = new Client({ name: 'adaptivegate-gateway', version: '0.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(url));
  await client.connect(transport);
  return client;
}

export async function listDownstreamTools(client: Client) {
  return client.listTools();
}

export async function callDownstreamTool(client: Client, params: CallToolRequest['params']) {
  return client.callTool(params);
}
