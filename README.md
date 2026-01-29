# EBX Javadoc MCP Server

A Model Context Protocol (MCP) server that makes TIBCO EBX v6.2.2 javadocs accessible for AI-assisted code generation. This server indexes 1,669 HTML documentation files across 57 packages and exposes them through efficient search tools.

## Features

- **Fast Search**: Fuzzy search across 732 classes, 2,494 methods, and 57 packages
- **Complete Documentation**: Full method signatures, descriptions, and inheritance information
- **Task-Based Discovery**: Find packages and classes by development task (e.g., "data access", "UI forms")
- **Performance Optimized**: Index loads in ~20ms, searches complete in <50ms
- **Smart Caching**: LRU cache for frequently accessed documentation

## Installation

### Prerequisites

- Node.js 18+
- npm or yarn
- TIBCO EBX v6.2.2 javadoc HTML files (should be in `ebx-core-javadoc/` directory)

### Setup

1. Clone this repository:
```bash
git clone <repository-url>
cd ebx-docs-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Build the server and generate the index:
```bash
npm run build
```

This will compile TypeScript and generate `data/index.json` (~4MB) with all searchable documentation metadata.

## Configuration

### Claude Desktop

Add this server to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "ebx-docs": {
      "command": "node",
      "args": ["/absolute/path/to/ebx-docs-mcp/dist/index.js"]
    }
  }
}
```

Replace `/absolute/path/to/ebx-docs-mcp` with the actual path to your installation.

### MCP Inspector (Development)

For testing and debugging:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## Available Tools

### 1. `search_ebx_class`

Find classes and interfaces by name or description.

**Parameters:**
- `query` (string, required): Class name or description to search for
- `type` (string, optional): Filter by type - "class", "interface", "enum", or "all" (default: "all")
- `package` (string, optional): Filter by package name
- `limit` (number, optional): Maximum results to return (default: 10)

**Example:**
```json
{
  "query": "read table data",
  "type": "interface",
  "limit": 5
}
```

**Returns:**
```json
{
  "results": [
    {
      "name": "Adaptation",
      "fullyQualifiedName": "com.onwbp.adaptation.Adaptation",
      "type": "interface",
      "package": "com.onwbp.adaptation",
      "description": "Provides read-only access facade to data values in EBX...",
      "keyMethods": ["get", "getString", "getTable"],
      "relevanceScore": 0.95
    }
  ]
}
```

### 2. `get_ebx_class_doc`

Retrieve complete documentation for a specific class.

**Parameters:**
- `className` (string, required): Fully qualified or simple class name (e.g., "Adaptation" or "com.onwbp.adaptation.Adaptation")
- `includeInherited` (boolean, optional): Include inherited methods (default: false)

**Example:**
```json
{
  "className": "Adaptation",
  "includeInherited": false
}
```

**Returns:** Markdown-formatted documentation including:
- Class description
- Inheritance hierarchy
- All methods with signatures and descriptions
- Fields (if any)
- Related classes

### 3. `search_ebx_method`

Search for methods across all classes.

**Parameters:**
- `methodName` (string, required): Method name to search for
- `className` (string, optional): Filter by class name
- `returnType` (string, optional): Filter by return type
- `limit` (number, optional): Maximum results (default: 10)

**Example:**
```json
{
  "methodName": "get",
  "returnType": "String",
  "limit": 10
}
```

**Returns:**
```json
{
  "results": [
    {
      "method": "getString",
      "signature": "String getString(Path aPath)",
      "class": "com.onwbp.adaptation.Adaptation",
      "returnType": "String",
      "description": "Returns the string value of the specified node."
    }
  ]
}
```

### 4. `find_ebx_package`

Discover packages by development task or domain.

**Parameters:**
- `task` (string, required): Task description (e.g., "data access", "UI forms", "validation", "triggers")

**Example:**
```json
{
  "task": "validation"
}
```

**Returns:**
```json
{
  "relevantPackages": [
    {
      "name": "com.onwbp.adaptation",
      "description": "Core classes for accessing datasets, tables, and records",
      "keyClasses": ["Adaptation", "AdaptationTable", "Request"],
      "commonUseCases": ["Reading data", "Querying tables", "Accessing records"]
    }
  ]
}
```

## Usage Examples

### Example 1: Finding Data Access Classes

**User Request:** "I need to read data from an EBX table"

**Tool Call:**
```json
{
  "tool": "search_ebx_class",
  "arguments": {
    "query": "read table data",
    "limit": 5
  }
}
```

