import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DocumentationIndexer } from "../indexer/DocumentationIndexer.js";

import { searchClassTool, handleSearchClass } from "./searchClass.js";
import { getClassDocTool, handleGetClassDoc } from "./getClassDoc.js";
import { searchMethodTool, handleSearchMethod } from "./searchMethod.js";
import { findPackageTool, handleFindPackage } from "./findPackage.js";

export function registerTools(
  server: McpServer,
  indexer: DocumentationIndexer
) {
  server.registerTool(
    searchClassTool.name,
    {
      description: searchClassTool.description,
      inputSchema: searchClassTool.inputSchema,
    },
    async (args: any) => handleSearchClass(args, indexer)
  );

  server.registerTool(
    getClassDocTool.name,
    {
      description: getClassDocTool.description,
      inputSchema: getClassDocTool.inputSchema,
    },
    async (args: any) => handleGetClassDoc(args, indexer)
  );

  server.registerTool(
    searchMethodTool.name,
    {
      description: searchMethodTool.description,
      inputSchema: searchMethodTool.inputSchema,
    },
    async (args: any) => handleSearchMethod(args, indexer)
  );

  server.registerTool(
    findPackageTool.name,
    {
      description: findPackageTool.description,
      inputSchema: findPackageTool.inputSchema,
    },
    async (args: any) => handleFindPackage(args, indexer)
  );
}
