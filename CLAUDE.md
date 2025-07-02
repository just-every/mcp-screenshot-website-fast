# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Fast, efficient screenshot capture of web pages - optimized for CLI coding tools. Automatically tiles full pages into 1072x1072 chunks for optimal processing.

## Core Modules & Files

- `src/internal/screenshotCapture.ts`: Core Puppeteer-based capture logic
- `src/utils/`: Logger and chunking utilities
- `src/index.ts`: CLI interface using Commander
- `src/serve.ts`: MCP server using SDK
- No caching - always captures fresh content

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
npm run lint                         # Run ESLint
npm run typecheck                    # TypeScript type checking
npm test                             # Run tests with Vitest
```

## Architecture Overview

A TypeScript-based screenshot tool optimized for AI vision models, particularly Claude Vision API. Captures high-quality screenshots with intelligent tiling for large pages.

### Core Components

1. **Screenshot Engine** (`src/internal/screenshotCapture.ts`)
   - Puppeteer-based headless Chrome automation
   - Automatic viewport limiting (1072x1072 for Claude Vision)
   - Smart page tiling for full-page captures
   - Configurable wait strategies

2. **CLI Interface** (`src/index.ts`)
   - Commander-based command line tool
   - Support for various output formats
   - Flexible viewport and wait options

3. **MCP Server** (`src/serve.ts`)
   - SDK-based MCP implementation
   - Real-time screenshot capture
   - No caching for always-fresh content

### Key Patterns

- Browser instance reuse for performance
- Automatic resolution optimization for AI models
- Graceful error handling and retries
- Memory-efficient tiling algorithm

## Pre-Commit Requirements

**IMPORTANT**: Always run these commands before committing:

```bash
npm test          # Ensure tests pass
npm run lint      # Check linting
npm run build     # Ensure TypeScript compiles
```

Only commit if all commands succeed without errors.

## TypeScript Configuration

- ES Modules with Node.js >=20.0.0
- Strict mode enabled, targeting ES2022
- Source maps for debugging
- Declaration files for type safety

## Code Style Guidelines

- Async/await for all asynchronous operations
- Proper error handling with detailed messages
- Resource cleanup (browser instances)
- Minimal dependencies for fast installs

## Testing Instructions

- Run tests with `npm test`
- Test different viewport sizes
- Verify tiling algorithm correctness
- Test error scenarios (timeouts, invalid URLs)

## Repository Etiquette

- Branch names: `feature/description`, `fix/issue-number`
- Conventional commits (`feat:`, `fix:`, `chore:`)
- Update README for user-facing changes
- Include screenshot examples for visual changes

## Developer Environment Setup

1. Clone repository
2. Install Node.js 20.x or higher
3. Run `npm install`
4. Puppeteer will auto-download Chrome
5. Run `npm run dev` for development

## Package Management

- Puppeteer is the main dependency
- Keep Puppeteer version pinned for consistency
- Monitor bundle size for MCP deployment
- Document any new dependencies

## Project-Specific Warnings

- **Memory Usage**: Large pages can consume significant memory during tiling
- **Chrome Process**: Ensure proper cleanup to avoid zombie processes
- **File Sizes**: Tiled screenshots can create large output files
- **Timeouts**: Some sites may require longer wait times
- **Headless Detection**: Some sites block headless browsers

## Key Utility Functions & APIs

- `captureScreenshot()`: Main capture function
- `tilePage()`: Splits large pages into tiles
- `waitForPage()`: Implements various wait strategies
- `optimizeViewport()`: Ensures Claude Vision compatibility

## MCP Server Integration

When running as MCP server (`npm run serve`):

**Tools:**
- `screenshot_website_fast` - Full page capture with automatic tiling

**Features:**
- No caching - always fresh screenshots
- Automatic resolution optimization
- Error handling with descriptive messages

## Troubleshooting

### Common Issues

- **Puppeteer installation**: Check firewall/proxy settings
- **Memory errors**: Reduce viewport size or disable full-page
- **Timeout errors**: Increase wait time or change wait strategy
- **Chrome crashes**: Check system resources

### Debug Mode

Enable verbose logging:
```bash
DEBUG=screenshot:* npm run dev capture <URL>
```