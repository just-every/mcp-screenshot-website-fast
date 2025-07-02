#!/usr/bin/env node

// Immediate startup logging to stderr for CI debugging
console.error('[serve.ts] Process started, PID:', process.pid);
console.error('[serve.ts] Node version:', process.version);
console.error('[serve.ts] Current directory:', process.cwd());

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
import { logger, LogLevel } from './utils/logger.js';

// Enable debug logging for MCP server
logger.setLevel(LogLevel.DEBUG);
logger.info('MCP Server starting up...');
logger.debug('Node version:', process.version);
logger.debug('Working directory:', process.cwd());
logger.debug('Environment:', { LOG_LEVEL: process.env.LOG_LEVEL });

// Lazy load heavy dependencies
let screenshotModule: any;

logger.debug('Creating MCP server instance...');
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
logger.info('MCP server instance created successfully');

// Tool definition
const SCREENSHOT_TOOL: Tool = {
    name: 'take_screenshot',
    description:
        'Fast, efficient screenshot capture of web pages - optimized for CLI coding tools. Use this after performing updates to web pages to ensure your changes are displayed correctly. Automatically tiles full pages into 1072x1072 chunks for optimal processing.',
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
            fullPage: {
                type: 'boolean',
                description: 'Capture full page screenshot with tiling. If false, only the viewport is captured.',
                default: true,
            },
            waitUntil: {
                type: 'string',
                description:
                    'Wait until event: load, domcontentloaded, networkidle0, networkidle2',
                default: 'domcontentloaded',
            },
            waitForMS: {
                type: 'number',
                description: 'Additional wait time in milliseconds',
            },
            directory: {
                type: 'string',
                description:
                    'Save tiled screenshots to a local directory (returns file paths instead of base64)',
            },
        },
        required: ['url'],
    },
    annotations: {
        title: 'Take Screenshot',
        readOnlyHint: true, // Screenshots don't modify anything
        destructiveHint: false,
        idempotentHint: false, // Each call captures fresh content
        openWorldHint: true, // Interacts with external websites
    },
};

// Resources definitions
const RESOURCES: Resource[] = [];

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.debug('Received ListTools request');
    const response = {
        tools: [SCREENSHOT_TOOL],
    };
    logger.debug(
        'Returning tools:',
        response.tools.map(t => t.name)
    );
    return response;
});

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
    logger.info('Received CallTool request:', request.params.name);
    logger.debug('Request params:', JSON.stringify(request.params, null, 2));

    try {
        if (request.params.name !== 'take_screenshot') {
            const error = `Unknown tool: ${request.params.name}`;
            logger.error(error);
            throw new Error(error);
        }

        // Lazy load the module on first use
        if (!screenshotModule) {
            logger.debug('Lazy loading screenshot module...');
            screenshotModule = await import('./internal/screenshotCapture.js');
            logger.info('Screenshot module loaded successfully');
        }

        const args = request.params.arguments as any;
        logger.info(`Processing screenshot request for URL: ${args.url}`);
        logger.debug('Screenshot parameters:', {
            url: args.url,
            viewport: { width: args.width },
            fullPage: args.fullPage,
            waitUntil: args.waitUntil,
            waitForMS: args.waitForMS,
            directory: args.directory,
        });

        logger.debug('Calling captureScreenshot...');
        const result = await screenshotModule.captureScreenshot({
            url: args.url,
            viewport: {
                width: Math.min(args.width ?? 1072, 1072),
            },
            fullPage: args.fullPage ?? true,
            waitUntil: args.waitUntil ?? 'domcontentloaded',
            waitFor: args.waitForMS,
        });

        logger.info('Screenshot captured successfully');
        logger.debug(
            'Result type:',
            'tiles' in result ? 'TiledScreenshot' : 'RegularScreenshot'
        );

        // If directory is specified, save to disk
        if (args.directory) {
            logger.debug(`Saving screenshots to directory: ${args.directory}`);

            // Ensure directory exists
            if (!existsSync(args.directory)) {
                logger.debug('Creating directory...');
                await mkdir(args.directory, { recursive: true });
                logger.info('Directory created successfully');
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
        logger.error('Error capturing screenshot:', error.message);
        logger.debug('Error stack:', error.stack);
        logger.debug('Error details:', {
            name: error.name,
            code: error.code,
            ...error,
        });
        throw error;
    }
});

// Handle resource listing
server.setRequestHandler(ListResourcesRequestSchema, async () => {
    logger.debug('Received ListResources request');
    return {
        resources: RESOURCES,
    };
});

// Handle resource reading
server.setRequestHandler(ReadResourceRequestSchema, async request => {
    logger.debug('Received ReadResource request:', request.params);
    throw new Error(`No resources available`);
});

// Start the server
async function runServer() {
    try {
        logger.info('Starting MCP server...');
        logger.debug('Creating StdioServerTransport...');

        const transport = new StdioServerTransport();
        logger.debug('Transport created, connecting to server...');

        await server.connect(transport);
        logger.info('MCP server connected and running successfully!');
        logger.info('Ready to receive requests');
        logger.debug('Server details:', {
            name: 'screenshot-website-fast',
            version: '0.1.0',
            pid: process.pid,
        });

        // Handle graceful shutdown
        const cleanup = async (signal: string) => {
            logger.info(`Received ${signal}, shutting down gracefully...`);
            try {
                if (screenshotModule) {
                    logger.debug('Closing browser instance...');
                    await screenshotModule.closeBrowser();
                    logger.info('Browser closed successfully');
                }
                logger.info('Shutdown complete');
                process.exit(0);
            } catch (error) {
                logger.error('Error during cleanup:', error);
                process.exit(1);
            }
        };

        process.on('SIGINT', () => cleanup('SIGINT'));
        process.on('SIGTERM', () => cleanup('SIGTERM'));

        // Log heartbeat every 30 seconds to show server is alive
        setInterval(() => {
            logger.debug('Server heartbeat - still running...');
        }, 30000);
    } catch (error: any) {
        logger.error('Failed to start server:', error.message);
        logger.debug('Startup error details:', error);
        throw error;
    }
}

// Handle unhandled rejections and exceptions
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise);
    logger.error('Rejection reason:', reason);
    logger.debug('Full rejection details:', { reason, promise });
    // Exit with error code to trigger restart
    process.exit(1);
});

process.on('uncaughtException', error => {
    logger.error('Uncaught Exception:', error.message);
    logger.error('Stack trace:', error.stack);
    logger.debug('Full error object:', error);
    // Exit with error code to trigger restart
    process.exit(1);
});

// Log process events
process.on('exit', code => {
    logger.info(`Process exiting with code: ${code}`);
});

process.on('warning', warning => {
    logger.warn('Process warning:', warning.message);
    logger.debug('Warning details:', warning);
});

// Start the server
logger.info('Initializing MCP server...');
runServer().catch(error => {
    logger.error('Fatal server error:', error.message);
    logger.error('Stack trace:', error.stack);
    logger.debug('Full error:', error);
    process.exit(1);
});
