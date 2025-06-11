import puppeteer, { Browser } from 'puppeteer';
import { ScreenshotOptions, ScreenshotResult, TiledScreenshotResult } from '../types.js';
import { logger } from '../utils/logger.js';

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    });
  }
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

export async function captureScreenshot(options: ScreenshotOptions): Promise<ScreenshotResult | TiledScreenshotResult> {
  // Always capture full page with tiling
  if (options.fullPage !== false) {
    return captureTiledScreenshot(options);
  }
  
  // Viewport-only capture (when explicitly disabled)
  logger.info(`Taking viewport screenshot of ${options.url}`);
  
  const browser = await getBrowser();
  const page = await browser.newPage();
  
  try {
    // Set viewport to optimal size for Claude Vision API
    const viewport = {
      width: options.viewport?.width || 1072,
      height: options.viewport?.height || 1072
    };
    await page.setViewport(viewport);
    
    // Navigate to the page
    await page.goto(options.url, {
      waitUntil: options.waitUntil || 'networkidle2',
      timeout: 30000
    });
    
    // Wait additional time if specified
    if (options.waitFor) {
      await page.evaluate((ms) => new Promise(resolve => setTimeout(resolve, ms)), options.waitFor);
    }
    
    // Take screenshot
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false,
      encoding: 'binary'
    }) as Buffer;
    
    const result: ScreenshotResult = {
      url: options.url,
      screenshot,
      timestamp: new Date(),
      viewport,
      format: 'png'
    };
    
    return result;
  } finally {
    await page.close();
  }
}

// Clean up on process exit
process.on('SIGINT', async () => {
  await closeBrowser();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeBrowser();
  process.exit(0);
});

async function captureTiledScreenshot(options: ScreenshotOptions): Promise<TiledScreenshotResult> {
  const tileSize = 1072;
  
  logger.info(`Taking tiled screenshot of ${options.url}`);
  
  const browser = await getBrowser();
  const page = await browser.newPage();
  
  try {
    // Set viewport to capture full width in tile size
    await page.setViewport({
      width: tileSize,
      height: tileSize
    });
    
    // Navigate to the page
    await page.goto(options.url, {
      waitUntil: options.waitUntil || 'networkidle2',
      timeout: 30000
    });
    
    // Wait additional time if specified
    if (options.waitFor) {
      await page.evaluate((ms) => new Promise(resolve => setTimeout(resolve, ms)), options.waitFor);
    }
    
    // Take a full page screenshot
    logger.info('Capturing full page screenshot...');
    const fullPageScreenshot = await page.screenshot({
      type: 'png',
      fullPage: true,
      encoding: 'binary'
    }) as Buffer;
    
    // Import sharp dynamically to process the image
    const sharp = await import('sharp');
    const metadata = await sharp.default(fullPageScreenshot).metadata();
    const dimensions = {
      width: metadata.width!,
      height: metadata.height!
    };
    
    logger.info(`Full page dimensions: ${dimensions.width}x${dimensions.height}`);
    
    // Calculate number of tiles needed
    const cols = Math.ceil(dimensions.width / tileSize);
    const rows = Math.ceil(dimensions.height / tileSize);
    const tiles = [];
    
    logger.info(`Creating ${rows}x${cols} tiles (${rows * cols} total)`);
    
    // Cut the full page screenshot into tiles
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * tileSize;
        const y = row * tileSize;
        const width = Math.min(tileSize, dimensions.width - x);
        const height = Math.min(tileSize, dimensions.height - y);
        
        // Extract tile from full page screenshot
        const tileBuffer = await sharp.default(fullPageScreenshot)
          .extract({
            left: x,
            top: y,
            width,
            height
          })
          .png()
          .toBuffer();
        
        tiles.push({
          screenshot: tileBuffer,
          index: row * cols + col,
          row,
          col,
          x,
          y,
          width,
          height
        });
        
        logger.debug(`Created tile ${row},${col} at ${x},${y} (${width}x${height})`);
      }
    }
    
    const result: TiledScreenshotResult = {
      url: options.url,
      tiles,
      timestamp: new Date(),
      fullWidth: dimensions.width,
      fullHeight: dimensions.height,
      tileSize,
      format: 'png'
    };
    
    return result;
  } finally {
    await page.close();
  }
}