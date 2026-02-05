import { createServer, IncomingMessage, ServerResponse } from "http";
import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

export function createHttpServer(
  transport: StreamableHTTPServerTransport,
  version: string
) {
  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Mcp-Session-Id');

    // Handle OPTIONS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Health check endpoint
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        version,
        transport: 'streamable-http'
      }));
      return;
    }

    // Unified MCP endpoint
    if (req.url === '/mcp') {
      try {
        console.log(`${req.method} request to /mcp`);

        // Read request body for POST requests
        let body: any = undefined;
        if (req.method === 'POST') {
          body = await new Promise((resolve, reject) => {
            let data = '';
            req.on('data', (chunk) => {
              data += chunk.toString();
            });
            req.on('end', () => {
              try {
                resolve(JSON.parse(data));
              } catch (e) {
                resolve(data);
              }
            });
            req.on('error', reject);
          });
        }

        // Handle the request through the transport
        await transport.handleRequest(req, res, body);
      } catch (error) {
        console.error('Error handling MCP request:', error);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : String(error)
          }));
        }
      }
      return;
    }

    // Default 404 response
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });
}
