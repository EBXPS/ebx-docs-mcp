import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import type { DocumentationIndexer } from "../indexer/DocumentationIndexer.js";

export const getClassDocTool = {
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
  } as any,
};

export async function handleGetClassDoc(
  args: any,
  indexer: DocumentationIndexer
) {
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
