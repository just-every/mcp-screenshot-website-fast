# Complete MCP (Model Context Protocol) Tool Type Definition

## Tool Interface Fields

Based on the MCP SDK TypeScript definitions and official documentation, here is the complete list of fields available in the Tool type:

### Required Fields

1. **`name`** (string) - **REQUIRED**
   - The unique identifier for the tool
   - Must be a string that uniquely identifies this tool within the server

2. **`inputSchema`** (object) - **REQUIRED**
   - A JSON Schema object defining the expected parameters for the tool
   - Must be an object with:
     - `type`: "object" (literal)
     - `properties`: object (optional) - defines the tool parameters
     - `required`: string[] (optional) - list of required parameter names
   - Can include additional JSON Schema properties via passthrough

### Optional Fields

3. **`description`** (string) - **OPTIONAL**
   - A human-readable description of the tool's functionality
   - Helps LLMs understand when and how to use the tool

4. **`title`** (string) - **OPTIONAL**
   - Human-readable display name for the tool
   - Used for UI purposes when showing tools to users
   - Note: This is part of the annotations object

5. **`outputSchema`** (object) - **OPTIONAL**
   - A JSON Schema object defining the structure of the tool's output
   - Used for the `structuredContent` field in CallToolResult
   - Must be an object with:
     - `type`: "object" (literal)
     - `properties`: object (optional)
     - `required`: string[] (optional)
   - If provided:
     - Servers MUST provide structured results that conform to this schema
     - Clients SHOULD validate structured results against this schema

6. **`annotations`** (object) - **OPTIONAL**
   - Optional properties describing tool behavior
   - Contains behavioral hints (not guarantees) about the tool
   - Fields within annotations:

### Tool Annotations Fields (all optional)

These are nested within the `annotations` object:

- **`title`** (string) - Human-readable title for the tool
- **`readOnlyHint`** (boolean) - If true, the tool does not modify its environment (default: false)
- **`destructiveHint`** (boolean) - If true, the tool may perform destructive updates (default: true)
  - Only meaningful when `readOnlyHint == false`
- **`idempotentHint`** (boolean) - If true, repeated calls with same arguments have no additional effect (default: false)
  - Only meaningful when `readOnlyHint == false`
- **`openWorldHint`** (boolean) - If true, tool interacts with an "open world" of external entities (default: true)
  - Example: web search tools have open world, memory tools do not

## Example Tool Definition

```typescript
const exampleTool: Tool = {
  // Required fields
  name: "take_screenshot",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "URL to capture"
      },
      fullPage: {
        type: "boolean",
        description: "Capture full page",
        default: true
      }
    },
    required: ["url"]
  },
  
  // Optional fields
  description: "Captures a screenshot of a web page",
  
  outputSchema: {
    type: "object",
    properties: {
      width: { type: "number" },
      height: { type: "number" },
      format: { type: "string" }
    },
    required: ["width", "height", "format"]
  },
  
  annotations: {
    title: "Screenshot Capture Tool",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  }
};
```

## Important Notes

1. **Security**: Clients MUST consider tool annotations to be untrusted unless they come from trusted servers
2. **Annotations are hints**: They are not guaranteed to provide a faithful description of tool behavior
3. **Backward compatibility**: Tools returning structured content SHOULD also return functionally equivalent unstructured content
4. **Schema extensibility**: Both inputSchema and outputSchema support passthrough, allowing additional JSON Schema properties

## Source References

- TypeScript definition: `@modelcontextprotocol/sdk/types.js` - ToolSchema and ToolAnnotationsSchema
- Official docs: https://modelcontextprotocol.io/specification/draft/server/tools
- The Tool type is defined as `Infer<typeof ToolSchema>` in the SDK