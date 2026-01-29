# EBX Javadoc MCP Server Implementation Plan

## Overview
Build an MCP server that makes TIBCO EBX v6.2.2 javadocs useful for code generation assistance. The server will parse 1,669 HTML documentation files across 57 packages and expose them through MCP tools for efficient API lookups, enabling Claude to generate accurate EBX components.

## Technology Stack: TypeScript

**Rationale:**
- Native MCP SDK support with excellent type safety
- Superior HTML parsing (cheerio, jsdom)
- JavaScript search indices already available in javadoc (can parse directly)
- Strong ecosystem for documentation processing

**Key Dependencies:**
- `@modelcontextprotocol/sdk` - MCP server implementation
- `cheerio` - Fast HTML parsing
- `fuse.js` - Fuzzy search for flexible lookups
- `turndown` - Convert HTML to markdown for LLM consumption

## Architecture

### Component Structure
```
ebx-docs-mcp/
├── src/
│   ├── index.ts                    # MCP server entry point
│   ├── parser/
│   │   ├── SearchIndexParser.ts   # Parse pre-built JS search indices
│   │   ├── ClassDocParser.ts       # Parse HTML class documentation
│   │   └── PackageParser.ts        # Parse package summaries
│   ├── indexer/
│   │   ├── DocumentationIndexer.ts # Build searchable index at startup
│   │   ├── SearchEngine.ts         # Fuse.js-based search
│   │   └── types.ts                # TypeScript interfaces
│   ├── tools/
│   │   ├── SearchClassTool.ts      # search_ebx_class
│   │   ├── GetClassDocTool.ts      # get_ebx_class_doc
│   │   ├── SearchMethodTool.ts     # search_ebx_method
│   │   └── FindPackageTool.ts      # find_ebx_package
│   └── cache/
│       └── CacheManager.ts          # LRU cache for parsed docs
├── data/
│   └── index.json                  # Pre-built index (generated at build)
├── ebx-core-javadoc/               # Existing javadoc HTML
├── package.json
├── tsconfig.json
└── README.md
```

### Data Structures

```typescript
interface ClassDocumentation {
  fullyQualifiedName: string;        // "com.onwbp.adaptation.Adaptation"
  simpleName: string;                // "Adaptation"
  package: string;                   // "com.onwbp.adaptation"
  type: 'interface' | 'class' | 'enum' | 'exception';
  description: string;               // Main description (markdown)
  extends?: string[];                // Parent classes/interfaces
  implements?: string[];             // Implemented interfaces
  methods: MethodDoc[];              // All methods
  fields: FieldDoc[];                // All fields
  deprecated: boolean;
  seeAlso: string[];                // Related classes
  htmlPath: string;                 // Relative path for full docs
}

interface MethodDoc {
  name: string;
  signature: string;                 // Full signature with types
  returnType: string;
  parameters: ParameterDoc[];
  description: string;
  modifiers: string[];               // ['public', 'abstract']
  deprecated: boolean;
}

interface PackageDocumentation {
  name: string;                      // "com.onwbp.adaptation"
  description: string;
  classes: string[];                 // Class FQNs in package
  relatedPackages: string[];
}

interface SearchIndex {
  classes: Map<string, ClassDocumentation>;
  methods: Map<string, MethodSearchEntry[]>;
  packages: Map<string, PackageDocumentation>;
  categoriesByTask: Map<string, string[]>;  // "data access" -> ["Adaptation", ...]
}
```

### Parsing Strategy

**Phase 1: Leverage Existing Search Indices**
- Parse `ebx-core-javadoc/type-search-index.js` - contains all ~900 classes with packages
- Parse `ebx-core-javadoc/member-search-index.js` - contains all methods/fields (5000+ entries)
- Parse `ebx-core-javadoc/package-search-index.js` - contains all 57 packages
- These provide fast inventory without parsing all HTML

**Phase 2: Lazy-Load Full Documentation**
- Parse individual HTML files only when full documentation requested
- Use Cheerio to extract:
  - Class description from `<section class="class-description">`
  - Method summary from `<section class="method-summary">`
  - Detailed method docs from `<section class="method-detail">`
  - Inheritance info from `<dl class="notes">`
