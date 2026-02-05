#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import { DocumentationIndexer } from "./indexer/DocumentationIndexer.js";
import * as path from "path";
import { fileURLToPath } from "url";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { randomUUID } from "crypto";

/**
 * EBX Documentation MCP Server
 * Provides tools for searching and retrieving TIBCO EBX v6.2.2 javadoc documentation
 */

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths for documentation
const javadocDir = path.join(__dirname, "..", "javadoc");
const indexPath = path.join(javadocDir, "javadoc-index.json");
const zipPath = path.join(javadocDir, "ebx-core-javadoc.zip");
const indexer = new DocumentationIndexer(indexPath, zipPath);

const server = new McpServer(
  {
    name: "ebx-docs-mcp",
    version: "6.2.2",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Register tools with McpServer
 */
server.registerTool(
  "search_ebx_class",
  {
    description: "Search for EBX classes, interfaces, or enums by name or description. Returns matching classes with brief descriptions and key methods.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Class name or description to search for",
        },
        type: {
          type: "string",
          enum: ["class", "interface", "enum", "all"],
          description: "Filter by type (default: all)",
        },
        package: {
          type: "string",
          description: "Optional package name filter (e.g., 'com.onwbp.adaptation')",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default: 10)",
        },
      },
      required: ["query"],
    } as any,
  },
  async (args: any) => {
    return await handleSearchClass(args);
  }
);

server.registerTool(
  "get_ebx_class_doc",
  {
    description: "Get complete documentation for a specific EBX class. Returns detailed markdown documentation including methods, fields, inheritance, and examples.",
    inputSchema: {
      type: "object",
      properties: {
        className: {
          type: "string",
          description: "Fully qualified class name or simple name (e.g., 'Adaptation' or 'com.onwbp.adaptation.Adaptation')",
        },
        includeInherited: {
          type: "boolean",
          description: "Include inherited methods and fields (default: false)",
        },
      },
      required: ["className"],
    } as any,
  },
  async (args: any) => {
    return await handleGetClassDoc(args);
  }
);

server.registerTool(
  "search_ebx_method",
  {
    description: "Search for methods across all EBX classes. Returns methods matching the search criteria with their signatures and containing classes.",
    inputSchema: {
      type: "object",
      properties: {
        methodName: {
          type: "string",
          description: "Method name to search for",
        },
        className: {
          type: "string",
          description: "Optional class name filter",
        },
        returnType: {
          type: "string",
          description: "Optional return type filter",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default: 10)",
        },
      },
      required: ["methodName"],
    } as any,
  },
  async (args: any) => {
    return await handleSearchMethod(args);
  }
);

server.registerTool(
  "find_ebx_package",
  {
    description: "Find EBX packages by task or domain (e.g., 'data access', 'UI forms', 'validation'). Returns relevant packages with key classes and common use cases.",
    inputSchema: {
      type: "object",
      properties: {
        task: {
          type: "string",
          description: "Task or domain description (e.g., 'data access', 'UI forms', 'validation', 'triggers')",
        },
      },
      required: ["task"],
    } as any,
  },
  async (args: any) => {
    return await handleFindPackage(args);
  }
);

/**
 * Tool handlers
 */
async function handleSearchClass(args: any) {
  const { query, type = 'all', package: pkg, limit = 10 } = args;

  if (!query) {
    throw new McpError(ErrorCode.InvalidParams, "query parameter is required");
  }

  const results = indexer.searchClasses(query, {
    type: type === 'all' ? undefined : type,
    package: pkg,
    limit,
  });

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          results: results.map(r => ({
            name: r.name,
            fullyQualifiedName: r.fullyQualifiedName,
            type: r.type,
            package: r.package,
            description: r.description,
            keyMethods: r.keyMethods,
            relevanceScore: r.relevanceScore,
          })),
          query,
          count: results.length,
        }, null, 2),
      },
    ],
  };
}

