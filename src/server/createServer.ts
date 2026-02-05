import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function createMcpServer(version: string): McpServer {
  return new McpServer(
    {
      name: "ebx-docs-mcp",
      version: version,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );
}