**Result:** Returns `Adaptation`, `AdaptationTable`, `Request` with descriptions and key methods.

### Example 2: Understanding a Class

**User Request:** "Show me all methods of the Adaptation interface"

**Tool Call:**
```json
{
  "tool": "get_ebx_class_doc",
  "arguments": {
    "className": "Adaptation"
  }
}
```

**Result:** Full markdown documentation with 59+ methods, inheritance info, and related classes.

### Example 3: Creating a Trigger

**User Request:** "How do I create a before-create trigger in EBX?"

**Tool Call:**
```json
{
  "tool": "find_ebx_package",
  "arguments": {
    "task": "triggers"
  }
}
```

**Result:** Returns `com.orchestranetworks.schema.trigger` package with `TableTrigger`, `BeforeCreateOccurrenceContext`, and usage examples.

### Example 4: Finding a Specific Method

**User Request:** "What classes have a 'validate' method?"

**Tool Call:**
```json
{
  "tool": "search_ebx_method",
  "arguments": {
    "methodName": "validate",
    "limit": 10
  }
}
```

**Result:** List of all classes with a `validate` method, including signatures and descriptions.

## Performance

- **Server Startup:** ~20-50ms (loads pre-built index)
- **Search Operations:** <50ms (fuzzy search with Fuse.js)
- **Full Documentation:** <100ms first time, <10ms cached
- **Memory Usage:** ~100MB typical
- **Index Size:** ~4MB (data/index.json)

## Development

### Running Tests

Test the index parser:
```bash
npm run build && node dist/test-parser.js
```

Test search functionality:
```bash
npm run build && node dist/test-search.js
```

Test MCP tools:
```bash
npm run build && node dist/test-tools.js
```

### Watch Mode

For development with auto-rebuild:
```bash
npm run dev
```

### Project Structure

```
ebx-docs-mcp/
├── src/
│   ├── index.ts                    # MCP server entry point
│   ├── parser/
│   │   ├── SearchIndexParser.ts   # Parse JS search indices
│   │   └── ClassDocParser.ts       # Parse HTML documentation
│   ├── indexer/
│   │   ├── DocumentationIndexer.ts # Main coordinator
│   │   ├── SearchEngine.ts         # Fuse.js fuzzy search
│   │   └── types.ts                # TypeScript interfaces
│   ├── cache/
│   │   └── CacheManager.ts         # LRU cache for docs
│   ├── build-index.ts              # Index generation script
│   └── test-*.ts                   # Test scripts
├── data/
│   └── index.json                  # Pre-built searchable index
├── ebx-core-javadoc/               # EBX javadoc HTML files
├── dist/                           # Compiled JavaScript
└── package.json
```

## Task Categories

The server organizes EBX APIs into task-based categories for easier discovery:

- **Data Access**: `com.onwbp.adaptation` - Adaptation, AdaptationTable, Request
- **Schema Definition**: `com.orchestranetworks.schema` - SchemaNode, Path, SchemaExtensions
- **UI Components**: `com.orchestranetworks.ui.*` - UIForm, UIWidget, custom components
- **Validation**: `com.onwbp.adaptation` - ValidationReport, Constraint classes
- **Triggers**: `com.orchestranetworks.schema.trigger` - TableTrigger, TriggerExecutionContext
- **Workflow**: `com.orchestranetworks.workflow` - ProcessInstance, UserTask, WorkItem

## Troubleshooting

### Server Won't Start

1. Check that Node.js 18+ is installed: `node --version`
2. Verify the build succeeded: `npm run build`
3. Ensure `data/index.json` exists and is not empty
4. Check that `ebx-core-javadoc/` directory exists with HTML files

### Empty Search Results

1. Verify the index was built: `ls -lh data/index.json` (should be ~4MB)
2. Try rebuilding: `npm run build`
3. Test with a known class: search for "Adaptation"

### Claude Desktop Not Finding Server

1. Check the config file path is correct for your OS
2. Use absolute paths in the configuration
3. Restart Claude Desktop after config changes
4. Check Claude Desktop logs for errors

## License

[Your license here]

## Contributing

Contributions welcome! Please open an issue or PR.

## Acknowledgments

Built with:
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/sdk) - MCP server framework
- [cheerio](https://cheerio.js.org/) - HTML parsing
- [fuse.js](https://fusejs.io/) - Fuzzy search
- [turndown](https://github.com/mixmark-io/turndown) - HTML to Markdown conversion
