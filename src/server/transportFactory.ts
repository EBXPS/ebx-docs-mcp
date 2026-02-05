import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "crypto";

export type TransportType = 'stdio' | 'http';

export function getTransportType(): TransportType {
  const useHttp = process.argv.includes('--http') ||
                  process.env.MCP_TRANSPORT === 'http';
  return useHttp ? 'http' : 'stdio';
}

export function createStdioTransport(): StdioServerTransport {
  return new StdioServerTransport();
}

export function createHttpTransport(): StreamableHTTPServerTransport {
  return new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });
}
