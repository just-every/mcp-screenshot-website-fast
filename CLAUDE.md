# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
npm run dev capture <URL> -o out.png # Capture screenshot (tiled by default)
npm run dev capture <URL> --no-full-page -o out.png # Viewport only
npm run serve:dev                    # Run MCP server in dev mode
```

### Build & Production
```bash
npm run build                        # Compile TypeScript to JavaScript
npm run start                        # Run compiled CLI
npm run serve                        # Run compiled MCP server
```

### Code Quality
```bash
npm run lint                         # Run ESLint (needs configuration)
npm run typecheck                    # TypeScript type checking
npm test                             # Run tests (Vitest - no tests implemented)
```

## Architecture

This is a TypeScript-based screenshot capture tool optimized for Claude Vision API. It captures high-quality screenshots of web pages with configurable viewports and wait strategies.

### Core Components

1. **Screenshot Capture** (`src/internal/screenshotCapture.ts`):
   - Uses Puppeteer for headless Chrome
   - Configurable viewport (max 1568x1568 for Claude Vision)
   - Multiple wait strategies for dynamic content
   - Browser instance reuse for performance

2. **No caching** - Always captures fresh content

3. **Entry Points**:
   - `src/index.ts`: CLI interface using Commander
   - `src/serve.ts`: MCP server using SDK
   - Both share the same screenshot capture core

### Key Technical Details

- **Module System**: ES Modules with Node.js >=20.0.0
- **TypeScript**: Strict mode, targeting ES2022
- **No Tests**: Vitest configured but no tests implemented
- **No ESLint Config**: Dependency exists but needs configuration file

### MCP Server

When running as MCP server (`npm run serve`), provides:
- Tool: `screenshot_website_fast` - Captures webpage screenshots (full page with automatic tiling)
- No resources (caching removed for always-fresh content)