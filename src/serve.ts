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

// Tool definitions
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
                description:
                    'Capture full page screenshot with tiling. If false, only the viewport is captured.',
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

const SCREENCAST_TOOL: Tool = {
    name: 'take_screencast',
    description:
        'Capture a series of screenshots of a web page over time, producing a screencast. Captures screenshots at 100ms intervals for smooth animation. PNG format: individual frames. WebP format: animated WebP with 4-second pause at end for looping.',
    inputSchema: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description: 'HTTP/HTTPS URL to capture',
            },
            duration: {
                type: 'number',
                description: 'Total duration of screencast in seconds',
                default: 10,
            },
            height: {
                type: 'number',
                description: 'Viewport height in pixels (max 1072)',
                default: 1072,
            },
            jsEvaluate: {
                oneOf: [
                    {
                        type: 'string',
                        description:
                            'Single JavaScript code to execute after the first screenshot',
                    },
                    {
                        type: 'array',
                        items: { type: 'string' },
                        description:
                            'Array of JavaScript instructions - screenshot taken before each one',
                    },
                ],
                description:
                    'JavaScript code to execute. String: single instruction after first screenshot. Array: takes screenshot before each instruction, then continues capturing until duration ends.',
            },
            waitUntil: {
                type: 'string',
                description:
                    'Wait until event: load, domcontentloaded, networkidle0, networkidle2',
                default: 'domcontentloaded',
            },
            directory: {
                type: 'string',
                description:
                    'Save screencast to directory. Specify format with "format" parameter.',
            },
            format: {
                type: 'string',
                description:
                    'Output format when using directory: "png" for individual PNG files, "webp" for animated WebP (default)',
                enum: ['png', 'webp'],
                default: 'webp',
            },
        },
        required: ['url'],
    },
    annotations: {
        title: 'Take Screencast',
        readOnlyHint: true, // Screencasts don't modify anything
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
        tools: [SCREENSHOT_TOOL, SCREENCAST_TOOL],
    };
    logger.debug(
        'Returning tools:',
        response.tools.map(t => t.name)
    );
    return response;
});

// Helper function to generate unique filename
function generateFilename(
    url: string,
    index?: number,
    prefix: string = 'screenshot'
): string {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/[^a-z0-9]/gi, '_');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const suffix = index !== undefined ? `_frame${index + 1}` : '';
    return `${prefix}_${hostname}_${timestamp}${suffix}.png`;
}

