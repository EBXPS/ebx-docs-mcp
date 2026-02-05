import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import type { DocumentationIndexer } from "../indexer/DocumentationIndexer.js";

export const searchMethodTool = {
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
  } as any,
};

export async function handleSearchMethod(
  args: any,
  indexer: DocumentationIndexer
) {
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
