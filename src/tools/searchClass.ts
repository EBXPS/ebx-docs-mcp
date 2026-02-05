import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import type { DocumentationIndexer } from "../indexer/DocumentationIndexer.js";

export const searchClassTool = {
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
  } as any,
};

export async function handleSearchClass(
  args: any,
  indexer: DocumentationIndexer
) {
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