// Helper function to create animated WebP using img2webp CLI
async function createAnimatedWebP(
    frames: Buffer[],
    delay: number,
    endDelay?: number
): Promise<Buffer> {
    const { writeFile, readFile, rm } = await import('fs/promises');
    const { join, dirname } = await import('path');
    const { tmpdir } = await import('os');
    const { randomUUID, createHash } = await import('crypto');
    const { execa } = await import('execa');
    const { fileURLToPath } = await import('url');

    // Get directory path for ES modules
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    // Select the correct binary based on platform
    const platform = process.platform;
    const binaryName =
        platform === 'darwin' ? 'img2webp-darwin' : 'img2webp-linux';
    const IMG2WEBP = join(__dirname, 'bin', binaryName);

    // Create a temporary directory
    const tempDir = join(tmpdir(), `webp-${randomUUID()}`);
    await mkdir(tempDir, { recursive: true });

    try {
        // Collapse duplicate frames to avoid bloat
        const uniqueFrames: { buf: Buffer; duration: number; hash: string }[] =
            [];
        for (const buf of frames) {
            const hash = createHash('sha1').update(buf).digest('hex');
            const lastFrame = uniqueFrames[uniqueFrames.length - 1];

            if (lastFrame && hash === lastFrame.hash) {
                // Extend duration of the last frame if it's a duplicate
                lastFrame.duration += delay;
            } else {
                // Add new unique frame
                uniqueFrames.push({ buf, duration: delay, hash });
            }
        }

        // Apply end delay to the last frame if specified
        if (endDelay && uniqueFrames.length > 0) {
            uniqueFrames[uniqueFrames.length - 1].duration = endDelay;
        }

        // Write PNG frames to temp directory
        await Promise.all(
            uniqueFrames.map((frame, i) =>
                writeFile(join(tempDir, `f${i}.png`), frame.buf)
            )
        );

        // Build CLI arguments
        const args = [
            '-min_size', // Minimize size
            '-mixed', // Use mixed compression
            '-loop',
            '0', // Loop infinitely
            '-q',
            '60', // Quality 60
            '-m',
            '6', // Compression method 6
        ];

        // Add each frame with its duration
        uniqueFrames.forEach((frame, i) => {
            args.push('-d', String(frame.duration), `f${i}.png`);
        });

        // Output file
        args.push('-o', 'out.webp');

        // Execute img2webp
        await execa(IMG2WEBP, args, { cwd: tempDir });

        // Read the result
        const result = await readFile(join(tempDir, 'out.webp'));

        // Clean up
        await rm(tempDir, { recursive: true, force: true });

        return result;
    } catch (error) {
        // Clean up on error
        await rm(tempDir, { recursive: true, force: true }).catch(() => {});
        throw error;
    }
}

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async request => {
    logger.info('Received CallTool request:', request.params.name);
    logger.debug('Request params:', JSON.stringify(request.params, null, 2));

    try {
        if (request.params.name === 'take_screenshot') {
            // Lazy load the module on first use
            if (!screenshotModule) {
                logger.debug('Lazy loading screenshot module...');
                screenshotModule = await import(
                    './internal/screenshotCapture.js'
                );
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
                logger.debug(
                    `Saving screenshots to directory: ${args.directory}`
                );

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
                    const base64Screenshot =
                        result.screenshot.toString('base64');

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
        } else if (request.params.name === 'take_screencast') {
            // Lazy load the module on first use
            if (!screenshotModule) {
                logger.debug('Lazy loading screenshot module...');
                screenshotModule = await import(
                    './internal/screenshotCapture.js'
                );
                logger.info('Screenshot module loaded successfully');
            }

            const args = request.params.arguments as any;
            logger.info(`Processing screencast request for URL: ${args.url}`);

            const duration = args.duration ?? 10;
            const format = args.format ?? 'webp';
            const height = Math.min(args.height ?? 1072, 1072); // Cap at 1072
            // WebP captures every 1 second, PNG captures every 2 seconds
            const interval = args.directory && format === 'webp' ? 1 : 2;

            logger.debug('Screencast parameters:', {
                url: args.url,
                duration,
                interval,
                height,
                waitUntil: args.waitUntil,
                jsEvaluate: args.jsEvaluate
                    ? Array.isArray(args.jsEvaluate)
                        ? `array(${args.jsEvaluate.length})`
                        : 'string'
                    : 'none',
                directory: args.directory,
                format,
            });

            logger.debug('Calling captureScreencast...');
            const result = await screenshotModule.captureScreencast({
                url: args.url,
                duration,
                interval,
                viewport: {
                    width: 1072,
                    height: height,
                },
                waitUntil: args.waitUntil ?? 'domcontentloaded',
                waitFor: undefined, // Removed waitForMS
                jsEvaluate: args.jsEvaluate,
            });

            logger.info('Screencast captured successfully');
            logger.debug(`Captured ${result.frames.length} frames`);

            // If directory is specified, save based on format
            if (args.directory) {
                logger.debug(
                    `Saving screencast to directory: ${args.directory} (format: ${format})`
                );

                // Ensure directory exists
                if (!existsSync(args.directory)) {
                    logger.debug('Creating directory...');
                    await mkdir(args.directory, { recursive: true });
                    logger.info('Directory created successfully');
                }

                const frames = result.frames.map((f: any) => f.screenshot);

                if (format === 'png') {
                    // Save individual PNG frames only
                    const framePaths: string[] = [];
                    for (let i = 0; i < result.frames.length; i++) {
                        const frameFilename = generateFilename(
                            args.url,
                            i,
                            'frame'
                        );
                        const frameFilepath = join(
                            args.directory,
                            frameFilename
                        );
                        await writeFile(
                            frameFilepath,
                            result.frames[i].screenshot
                        );
                        framePaths.push(frameFilepath);
                    }

                    return {
                        content: [
                            {
                                type: 'text',
                                text: `✅ Screencast saved as PNG frames:\n${framePaths.join('\n')}\n\nDuration: ${result.duration}s\nFrames: ${result.frames.length}\nInterval: ${interval}s`,
                            },
                        ],
                    };
                } else {
                    // Save as animated WebP and clean up PNGs
                    let webpBuffer: Buffer | null = null;

                    try {
                        // Create animated WebP using img2webp (100ms intervals for ultra-smooth animation)
                        webpBuffer = await createAnimatedWebP(
                            frames,
                            100,
                            4000
                        );
                        logger.info('WebP created using img2webp CLI');
                    } catch (error) {
                        logger.error('Failed to create WebP:', error);
                        webpBuffer = null;
                    }

                    if (webpBuffer) {
                        const filename = generateFilename(
                            args.url,
                            undefined,
                            'screencast'
                        ).replace('.png', '.webp');
                        const filepath = join(args.directory, filename);
                        await writeFile(filepath, webpBuffer);

                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `✅ Screencast saved as animated WebP: ${filepath}\n\nDuration: ${result.duration}s\nFrames: ${result.frames.length}\nCapture Interval: 100ms (4s pause at end)\nMethod: img2webp (optimized with frame deduplication)`,
                                },
                            ],
                        };
                    } else {
                        // Fallback to PNG frames if WebP fails
                        const framePaths: string[] = [];
                        for (let i = 0; i < result.frames.length; i++) {
                            const frameFilename = generateFilename(
                                args.url,
                                i,
                                'frame'
                            );
                            const frameFilepath = join(
                                args.directory,
                                frameFilename
                            );
                            await writeFile(
                                frameFilepath,
                                result.frames[i].screenshot
                            );
                            framePaths.push(frameFilepath);
                        }

                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `⚠️  WebP creation failed, saved as PNG frames:\n${framePaths.join('\n')}\n\nDuration: ${result.duration}s\nFrames: ${result.frames.length}\nInterval: ${interval}s`,
                                },
                            ],
                        };
                    }
                }
            } else {
                // Return frames as base64 encoded images
                const content = [];

                // Add each frame as an image
                for (let i = 0; i < result.frames.length; i++) {
                    content.push({
                        type: 'image',
                        data: result.frames[i].screenshot.toString('base64'),
                        mimeType: 'image/png',
                    });
                }

                // Add summary text
                content.push({
                    type: 'text',
                    text: `✅ Captured ${result.frames.length} frames over ${result.duration} seconds (${result.interval}s interval)`,
                });

                return { content };
            }
        } else {
            const error = `Unknown tool: ${request.params.name}`;
            logger.error(error);
            throw new Error(error);
        }
    } catch (error: any) {
        logger.error('Error in tool execution:', error.message);
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
        const heartbeatInterval = setInterval(() => {
            logger.debug('Server heartbeat - still running...');
            // Log browser stats if module is loaded
            if (screenshotModule && screenshotModule.getBrowserStats) {
                const stats = screenshotModule.getBrowserStats();
                logger.debug('Browser stats:', stats);
            }
        }, 30000);

        // Allow process to exit if this is the only thing keeping it alive
        heartbeatInterval.unref();
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
