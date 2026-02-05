#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import { DocumentationIndexer } from "./indexer/DocumentationIndexer.js";
import * as path from "path";
import { fileURLToPath } from "url";

/**
 * EBX Documentation MCP Server
 * Provides tools for searching and retrieving TIBCO EBX v6.2.2 javadoc documentation
 */

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize the documentation indexer
const indexPath = path.join(__dirname, "..", "data", "index.json");
const javadocRoot = path.join(__dirname, "..", "ebx-core-javadoc");
const indexer = new DocumentationIndexer(indexPath, javadocRoot);

const server = new Server(
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
        type: "text",
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
        type: "text",
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
        type: "text",
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
        type: "text",
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

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr so it doesn't interfere with MCP communication
  console.error("EBX Documentation MCP Server running");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