async function handleGetClassDoc(args: any) {
  const { className, includeInherited = false } = args;

  if (!className) {
    throw new McpError(ErrorCode.InvalidParams, "className parameter is required");
  }

  const doc = await indexer.getClassDoc(className, { includeInherited });

  if (!doc) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Class not found: ${className}`
    );
  }

  // Format as markdown
  let markdown = `# ${doc.simpleName}\n\n`;
  markdown += `**Package:** ${doc.package}\n`;
  markdown += `**Type:** ${doc.type}\n`;

  if (doc.extends && doc.extends.length > 0) {
    markdown += `**Extends:** ${doc.extends.join(', ')}\n`;
  }

  if (doc.implements && doc.implements.length > 0) {
    markdown += `**Implements:** ${doc.implements.join(', ')}\n`;
  }

  if (doc.deprecated) {
    markdown += `\n**⚠️ DEPRECATED**\n`;
  }

  if (doc.description) {
    markdown += `\n## Description\n\n${doc.description}\n`;
  }

  if (doc.fields && doc.fields.length > 0) {
    markdown += `\n## Fields\n\n`;
    for (const field of doc.fields) {
      markdown += `### ${field.name}: ${field.type}\n`;
      if (field.description) {
        markdown += `${field.description}\n`;
      }
      if (field.modifiers && field.modifiers.length > 0) {
        markdown += `*Modifiers:* ${field.modifiers.join(', ')}\n`;
      }
      markdown += '\n';
    }
  }

  if (doc.methods && doc.methods.length > 0) {
    markdown += `\n## Methods\n\n`;
    for (const method of doc.methods) {
      markdown += `### ${method.signature}\n`;
      if (method.description) {
        markdown += `${method.description}\n\n`;
      }
      if (method.returnType) {
        markdown += `**Returns:** ${method.returnType}\n\n`;
      }
      if (method.deprecated) {
        markdown += `**⚠️ DEPRECATED**\n\n`;
      }
    }
  }

  if (doc.seeAlso && doc.seeAlso.length > 0) {
    markdown += `\n## See Also\n\n`;
    for (const ref of doc.seeAlso) {
      markdown += `- ${ref}\n`;
    }
  }

  return {
    content: [
      {
        type: "text" as const,
        text: markdown,
      },
    ],
  };
}

async function handleSearchMethod(args: any) {
  const { methodName, className, returnType, limit = 10 } = args;

  if (!methodName) {
    throw new McpError(ErrorCode.InvalidParams, "methodName parameter is required");
  }

  const results = indexer.searchMethods(methodName, {
    className,
    returnType,
    limit,
  });

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          results: results.map(r => ({
            method: r.method,
            signature: r.signature,
            className: r.className,
            packageName: r.packageName,
            returnType: r.returnType,
            description: r.description,
            relevanceScore: r.relevanceScore,
          })),
          methodName,
          count: results.length,
        }, null, 2),
      },
    ],
  };
}

async function handleFindPackage(args: any) {
  const { task } = args;

  if (!task) {
    throw new McpError(ErrorCode.InvalidParams, "task parameter is required");
  }

  const results = indexer.findPackagesByTask(task);

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          relevantPackages: results.map(r => ({
            name: r.name,
            description: r.description,
            keyClasses: r.keyClasses,
            relevanceScore: r.relevanceScore,
          })),
          task,
          count: results.length,
        }, null, 2),
      },
    ],
  };
}

/**
 * Start the server
 */
async function main() {
  // Initialize the documentation indexer
  console.error("Loading EBX documentation index...");
  await indexer.initialize();
  console.error("Index loaded successfully");

  // Check if HTTP mode is requested
  const useHttp = process.argv.includes('--http') || process.env.MCP_TRANSPORT === 'http';

  if (!useHttp) {
    // Default: stdio mode (for MCP Inspector and Claude Desktop)
    console.error("Starting in stdio mode...");
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("EBX Documentation MCP Server running on stdio");
    return;
  }

  // HTTP/Streamable mode
  console.log("Starting in HTTP mode with Streamable transport...");
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8000;

  // Create single transport instance
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  // Connect server to transport
  await server.connect(transport);

  // Create HTTP server
  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
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
      const version = indexer.getVersion() || 'unknown';
      res.end(JSON.stringify({ status: 'ok', version, transport: 'streamable-http' }));
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

  httpServer.listen(PORT, () => {
    console.log(`EBX Documentation MCP Server running on http://localhost:${PORT}`);
    console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Transport: Streamable HTTP`);
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
