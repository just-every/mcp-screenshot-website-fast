#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListResourcesRequestSchema,
    ReadResourceRequestSchema,
    type Tool,
    type Resource,
} from '@modelcontextprotocol/sdk/types.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// Lazy load heavy dependencies
let screenshotModule: any;

const server = new Server(
    {
        name: 'screenshot-website-fast',
        version: '0.1.0',
    },
    {
        capabilities: {
            tools: {},
            resources: {},
        },
    }
);

// Tool definition
const SCREENSHOT_TOOL: Tool = {
    name: 'screenshot_website_fast',
    description:
        'Capture high-quality screenshots of web pages optimized for Claude Vision API',
    inputSchema: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description: 'HTTP/HTTPS URL to capture',
            },
            width: {
                type: 'number',
                description: 'Viewport width in pixels (max 1072)',
                default: 1072,
            },
            height: {
                type: 'number',
                description: 'Viewport height in pixels (max 1072)',
                default: 1072,
            },
            fullPage: {
                type: 'boolean',
                description: 'Capture full page screenshot with tiling',
                default: true,
            },
            waitUntil: {
                type: 'string',
                description:
                    'Wait until event: load, domcontentloaded, networkidle0, networkidle2',
                default: 'domcontentloaded',
            },
            waitFor: {
                type: 'number',
                description: 'Additional wait time in milliseconds',
            },
            directory: {
                type: 'string',
                description:
                    'Directory to save screenshots (returns file paths instead of base64)',
            },
        },
        required: ['url'],
    },
};

// Resources definitions
const RESOURCES: Resource[] = [];

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [SCREENSHOT_TOOL],
}));

// Helper function to generate unique filename
function generateFilename(url: string, index?: number): string {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/[^a-z0-9]/gi, '_');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const suffix = index !== undefined ? `_tile${index + 1}` : '';
    return `screenshot_${hostname}_${timestamp}${suffix}.png`;
}

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async request => {
    try {
        if (request.params.name !== 'screenshot_website_fast') {
            throw new Error(`Unknown tool: ${request.params.name}`);
        }

        // Lazy load the module on first use
        if (!screenshotModule) {
            screenshotModule = await import('./internal/screenshotCapture.js');
        }

        const args = request.params.arguments as any;
        console.error(`[MCP] Received screenshot request for URL: ${args.url}`);

        const result = await screenshotModule.captureScreenshot({
            url: args.url,
            viewport: {
                width: Math.min(args.width ?? 1072, 1072),
                height: Math.min(args.height ?? 1072, 1072),
            },
            fullPage: args.fullPage ?? true,
            waitUntil: args.waitUntil ?? 'domcontentloaded',
            waitFor: args.waitFor,
        });

        // If directory is specified, save to disk
        if (args.directory) {
            // Ensure directory exists
            if (!existsSync(args.directory)) {
                await mkdir(args.directory, { recursive: true });
            }

            const savedPaths: string[] = [];

            if ('tiles' in result) {
                // Handle tiled screenshot result
                const tiledResult = result as any; // TiledScreenshotResult

                // Save each tile
                for (let i = 0; i < tiledResult.tiles.length; i++) {
                    const tile = tiledResult.tiles[i];
                    const filename = generateFilename(args.url, i);
                    const filepath = join(args.directory, filename);
                    await writeFile(filepath, tile.screenshot);
                    savedPaths.push(filepath);
                }

                return {
                    content: [
                        {
                            type: 'text',
                            text: `✅ Saved ${tiledResult.tiles.length} screenshot tiles to:\n${savedPaths.join('\n')}\n\nPage size: ${tiledResult.fullWidth}x${tiledResult.fullHeight} pixels\nTile size: ${tiledResult.tileSize}x${tiledResult.tileSize} pixels`,
                        },
                    ],
                };
            } else {
                // Handle regular screenshot
                const filename = generateFilename(args.url);
                const filepath = join(args.directory, filename);
                await writeFile(filepath, result.screenshot);
                savedPaths.push(filepath);

                return {
                    content: [
                        {
                            type: 'text',
                            text: `✅ Screenshot saved to: ${filepath}\n\nDimensions: ${result.viewport.width}x${result.viewport.height} pixels`,
                        },
                    ],
                };
            }
        } else {
            // Return base64 encoded images as before
            if ('tiles' in result) {
                // Handle tiled screenshot result
                const tiledResult = result as any; // TiledScreenshotResult
                const content = [];

                // Add each tile as an image
                for (const tile of tiledResult.tiles) {
                    content.push({
                        type: 'image',
                        data: tile.screenshot.toString('base64'),
                        mimeType: 'image/png',
                    });
                }

                // Add summary text
                content.push({
                    type: 'text',
                    text: `✅ Captured ${tiledResult.tiles.length} tiles (${tiledResult.tileSize}x${tiledResult.tileSize} each) from page measuring ${tiledResult.fullWidth}x${tiledResult.fullHeight} pixels`,
                });

                return { content };
            } else {
                // Handle regular screenshot
                const base64Screenshot = result.screenshot.toString('base64');

                return {
                    content: [
                        {
                            type: 'image',
                            data: base64Screenshot,
                            mimeType: 'image/png',
                        },
                        {
                            type: 'text',
                            text: `✅ Screenshot captured: ${result.viewport.width}x${result.viewport.height} pixels`,
                        },
                    ],
                };
            }
        }
    } catch (error: any) {
        console.error(`[MCP] Error capturing screenshot:`, error);
        throw error;
    }
});

// Handle resource listing
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: RESOURCES,
}));

// Handle resource reading
server.setRequestHandler(ReadResourceRequestSchema, async () => {
    throw new Error(`No resources available`);
});

// Start the server
async function runServer() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('screenshot-website-fast MCP server running');

    // Handle graceful shutdown
    const cleanup = async () => {
        console.error('[MCP] Shutting down gracefully...');
        if (screenshotModule) {
            await screenshotModule.closeBrowser();
        }
        process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
}

// Handle unhandled rejections and exceptions
process.on('unhandledRejection', (reason, promise) => {
    console.error('[MCP] Unhandled Rejection at:', promise, 'reason:', reason);
    // Exit with error code to trigger restart
    process.exit(1);
});

process.on('uncaughtException', error => {
    console.error('[MCP] Uncaught Exception:', error);
    // Exit with error code to trigger restart
    process.exit(1);
});

runServer().catch(error => {
    console.error('[MCP] Server error:', error);
    process.exit(1);
});
