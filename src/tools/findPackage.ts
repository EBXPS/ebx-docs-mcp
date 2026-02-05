import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import type { DocumentationIndexer } from "../indexer/DocumentationIndexer.js";

export const findPackageTool = {
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
  } as any,
};

export async function handleFindPackage(
  args: any,
  indexer: DocumentationIndexer
) {
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