- Convert HTML descriptions to markdown using Turndown

**Phase 3: Build Domain Categorization**
Create task-based categories for code generation:
- **Data Access**: Adaptation, AdaptationTable, Request, AdaptationHome
- **Schema Definition**: SchemaNode, Path, SchemaExtensions, Constraint*
- **UI Components**: UIForm, UIWidget, UIButton*, UIComboBox, UITextBox
- **Query API**: Query, QueryBuilder, QueryResult
- **Validation**: ValidationReport, Constraint*, ValidationContext
- **Triggers**: TableTrigger, InstanceTrigger, *TriggerExecutionContext
- **Workflow**: ProcessInstance, UserTask, WorkItem
- **REST APIs**: RESTApplicationAbstract, ApplicationConfigurator
- **Permissions**: AccessRule, ServicePermission, AccessPermission

## MCP Tools

### Tool 1: `search_ebx_class`
**Purpose:** Find classes/interfaces for code generation

**Input:**
```typescript
{
  query: string;              // Class name or description
  type?: 'class' | 'interface' | 'enum' | 'all';
  package?: string;           // Optional filter
  limit?: number;             // Default: 10
}
```

**Output (Adaptive Detail - Concise):**
```typescript
{
  results: [
    {
      name: "Adaptation",
      fullyQualifiedName: "com.onwbp.adaptation.Adaptation",
      type: "interface",
      package: "com.onwbp.adaptation",
      description: "Provides read-only access facade to data values in EBX...",
      keyMethods: ["get", "getString", "getTable"],
      relevanceScore: 0.95
    }
  ]
}
```

**Implementation:** Fuse.js fuzzy search across class names, descriptions, and key methods

### Tool 2: `get_ebx_class_doc`
**Purpose:** Get complete documentation for code generation context

**Input:**
```typescript
{
  className: string;          // FQN or simple name
  includeInherited?: boolean; // Default: false
}
```

**Output (Full Documentation - Markdown):**
```markdown
# Adaptation

**Package:** com.onwbp.adaptation
**Type:** Interface
**Extends:** ReadContext

## Description
Provides read-only access facade to data values in EBX...

## Key Methods

### get(Path aPath): Object
Returns the value of the specified node.

**Parameters:**
- `aPath` (Path): The path to the node

**Returns:** Object - The value at the specified path

### getString(Path aPath): String
Returns the string value of the specified node...

## See Also
- AdaptationHome
- AdaptationTable
- ProcedureContext
```

**Implementation:**
- Parse HTML file on-demand (cache with LRU)
- Convert to markdown for LLM-friendly format
- Include inheritance hierarchy and related classes

### Tool 3: `search_ebx_method`
**Purpose:** Find methods across all classes

**Input:**
```typescript
{
  methodName: string;         // Method name to search
  className?: string;         // Optional class filter
  returnType?: string;        // Optional return type filter
  limit?: number;             // Default: 10
}
```

**Output:**
```typescript
{
  results: [
    {
      method: "get",
      signature: "Object get(Path aPath)",
      class: "com.onwbp.adaptation.Adaptation",
      returnType: "Object",
      description: "Returns the value of the specified node."
    }
  ]
}
```

### Tool 4: `find_ebx_package`
**Purpose:** Discover packages by task/domain for code generation

**Input:**
```typescript
{
  task: string;               // "data access", "UI forms", "validation"
}
```

**Output:**
```typescript
{
  relevantPackages: [
    {
      name: "com.onwbp.adaptation",
      description: "Core classes for accessing datasets, tables, and records",
      keyClasses: ["Adaptation", "AdaptationTable", "Request"],
      commonUseCases: ["Reading data", "Querying tables", "Accessing records"]
    }
  ]
}
```

## Implementation Phases

**Status:** Phase 1 Complete ✅ | Phase 2 In Progress 🚧

### Phase 1: Project Setup ✅ COMPLETE
**Completed:** 2026-01-29
- Initialize TypeScript project with MCP SDK
- Create package.json with dependencies
- Set up tsconfig.json for Node.js + ES modules
- Create basic project structure

