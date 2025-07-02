# @just-every/mcp-screenshot-website-fast

Fast, efficient screenshot capture tool for web pages - optimized for Claude Vision API. Automatically tiles full pages into 1072x1072 chunks for optimal AI processing.

[![npm version](https://badge.fury.io/js/@just-every%2Fmcp-screenshot-website-fast.svg)](https://www.npmjs.com/package/@just-every/mcp-screenshot-website-fast)
[![GitHub Actions](https://github.com/just-every/mcp-screenshot-website-fast/workflows/Release/badge.svg)](https://github.com/just-every/mcp-screenshot-website-fast/actions)

## Overview

Built specifically for AI vision workflows, this tool captures high-quality screenshots with automatic resolution limiting and tiling for optimal processing by Claude Vision API and other AI models. It ensures screenshots are perfectly sized at 1072x1072 pixels (1.15 megapixels) for maximum compatibility.

## Features

- 📸 **Fast screenshot capture** using Puppeteer headless browser
- 🎯 **Claude Vision optimized** with automatic resolution limiting (1072x1072 for optimal 1.15 megapixels)
- 🔲 **Automatic tiling** - Full pages are automatically split into 1072x1072 tiles
- 🔄 **Always fresh content** - No caching ensures up-to-date screenshots
- 📱 **Configurable viewports** for responsive testing
- ⏱️ **Wait strategies** for dynamic content (networkidle, custom delays)
- 📄 **Full page capture** by default for complete page screenshots
- 📦 **Minimal dependencies** for fast npm installs
- 🔌 **MCP integration** for seamless AI workflows

## Installation

### Claude Code

```bash
# Standard installation
claude mcp add screenshot-website-fast -s user -- npx -y @just-every/mcp-screenshot-website-fast

# With auto-restart (recommended for reliability)
claude mcp add screenshot-website-fast -s user -- npx -y @just-every/mcp-screenshot-website-fast-restart
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

## Prerequisites

- Node.js 20.x or higher
- npm or npx
- Chrome/Chromium (automatically downloaded by Puppeteer)

## Quick Start

### MCP Server Usage

Once installed in your IDE, the following tools are available:

#### Available Tools

- `screenshot_website_fast` - Captures a high-quality screenshot of a webpage
  - Parameters:
    - `url` (required): The HTTP/HTTPS URL to capture
    - `width` (optional): Viewport width in pixels (max 1072, default: 1072)
    - `height` (optional): Viewport height in pixels (max 1072, default: 1072)
    - `fullPage` (optional): Capture full page screenshot with tiling (default: true)
    - `waitUntil` (optional): Wait until event: load, domcontentloaded, networkidle0, networkidle2 (default: domcontentloaded)
    - `waitFor` (optional): Additional wait time in milliseconds
    - `directory` (optional): Directory to save screenshots - returns file paths instead of base64 images

#### Usage Examples

**Default usage (returns base64 images):**
```
screenshot_website_fast(url="https://example.com")
```

**Save to directory (returns file paths):**
```
screenshot_website_fast(url="https://example.com", directory="/path/to/screenshots")
```

When using the `directory` parameter:
- Screenshots are saved as PNG files with timestamps
- File paths are returned instead of base64 data
- For tiled screenshots, each tile is saved as a separate file
- Directory is created automatically if it doesn't exist

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

### Running MCP Server with Auto-Restart

The MCP server now includes automatic restart capability for improved reliability:

```bash
# Run with auto-restart (recommended for production)
npm run serve:restart

# Run without auto-restart (for debugging)
npm run serve
```

The auto-restart feature:
- Automatically restarts the server if it crashes
- Handles unhandled exceptions and promise rejections
- Implements exponential backoff (max 10 attempts in 1 minute)
- Logs all restart attempts for monitoring
- Gracefully handles shutdown signals (SIGINT, SIGTERM)

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

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## Troubleshooting

### Puppeteer Issues
- Ensure Chrome/Chromium can be downloaded
- Check firewall settings
- Try setting `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true` and provide custom executable

### Screenshot Quality
- Adjust viewport dimensions
- Use appropriate wait strategies
- Check if site requires authentication

### Timeout Errors
- Increase wait time with `--wait-for` flag
- Use different `--wait-until` strategies
- Check if site is accessible

## License

MIT