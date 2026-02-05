#!/usr/bin/env node

import { DocumentationIndexer } from "./indexer/DocumentationIndexer.js";
import * as path from "path";
import { fileURLToPath } from "url";
import { registerTools } from "./tools/index.js";
import { createMcpServer } from "./server/createServer.js";
import { createHttpServer } from "./server/httpServer.js";
import {
  getTransportType,
  createStdioTransport,
  createHttpTransport,
} from "./server/transportFactory.js";

/**
 * EBX Documentation MCP Server
 * Provides tools for searching and retrieving TIBCO EBX javadoc documentation
 */

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths for documentation
const javadocDir = path.join(__dirname, "..", "javadoc");
const indexPath = path.join(javadocDir, "javadoc-index.json");
const zipPath = path.join(javadocDir, "ebx-core-javadoc.zip");

// Create indexer
const indexer = new DocumentationIndexer(indexPath, zipPath);

/**
 * Start the server
 */
async function main() {
  // Initialize the documentation indexer
  console.error("Loading EBX documentation index...");
  await indexer.initialize();
  console.error("Index loaded successfully");

  // Create server with version from index
  const version = indexer.getVersion() || "unknown";
  const server = createMcpServer(version);

  // Register all tools
  registerTools(server, indexer);

  // Determine transport type
  const transportType = getTransportType();

  if (transportType === 'stdio') {
    // Stdio mode (for MCP Inspector and Claude Desktop)
    console.error("Starting in stdio mode...");
    const transport = createStdioTransport();
    await server.connect(transport);
    console.error("EBX Documentation MCP Server running on stdio");
    return;
  }

  // HTTP/Streamable mode
  console.log("Starting in HTTP mode with Streamable transport...");
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8000;

  // Create transport and connect server
  const transport = createHttpTransport();
  await server.connect(transport);

  // Create and start HTTP server
  const httpServer = createHttpServer(transport, version);
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