**Files to create:**
- `/Users/steve/claude/ebx-docs-mcp/package.json`
- `/Users/steve/claude/ebx-docs-mcp/tsconfig.json`
- `/Users/steve/claude/ebx-docs-mcp/src/index.ts`

### Phase 2: Index Parser
- Parse JavaScript search indices (type-search-index.js, member-search-index.js)
- Extract all class names, packages, and method signatures
- Build initial index structure

**Files to create:**
- `/Users/steve/claude/ebx-docs-mcp/src/parser/SearchIndexParser.ts`
- `/Users/steve/claude/ebx-docs-mcp/src/indexer/types.ts`

### Phase 3: HTML Documentation Parser
- Implement Cheerio-based HTML parser
- Extract class descriptions, methods, fields
- Convert HTML to markdown
- Implement caching

**Files to create:**
- `/Users/steve/claude/ebx-docs-mcp/src/parser/ClassDocParser.ts`
- `/Users/steve/claude/ebx-docs-mcp/src/cache/CacheManager.ts`

### Phase 4: Search Engine
- Implement Fuse.js fuzzy search
- Build domain categorization logic
- Create search engine with relevance scoring

**Files to create:**
- `/Users/steve/claude/ebx-docs-mcp/src/indexer/SearchEngine.ts`
- `/Users/steve/claude/ebx-docs-mcp/src/indexer/DocumentationIndexer.ts`

### Phase 5: MCP Tools
- Implement all 4 MCP tools
- Register tools with MCP server
- Add input validation and error handling

**Files to create:**
- `/Users/steve/claude/ebx-docs-mcp/src/tools/SearchClassTool.ts`
- `/Users/steve/claude/ebx-docs-mcp/src/tools/GetClassDocTool.ts`
- `/Users/steve/claude/ebx-docs-mcp/src/tools/SearchMethodTool.ts`
- `/Users/steve/claude/ebx-docs-mcp/src/tools/FindPackageTool.ts`

### Phase 6: Integration & Testing
- Wire up all components in index.ts
- Build pre-generated index at build time
- Test with sample queries
- Create README with usage examples

## Performance Strategy

**Build-Time Indexing:**
- Parse all search indices at build time
- Generate `data/index.json` with metadata for all classes
- Include category mappings

**Runtime:**
- Load index at startup (~1-2 MB, <100ms)
- Lazy-parse HTML only when full docs requested
- LRU cache for 50 most recent class documents
- Fuse.js for instant fuzzy search

**Targets:**
- Server startup: <500ms
- Search operations: <50ms
- Full class doc retrieval: <100ms (first), <10ms (cached)

## Critical Files

**Most Important (Core Parsing):**
1. `/Users/steve/claude/ebx-docs-mcp/src/parser/SearchIndexParser.ts` - Parse existing JS indices (foundation)
2. `/Users/steve/claude/ebx-docs-mcp/src/parser/ClassDocParser.ts` - Parse HTML on-demand
3. `/Users/steve/claude/ebx-docs-mcp/src/indexer/DocumentationIndexer.ts` - Coordinate all parsing

**MCP Integration:**
4. `/Users/steve/claude/ebx-docs-mcp/src/index.ts` - MCP server entry point and tool registration
5. `/Users/steve/claude/ebx-docs-mcp/src/tools/SearchClassTool.ts` - Primary tool for code generation

## Code Generation Use Case Optimization

**Key Workflows to Support:**

1. **Finding the Right Interface**
   - User: "I need to read data from an EBX table"
   - Tool: `search_ebx_class({query: "read table data"})`
   - Returns: Adaptation, AdaptationTable, Request with brief descriptions

2. **Understanding Method Signatures**
   - User: "What methods does Adaptation have?"
   - Tool: `get_ebx_class_doc({className: "Adaptation"})`
   - Returns: Full markdown documentation with all methods

3. **Implementing a Trigger**
   - User: "How do I create a before-create trigger?"
   - Tool: `find_ebx_package({task: "triggers"})`
   - Returns: com.orchestranetworks.schema.trigger package with TableTrigger, BeforeCreateOccurrenceContext

