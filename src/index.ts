#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";

/**
 * EBX Documentation MCP Server
 * Provides tools for searching and retrieving TIBCO EBX v6.2.2 javadoc documentation
 */

const server = new Server(
  {
    name: "ebx-docs-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_ebx_class",
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
        },
      },
      {
        name: "get_ebx_class_doc",
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
        },
      },
      {
        name: "search_ebx_method",
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
        },
      },
      {
        name: "find_ebx_package",
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
        },
      },
    ],
  };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "search_ebx_class":
        return await handleSearchClass(args);
      case "get_ebx_class_doc":
        return await handleGetClassDoc(args);
      case "search_ebx_method":
        return await handleSearchMethod(args);
      case "find_ebx_package":
        return await handleFindPackage(args);
      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError(
      ErrorCode.InternalError,
      `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});

/**
 * Tool handlers - placeholder implementations
 */
async function handleSearchClass(args: any) {
  // TODO: Implement with SearchEngine
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          message: "search_ebx_class tool not yet implemented",
          query: args.query,
        }, null, 2),
      },
    ],
  };
}

async function handleGetClassDoc(args: any) {
  // TODO: Implement with ClassDocParser
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          message: "get_ebx_class_doc tool not yet implemented",
          className: args.className,
        }, null, 2),
      },
    ],
  };
}

async function handleSearchMethod(args: any) {
  // TODO: Implement with SearchEngine
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          message: "search_ebx_method tool not yet implemented",
          methodName: args.methodName,
        }, null, 2),
      },
    ],
  };
}

async function handleFindPackage(args: any) {
  // TODO: Implement with DocumentationIndexer
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          message: "find_ebx_package tool not yet implemented",
          task: args.task,
        }, null, 2),
      },
    ],
  };
}

/**
 * Start the server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr so it doesn't interfere with MCP communication
  console.error("EBX Documentation MCP Server running");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
