# MCP Screenshot Website Fast

Fast, efficient screenshot capture tool for web pages - optimized for Claude Vision API. Automatically tiles full pages into 1072x1072 chunks for optimal AI processing.

## MCP Server Configuration

This tool can be used as an MCP (Model Context Protocol) server with Claude Desktop, Cursor, VS Code, and other compatible clients.

## Installation

### Claude Code

```bash
claude mcp add screenshot-website-fast -s user -- npx -y @just-every/mcp-screenshot-website-fast
```

### VS Code

```bash
code --add-mcp '{"name":"screenshot-website-fast","command":"npx","args":["-y","@just-every/mcp-screenshot-website-fast"]}'
```

### Cursor

```bash
cursor://anysphere.cursor-deeplink/mcp/install?name=screenshot-website-fast&config=eyJzY3JlZW5zaG90LXdlYnNpdGUtZmFzdCI6eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkBqdXN0LWV2ZXJ5L21jcC1zY3JlZW5zaG90LXdlYnNpdGUtZmFzdCJdfX0=
```

### JetBrains IDEs

Settings → Tools → AI Assistant → Model Context Protocol (MCP) → Add

Choose "As JSON" and paste:

```json
{"command":"npx","args":["-y","@just-every/mcp-screenshot-website-fast"]}
```

### Raw JSON (works in any MCP client)

```json
{
  "mcpServers": {
    "screenshot-website-fast": {
      "command": "npx",
      "args": ["-y", "@just-every/mcp-screenshot-website-fast"]
    }
  }
}
```

Drop this into your client's mcp.json (e.g. .vscode/mcp.json, ~/.cursor/mcp.json, or .mcp.json for Claude).

## Features

- **Fast screenshot capture** using Puppeteer headless browser
- **Claude Vision optimized** with automatic resolution limiting (1072x1072 for optimal 1.15 megapixels)
- **Automatic tiling** - Full pages are automatically split into 1072x1072 tiles
- **Always fresh content** - No caching ensures up-to-date screenshots
- **Configurable viewports** for responsive testing
- **Wait strategies** for dynamic content (networkidle, custom delays)
- **Full page capture** by default for complete page screenshots
- **Minimal dependencies** for fast npm installs
- **MCP integration** for seamless AI workflows

### Available Tools

- `screenshot_website_fast` - Captures a high-quality screenshot of a webpage
  - Parameters:
    - `url` (required): The HTTP/HTTPS URL to capture
    - `width` (optional): Viewport width in pixels (max 1072, default: 1072)
    - `height` (optional): Viewport height in pixels (max 1072, default: 1072)
    - `fullPage` (optional): Capture full page screenshot (default: true)
    - `waitUntil` (optional): Wait until event: load, domcontentloaded, networkidle0, networkidle2 (default: networkidle2)
    - `waitFor` (optional): Additional wait time in milliseconds

## Development Usage

### Install

```bash
npm install
npm run build
```

### Capture screenshot
```bash
# Full page with automatic tiling (default)
npm run dev capture https://example.com -o screenshot.png

# Viewport-only screenshot  
npm run dev capture https://example.com --no-full-page -o screenshot.png

# Wait for specific conditions
npm run dev capture https://example.com --wait-until networkidle0 --wait-for 2000 -o screenshot.png
```

### CLI Options

- `-w, --width <pixels>` - Viewport width (max 1072, default: 1072)
- `-h, --height <pixels>` - Viewport height (max 1072, default: 1072)
- `--no-full-page` - Disable full page capture and tiling
- `--wait-until <event>` - Wait until event: load, domcontentloaded, networkidle0, networkidle2
- `--wait-for <ms>` - Additional wait time in milliseconds
- `-o, --output <path>` - Output file path (required for tiled output)

## Architecture

```
mcp-screenshot-website-fast/
├── src/
│   ├── internal/       # Core screenshot capture logic
│   ├── utils/          # Logger and utilities
│   ├── index.ts        # CLI entry point
│   └── serve.ts        # MCP server entry point
```

## Development

```bash
# Run in development mode
npm run dev capture https://example.com -o screenshot.png

# Build for production
npm run build

# Run tests
npm test

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Why This Tool?

Built specifically for AI vision workflows:

1. **Optimized for Claude Vision API** - Automatic resolution limiting to 1072x1072 pixels (1.15 megapixels)
2. **Automatic tiling** - Full pages split into perfect chunks for AI processing
3. **Always fresh** - No caching ensures you get the latest content
4. **MCP native** - First-class integration with AI development tools
5. **Simple API** - Clean, straightforward interface for capturing screenshots

## License

MIT