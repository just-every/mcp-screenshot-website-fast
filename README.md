[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/just-every-mcp-screenshot-website-fast-badge.png)](https://mseep.ai/app/just-every-mcp-screenshot-website-fast)

# @just-every/mcp-screenshot-website-fast

Fast, efficient screenshot capture of web pages - optimized for CLI coding tools. Automatically tiles full pages into 1072x1072 chunks for optimal processing.

<a href="https://glama.ai/mcp/servers/@just-every/mcp-screenshot-website-fast">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@just-every/mcp-screenshot-website-fast/badge" alt="Screenshot Website Fast MCP server" />
</a>

[![npm version](https://badge.fury.io/js/@just-every%2Fmcp-screenshot-website-fast.svg)](https://www.npmjs.com/package/@just-every/mcp-screenshot-website-fast)
[![GitHub Actions](https://github.com/just-every/mcp-screenshot-website-fast/workflows/Release/badge.svg)](https://github.com/just-every/mcp-screenshot-website-fast/actions)

## Overview

Built specifically for AI vision workflows, this tool captures high-quality screenshots with automatic resolution limiting and tiling for optimal processing by Claude Vision API and other AI models. It ensures screenshots are perfectly sized at 1072x1072 pixels (1.15 megapixels) for maximum compatibility.

## Features

- 📸 **Fast screenshot capture** using Puppeteer headless browser
- 🎯 **Claude Vision optimized** with automatic resolution limiting (1072x1072 for optimal 1.15 megapixels)
- 🔲 **Automatic tiling** - Full pages are automatically split into 1072x1072 tiles
- 🎬 **Screencast capture** - Record series of screenshots over time with configurable intervals
- 🔄 **Always fresh content** - No caching ensures up-to-date screenshots
- 📱 **Configurable viewports** for responsive testing
- ⏱️ **Wait strategies** for dynamic content (networkidle, custom delays)
- 📄 **Full page capture** by default for complete page screenshots
- 🎥 **Animated WebP export** - Save screencasts as high-quality animated WebP files
- 💉 **JavaScript injection** - Execute custom JS before screencast capture
- 📦 **Minimal dependencies** for fast npm installs
- 🔌 **MCP integration** for seamless AI workflows
- 🔋 **Resource efficient** - Automatic browser cleanup after 60 seconds of inactivity
- 🧹 **Memory management** - Pages are closed after each screenshot to prevent leaks

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

## Prerequisites

- Node.js 20.x or higher
- npm or npx
- Chrome/Chromium (automatically downloaded by Puppeteer)

## Quick Start

### MCP Server Usage

Once installed in your IDE, the following tools are available:

#### Available Tools

- `take_screenshot` - Captures a high-quality screenshot of a webpage
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
take_screenshot(url="https://example.com")
```

**Save to directory (returns file paths):**
```
take_screenshot(url="https://example.com", directory="/path/to/screenshots")
```

When using the `directory` parameter:
- Screenshots are saved as PNG files with timestamps
- File paths are returned instead of base64 data
- For tiled screenshots, each tile is saved as a separate file
- Directory is created automatically if it doesn't exist

### take_screencast

Captures a series of screenshots over time to create a screencast. Only captures the top tile (1072x1072) of the viewport.

#### Parameters
- `url` (required): The URL to capture
- `duration` (optional): Total duration in seconds (default: 10)
- `interval` (optional): Interval between screenshots in seconds (default: 2)
- `jsEvaluate` (optional): JavaScript code to execute at the start
- `waitUntil` (optional): Wait strategy: 'load', 'domcontentloaded', 'networkidle0', 'networkidle2'
- `waitForMS` (optional): Additional wait time before starting
- `directory` (optional): Save as animated WebP to directory (captures every 1 second)

#### Usage Examples

**Basic screencast (5 frames over 10 seconds):**
```
take_screencast(url="https://example.com")
```

**Custom timing:**
```
take_screencast(url="https://example.com", duration=15, interval=3)
```

**With JavaScript execution:**
```
take_screencast(
  url="https://example.com",
  jsEvaluate="document.body.style.backgroundColor = 'red';"
)
```

**Save as animated WebP:**
```
take_screencast(url="https://example.com", directory="/path/to/output")
```

When using the `directory` parameter:
- An animated WebP is created with 1-second intervals
- Individual frames are also saved as PNG files
- The animation loops forever by default
- WebP provides excellent quality:
  - Full color support (no 256 color limitation)
  - Efficient compression for web animations
  - Perfect for gradient backgrounds and smooth animations
  - Smaller file sizes compared to GIF with better quality

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

## Auto-Restart Feature

The MCP server includes automatic restart capability by default for improved reliability:

- Automatically restarts the server if it crashes
- Handles unhandled exceptions and promise rejections
- Implements exponential backoff (max 10 attempts in 1 minute)
- Logs all restart attempts for monitoring
- Gracefully handles shutdown signals (SIGINT, SIGTERM)

For development/debugging without auto-restart:
```bash
# Run directly without restart wrapper
npm run serve:dev
```

## Architecture

```
mcp-screenshot-website-fast/
├── src/
│   ├── internal/       # Core screenshot capture logic
│   ├── utils/          # Logger and utilities
│   ├── index.ts        # CLI entry point
│   ├── serve.ts        # MCP server entry point
│   └── serve-restart.ts # Auto-restart wrapper
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