4. **Building Custom UI**
   - User: "I need a custom form widget"
   - Tool: `search_ebx_class({query: "custom widget", package: "com.orchestranetworks.ui"})`
   - Returns: UICustomWidget, UISimpleCustomWidget with usage info

## Configuration Files

### package.json
```json
{
  "name": "ebx-docs-mcp",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc && node dist/build-index.js",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0",
    "cheerio": "^1.0.0-rc.12",
    "fuse.js": "^7.0.0",
    "turndown": "^7.2.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3"
  }
}
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Potential Challenges & Solutions

**Challenge 1: JavaScript Index Format**
- Search indices are JavaScript, not JSON
- **Solution:** Use regex to extract array portion, or eval in sandboxed context

**Challenge 2: Large HTML Files (some >2000 lines)**
- **Solution:** Stream parsing with Cheerio, extract only needed sections

**Challenge 3: Ambiguous Class Names**
- Multiple classes might have similar names
- **Solution:** Always show package in results, use FQN for lookups

**Challenge 4: Method Overloading**
- Same method name with different signatures
- **Solution:** Include full signature in index, group overloads in results

## Verification

**After implementation, verify:**

1. **Index Generation:**
   ```bash
   npm run build
   # Check data/index.json exists and contains ~900 classes
   ```

2. **Server Startup:**
   ```bash
   npm start
   # Verify starts in <500ms, no errors
   ```

3. **Tool Testing:**
   - Search for "Adaptation" - should return com.onwbp.adaptation.Adaptation
   - Get full docs for "Adaptation" - should return markdown with methods
   - Search methods "get" - should return multiple matches
   - Find package for "data access" - should return com.onwbp.adaptation

4. **Code Generation Test:**
   - Ask Claude to generate code using EBX APIs
   - Verify it can find correct classes and methods
   - Check method signatures are accurate

5. **Performance:**
   - Search operations complete in <50ms
   - Full doc retrieval <100ms (first time)

## Success Criteria

- ✅ All 900+ classes indexed and searchable
- ✅ Search returns relevant results in <50ms
- ✅ Full documentation retrieval works for any class
- ✅ Method search works across all classes
- ✅ Domain categorization helps find packages by task
- ✅ Claude can generate accurate EBX code using the tools
- ✅ Server starts in <500ms
- ✅ Memory usage <100MB

## Next Steps After Implementation

1. Test with real code generation scenarios
2. Tune Fuse.js search weights for better relevance
3. Add more domain categories based on usage patterns
4. Consider adding MCP resources for package-level docs
5. Add examples/snippets extraction from descriptions

---

## Current Status (Updated 2026-01-29)

### ✅ Completed
- **Phase 1: Project Setup** - All configuration files and basic MCP server structure in place
  - package.json with all dependencies (MCP SDK, cheerio, fuse.js, turndown)
  - tsconfig.json configured for Node16 modules
  - Basic MCP server with 4 tool definitions
  - Directory structure created (parser/, indexer/, tools/, cache/)
  - Project builds successfully with `npm run build`
  - Placeholder build script for index generation

### 🚧 Next Priority: Phase 2 - Index Parser
The most important next step is to implement the SearchIndexParser to extract class and method information from the existing javadoc search indices.

**Critical files to create:**
1. `src/indexer/types.ts` - Define TypeScript interfaces for all data structures
2. `src/parser/SearchIndexParser.ts` - Parse type-search-index.js, member-search-index.js, package-search-index.js
3. Update `src/build-index.ts` - Generate data/index.json at build time

**Why this is the foundation:**
- The javadoc includes pre-built JavaScript search indices with ~900 classes and 5000+ methods
- Parsing these provides instant inventory without parsing 1,669 HTML files
- This enables implementation of search tools before HTML parsing
- HTML parsing can be added later for full documentation details

**Test verification:**
After Phase 2, we should be able to:
- Run `npm run build` and see actual index generation output
- Have a populated `data/index.json` with all class names and basic metadata
- Implement basic `search_ebx_class` functionality using the index
