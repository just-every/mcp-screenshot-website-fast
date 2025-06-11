#!/usr/bin/env node

import { Command } from 'commander';
import { captureScreenshot, closeBrowser } from './internal/screenshotCapture.js';
import { ScreenshotOptions, TiledScreenshotResult } from './types.js';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json for version
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf-8')
);

const program = new Command();

program
  .name('mcp-screenshot')
  .description('Fast screenshot capture tool for web pages - optimized for Claude Vision API')
  .version(packageJson.version);

program
  .command('capture <url>')
  .description('Capture a screenshot of a URL')
  .option('-w, --width <pixels>', 'Viewport width (max 1072)', '1072')
  .option('-h, --height <pixels>', 'Viewport height (max 1072)', '1072')
  .option('--no-full-page', 'Disable full page capture and tiling')
  .option('--wait-until <event>', 'Wait until event: load, domcontentloaded, networkidle0, networkidle2', 'domcontentloaded')
  .option('--wait-for <ms>', 'Additional wait time in milliseconds')
  .option('-o, --output <path>', 'Output file path (required for tiled output)')
  .action(async (url: string, options) => {
    try {
      const screenshotOptions: ScreenshotOptions = {
        url,
        viewport: {
          width: Math.min(parseInt(options.width, 10), 1072),
          height: Math.min(parseInt(options.height, 10), 1072)
        },
        fullPage: options.fullPage !== false,  // Default to true unless explicitly disabled
        waitUntil: options.waitUntil,
        waitFor: options.waitFor ? parseInt(options.waitFor, 10) : undefined
      };

      console.error(`Capturing screenshot of ${url}...`);
      const result = await captureScreenshot(screenshotOptions);

      if ('tiles' in result) {
        // Handle tiled screenshot
        const tiledResult = result as TiledScreenshotResult;
        console.error(`✅ Screenshot captured successfully!`);
        console.error(`📐 Full page dimensions: ${tiledResult.fullWidth}x${tiledResult.fullHeight}`);
        console.error(`🔲 Created ${tiledResult.tiles.length} tiles of ${tiledResult.tileSize}x${tiledResult.tileSize} each`);
        
        if (options.output) {
          // Save tiles with numbered filenames
          const ext = '.png';
          const base = options.output.endsWith(ext) ? options.output.slice(0, -ext.length) : options.output;
          
          for (const tile of tiledResult.tiles) {
            const filename = `${base}-tile-${tile.row}-${tile.col}${ext}`;
            writeFileSync(filename, tile.screenshot);
            console.error(`Saved tile ${tile.row},${tile.col} to: ${filename} (${tile.width}x${tile.height})`);
          }
        } else {
          console.error('Error: Full page tiled output requires -o/--output flag');
          process.exit(1);
        }
      } else {
        // Handle regular screenshot
        if (options.output) {
          writeFileSync(options.output, result.screenshot);
          console.error(`✅ Screenshot saved to: ${options.output}`);
          console.error(`📐 Dimensions: ${result.viewport.width}x${result.viewport.height}`);
        } else {
          // Output binary data to stdout
          process.stdout.write(result.screenshot);
        }
      }

      await closeBrowser();
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      await closeBrowser();
      process.exit(1);
    }
  });

program
  .command('serve')
  .description('Run as an MCP server')
  .action(async () => {
    // Import and run the serve module
    await import('./serve.js');
  });

program.parse();