import puppeteer, { Browser, Page } from 'puppeteer';
import {
    ScreenshotOptions,
    ScreenshotResult,
    TiledScreenshotResult,
    ScreencastOptions,
    ScreencastResult,
} from '../types.js';
import { logger, LogLevel } from '../utils/logger.js';

// Enable debug logging for screenshot module
logger.setLevel(LogLevel.DEBUG);
logger.debug('Screenshot module loaded');

let browser: Browser | null = null;
let browserLaunchPromise: Promise<Browser> | null = null;
let lastActivityTime: number = Date.now();
let inactivityTimer: NodeJS.Timeout | null = null;

// Configuration
const BROWSER_IDLE_TIMEOUT_MS = 60000; // Close browser after 1 minute of inactivity
const MIN_BROWSER_LIFETIME_MS = 5000; // Keep browser alive for at least 5 seconds

// Browser lifecycle management
function updateActivityTime() {
    lastActivityTime = Date.now();
    resetInactivityTimer();
}

function resetInactivityTimer() {
    // Clear existing timer
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
        inactivityTimer = null;
    }

    // Don't set a new timer if browser is not running
    if (!browser || !browser.isConnected()) {
        return;
    }

    // Set new timer
    inactivityTimer = setTimeout(async () => {
        const timeSinceLastActivity = Date.now() - lastActivityTime;
        const browserAge = Date.now() - lastActivityTime;

        // Only close if browser has been idle long enough and alive long enough
        if (
            timeSinceLastActivity >= BROWSER_IDLE_TIMEOUT_MS &&
            browserAge >= MIN_BROWSER_LIFETIME_MS
        ) {
            logger.info(
                `Browser idle for ${timeSinceLastActivity}ms, closing to save resources...`
            );
            await closeBrowser();
        } else {
            // If not ready to close yet, reset the timer
            resetInactivityTimer();
        }
    }, BROWSER_IDLE_TIMEOUT_MS);

    // Allow process to exit if this is the only thing keeping it alive
    inactivityTimer.unref();
}

async function launchBrowser(): Promise<Browser> {
    logger.info('Launching new browser instance...');
    logger.debug('Puppeteer executable path:', puppeteer.executablePath());
    logger.debug('Browser launch options:', {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '...etc'],
    });

    const newBrowser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection',
            '--disable-default-apps',
            '--no-default-browser-check',
        ],
        ignoreDefaultArgs: ['--enable-automation'],
    });

    logger.info('Browser launched successfully');
    logger.debug('Browser process PID:', newBrowser.process()?.pid);

    // Handle browser disconnection
    newBrowser.on('disconnected', () => {
        logger.warn('Browser disconnected event received');
        logger.debug('Browser instance:', {
            isConnected: newBrowser.isConnected(),
        });
        if (browser === newBrowser) {
            browser = null;
            browserLaunchPromise = null;
        }
    });

    // Start health checking when browser is launched
    startHealthCheck();
    logger.debug('Health check started');

    // Initialize activity tracking
    updateActivityTime();
    logger.debug('Activity tracking initialized');

    return newBrowser;
}

async function getBrowser(forceRestart: boolean = false): Promise<Browser> {
    logger.debug('getBrowser called', { forceRestart, hasBrowser: !!browser });

    // Force restart if requested
    if (forceRestart && browser) {
        logger.info('Force restarting browser...');
        await closeBrowser();
    }

    // Check if we have a connected browser
    if (browser && browser.isConnected()) {
        return browser;
    }

    // If a launch is already in progress, wait for it
    if (browserLaunchPromise) {
        try {
            browser = await browserLaunchPromise;
            if (browser && browser.isConnected()) {
                return browser;
            }
        } catch (error) {
            logger.error('Failed to wait for browser launch:', error);
            browserLaunchPromise = null;
        }
    }

    // Launch a new browser
    try {
        logger.debug('Starting browser launch...');
        browserLaunchPromise = launchBrowser();
        browser = await browserLaunchPromise;
        browserLaunchPromise = null;
        logger.info('Browser obtained successfully');
        return browser;
    } catch (error: any) {
        logger.error('Failed to launch browser:', error.message);
        logger.debug('Browser launch error details:', {
            name: error.name,
            stack: error.stack,
            code: error.code,
        });
        browserLaunchPromise = null;
        browser = null;
        throw error;
    }
}

export async function closeBrowser(): Promise<void> {
    logger.debug('closeBrowser called');
    stopHealthCheck(); // Always stop health check when closing browser

    // Clear inactivity timer
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
        inactivityTimer = null;
    }

    if (browser && browser.isConnected()) {
        logger.info('Closing browser...');
        try {
            await browser.close();
            logger.info('Browser closed successfully');
        } catch (error) {
            logger.error('Error closing browser:', error);
        }
        browser = null;
        browserLaunchPromise = null;
    } else {
        logger.debug('No browser to close or already disconnected');
    }
}

// Periodically check browser health
let healthCheckInterval: NodeJS.Timeout | null = null;

function startHealthCheck() {
    if (healthCheckInterval) return;

    healthCheckInterval = setInterval(async () => {
        if (browser && !browser.isConnected()) {
            logger.warn('Browser health check failed - browser disconnected');
            browser = null;
            browserLaunchPromise = null;
        } else if (browser && browser.isConnected()) {
            try {
                // Check memory usage
                const pages = await browser.pages();
                logger.debug(`Health check: ${pages.length} pages open`);

                // Close any extra pages (keep only the initial blank page)
                if (pages.length > 1) {
                    logger.info(
                        `Closing ${pages.length - 1} unused pages to free memory`
                    );
                    for (let i = 1; i < pages.length; i++) {
                        await pages[i].close().catch(() => {});
                    }
                }
            } catch (error) {
                logger.error('Error during health check:', error);
            }
        }
    }, 30000); // Check every 30 seconds

    // Allow process to exit if this is the only thing keeping it alive
    healthCheckInterval.unref();
}

function stopHealthCheck() {
    if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
        healthCheckInterval = null;
    }
}

async function setupPage(browser: Browser): Promise<Page> {
    logger.debug('Creating new page...');
    const page = await browser.newPage();
    logger.debug('Page created successfully');

    // Configure page settings with longer timeout for problematic sites
    await page.setDefaultNavigationTimeout(60000);
    await page.setDefaultTimeout(60000);

    // Disable unnecessary features that might cause issues
    await page.setJavaScriptEnabled(true);
    await page.setOfflineMode(false);

    // Block unnecessary resources that might cause navigation issues
    await page.setRequestInterception(true);
    page.on('request', request => {
        const resourceType = request.resourceType();
        // Allow navigation and essential resources, block potential problematic ones
        if (['font', 'media'].includes(resourceType)) {
            request.abort();
        } else {
            request.continue();
        }
    });

    // Set up error handlers
    page.on('error', error => {
        logger.error('Page crashed:', error.message);
        logger.debug('Page crash details:', error);
    });

    page.on('pageerror', error => {
        logger.warn('Page JavaScript error:', error.message || error);
    });

    // Handle frame lifecycle events
    page.on('frameattached', frame => {
        logger.debug(`Frame attached: ${frame.url()}`);
    });

    page.on('framedetached', frame => {
        logger.debug(`Frame detached: ${frame.url()}`);
    });

    page.on('framenavigated', frame => {
        logger.debug(`Frame navigated: ${frame.url()}`);
    });

    return page;
}

async function navigateWithRetry(
    page: Page,
    url: string,
    options: ScreenshotOptions,
    browserRestartCallback?: () => Promise<Page>
): Promise<Page> {
    const maxRetries = 3;
    let lastError;
    let currentPage = page;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // Check if page is still valid before attempting navigation
            if (currentPage.isClosed()) {
                logger.warn('Page is closed, attempting to create new page...');
                if (browserRestartCallback) {
                    currentPage = await browserRestartCallback();
                } else {
                    throw new Error(
                        'Page is closed and no recovery callback provided'
                    );
                }
            }

            logger.info(
                `Navigating to ${url} (attempt ${attempt}/${maxRetries})...`
            );

            // Create a promise that rejects if frame gets detached
            const frameDetachedPromise = new Promise<never>((_, reject) => {
                const handler = () =>
                    reject(new Error('Frame detached during navigation'));
                currentPage.once('framedetached', handler);
                // Clean up handler if navigation succeeds
                currentPage.once('load', () =>
                    currentPage.off('framedetached', handler)
                );
            });

            // Race between navigation and frame detachment
            await Promise.race([
                currentPage.goto(url, {
                    waitUntil: options.waitUntil || 'domcontentloaded',
                    timeout: 60000,
                }),
                frameDetachedPromise,
            ]);

            // Check if page is still valid after navigation
            if (currentPage.isClosed()) {
                throw new Error('Page was closed after navigation');
            }

            // Wait a bit to ensure page is stable
            await currentPage.evaluate(
                () => new Promise(resolve => setTimeout(resolve, 100))
            );

            return currentPage; // Success
        } catch (error: any) {
            lastError = error;
            logger.warn(`Navigation attempt ${attempt} failed:`, error.message);

            // Determine if we need a browser restart
            const needsBrowserRestart =
                error.message.includes('Protocol error') ||
                error.message.includes('Target closed') ||
                error.message.includes('Session closed') ||
                error.message.includes('Browser disconnected') ||
                error.message.includes(
                    'Navigation failed because browser has disconnected'
                );

            if (attempt < maxRetries) {
                // Wait before retrying
                await new Promise(resolve =>
                    setTimeout(resolve, 1000 * attempt)
                );

                if (needsBrowserRestart && browserRestartCallback) {
                    logger.info(
                        'Critical error detected, restarting browser...'
                    );
                    try {
                        currentPage = await browserRestartCallback();
                    } catch (restartError) {
                        logger.error(
                            'Failed to restart browser:',
                            restartError
                        );
                        throw restartError;
                    }
                } else if (currentPage.isClosed() && browserRestartCallback) {
                    logger.info('Page closed, creating new page...');
                    currentPage = await browserRestartCallback();
                }
            }
        }
    }

    throw lastError || new Error('Navigation failed after retries');
}

export async function captureScreenshot(
    options: ScreenshotOptions
): Promise<ScreenshotResult | TiledScreenshotResult> {
    logger.info('captureScreenshot called with options:', {
        url: options.url,
        fullPage: options.fullPage,
        viewport: options.viewport,
        waitUntil: options.waitUntil,
        waitFor: options.waitFor,
    });

    // Update activity time when screenshot is requested
    updateActivityTime();

    // Always capture full page with tiling
    if (options.fullPage !== false) {
        logger.debug('Delegating to captureTiledScreenshot');
        return captureTiledScreenshot(options);
    }

    // Viewport-only capture
    logger.info(`Taking viewport screenshot of ${options.url}`);

    let browser: Browser | null = null;
    let page: Page | null = null;
    let attemptCount = 0;
    const maxAttempts = 2;

    while (attemptCount < maxAttempts) {
        try {
            attemptCount++;

            // Get or restart browser
            browser = await getBrowser(attemptCount > 1);
            page = await setupPage(browser);

            // Set viewport
            const viewport = {
                width: options.viewport?.width || 1072,
                height: options.viewport?.height || 1072,
            };
            await page.setViewport(viewport);

            // Create recovery callback
            const recoveryCallback = async (): Promise<Page> => {
                logger.info('Recovering from error, creating new page...');
                browser = await getBrowser(true);
                const newPage = await setupPage(browser);
                await newPage.setViewport(viewport);
                return newPage;
            };

            // Navigate to the page with recovery
            page = await navigateWithRetry(
                page,
                options.url,
                options,
                recoveryCallback
            );

            // Wait additional time if specified
            if (options.waitFor) {
                await page.evaluate(
                    ms => new Promise(resolve => setTimeout(resolve, ms)),
                    options.waitFor
                );
            }

            // Take screenshot
            const screenshot = (await page.screenshot({
                type: 'png',
                fullPage: false,
                encoding: 'binary',
            })) as Buffer;

            const result: ScreenshotResult = {
                url: options.url,
                screenshot,
                timestamp: new Date(),
                viewport,
                format: 'png',
            };

            // Clean up the page after successful capture
            if (page && !page.isClosed()) {
                await page.close().catch(() => {});
            }

            return result;
        } catch (error: any) {
            logger.error(
                `Error taking screenshot (attempt ${attemptCount}/${maxAttempts}):`,
                error
            );

            // Clean up the page
            if (page && !page.isClosed()) {
                await page.close().catch(() => {});
            }

            // If this was our last attempt, throw the error
            if (attemptCount >= maxAttempts) {
                throw error;
            }

            // Otherwise, wait a bit before retrying
            logger.info('Retrying with fresh browser...');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    throw new Error('Failed to capture screenshot after all attempts');
}

// Export browser statistics for monitoring
export function getBrowserStats() {
    return {
        hasBrowser: !!browser,
        isConnected: browser?.isConnected() || false,
        lastActivityTime: new Date(lastActivityTime).toISOString(),
        timeSinceLastActivity: Date.now() - lastActivityTime,
        hasInactivityTimer: !!inactivityTimer,
        idleTimeoutMs: BROWSER_IDLE_TIMEOUT_MS,
    };
}

export async function warmupBrowser(): Promise<void> {
    logger.info('Warming up browser for faster first requests...');
    try {
        // Pre-launch browser to avoid startup delay on first request
        const warmupBrowser = await getBrowser();
        logger.info('Browser warmed up successfully');

        // Optionally create a page and navigate to a simple page to fully warm up
        const page = await warmupBrowser.newPage();
        await page.goto('data:text/html,<html><body>Warmup</body></html>', {
            waitUntil: 'load',
            timeout: 5000,
        });
        await page.close();
        logger.debug('Browser warmup page test completed');
    } catch (error) {
        logger.warn(
            'Browser warmup failed (first request may be slower):',
            error
        );
        // Don't throw - let the server start anyway
    }
}

// Clean up on process exit
process.on('SIGINT', async () => {
    logger.debug('SIGINT received in screenshot module');
    stopHealthCheck();
    await closeBrowser();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.debug('SIGTERM received in screenshot module');
    stopHealthCheck();
    await closeBrowser();
    process.exit(0);
});

process.on('exit', async () => {
    logger.debug('Process exit in screenshot module');
    stopHealthCheck();
    await closeBrowser();
});

// Handle uncaught errors
process.on('uncaughtException', async error => {
    logger.error('Uncaught exception in screenshot module:', error);
    stopHealthCheck();
    await closeBrowser();
    process.exit(1);
});

process.on('unhandledRejection', async error => {
    logger.error('Unhandled rejection in screenshot module:', error);
    stopHealthCheck();
    await closeBrowser();
    process.exit(1);
});

async function captureTiledScreenshot(
    options: ScreenshotOptions
): Promise<TiledScreenshotResult> {
    const tileSize = 1072;

    logger.info(`Taking tiled screenshot of ${options.url}`);

    let browser: Browser | null = null;
    let page: Page | null = null;
    let attemptCount = 0;
    const maxAttempts = 2;

    while (attemptCount < maxAttempts) {
        try {
            attemptCount++;

            // Get or restart browser
            browser = await getBrowser(attemptCount > 1);
            page = await setupPage(browser);

            // Set viewport to capture full width in tile size
            await page.setViewport({
                width: tileSize,
                height: tileSize,
            });

            // Create recovery callback
            const recoveryCallback = async (): Promise<Page> => {
                logger.info('Recovering from error, creating new page...');
                browser = await getBrowser(true);
                const newPage = await setupPage(browser);
                await newPage.setViewport({
                    width: tileSize,
                    height: tileSize,
                });
                return newPage;
            };

            // Navigate to the page with recovery
            page = await navigateWithRetry(
                page,
                options.url,
                options,
                recoveryCallback
            );

            // Wait additional time if specified
            if (options.waitFor) {
                await page.evaluate(
                    ms => new Promise(resolve => setTimeout(resolve, ms)),
                    options.waitFor
                );
            }

            // Take a full page screenshot
            logger.info('Capturing full page screenshot...');
            const fullPageScreenshot = (await page.screenshot({
                type: 'png',
                fullPage: true,
                encoding: 'binary',
            })) as Buffer;

            // Import sharp dynamically to process the image
            const sharp = await import('sharp');
            const metadata = await sharp.default(fullPageScreenshot).metadata();
            const dimensions = {
                width: metadata.width!,
                height: metadata.height!,
            };

            logger.info(
                `Full page dimensions: ${dimensions.width}x${dimensions.height}`
            );

            // Calculate number of tiles needed
            const cols = Math.ceil(dimensions.width / tileSize);
            const rows = Math.ceil(dimensions.height / tileSize);
            const tiles = [];

            logger.info(
                `Creating ${rows}x${cols} tiles (${rows * cols} total)`
            );

            // Cut the full page screenshot into tiles
            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    const x = col * tileSize;
                    const y = row * tileSize;
                    const width = Math.min(tileSize, dimensions.width - x);
                    const height = Math.min(tileSize, dimensions.height - y);

                    // Extract tile from full page screenshot
                    const tileBuffer = await sharp
                        .default(fullPageScreenshot)
                        .extract({
                            left: x,
                            top: y,
                            width,
                            height,
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
                        height,
                    });

                    logger.debug(
                        `Created tile ${row},${col} at ${x},${y} (${width}x${height})`
                    );
                }
            }

            const result: TiledScreenshotResult = {
                url: options.url,
                tiles,
                timestamp: new Date(),
                fullWidth: dimensions.width,
                fullHeight: dimensions.height,
                tileSize,
                format: 'png',
            };

            // Clean up the page after successful capture
            if (page && !page.isClosed()) {
                await page.close().catch(() => {});
            }

            return result;
        } catch (error: any) {
            logger.error(
                `Error taking tiled screenshot (attempt ${attemptCount}/${maxAttempts}):`,
                error
            );

            // Clean up the page
            if (page && !page.isClosed()) {
                await page.close().catch(() => {});
            }

            // If this was our last attempt, throw the error
            if (attemptCount >= maxAttempts) {
                throw error;
            }

            // Otherwise, wait a bit before retrying
            logger.info('Retrying with fresh browser...');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    throw new Error('Failed to capture tiled screenshot after all attempts');
}

export async function captureScreencast(
    options: ScreencastOptions
): Promise<ScreencastResult> {
    logger.info('captureScreencast called with options:', {
        url: options.url,
        duration: options.duration,
        interval: options.interval,
        viewport: options.viewport,
        waitUntil: options.waitUntil,
        waitFor: options.waitFor,
        hasJsEvaluate: !!options.jsEvaluate,
    });

    // Update activity time when screencast is requested
    updateActivityTime();

    const frames: ScreencastResult['frames'] = [];
    const startTime = new Date();

    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
        // Get browser instance
        browser = await getBrowser();
        page = await setupPage(browser);

        // Set viewport (only capture top tile - 1072x1072)
        const viewport = {
            width: options.viewport?.width || 1072,
            height: options.viewport?.height || 1072,
        };
        await page.setViewport(viewport);

        logger.info(`Starting screencast of ${options.url}`);

        // Navigate to the page
        await page.goto(options.url, {
            waitUntil: options.waitUntil || 'domcontentloaded',
            timeout: 60000,
        });

        // Wait additional time if specified
        if (options.waitFor) {
            await page.evaluate(
                ms => new Promise(resolve => setTimeout(resolve, ms)),
                options.waitFor
            );
        }

        // Handle JavaScript execution with configurable screenshot intervals
        let jsInstructionCount = 0;
        const screenshotInterval = options.interval * 1000; // Convert seconds to milliseconds
        const jsExecutionInterval = 1000; // Execute JS instructions every 1 second

        if (options.jsEvaluate) {
            const jsInstructions = Array.isArray(options.jsEvaluate)
                ? options.jsEvaluate
                : [options.jsEvaluate];

            jsInstructionCount = jsInstructions.length;
            logger.info(
                `Processing ${jsInstructionCount} JavaScript instruction(s) with ${screenshotInterval}ms screenshot intervals`
            );

            const startTime = Date.now();
            let nextJsIndex = 0;
            let frameIndex = 0;

            // Run for the duration needed to execute all JS instructions
            const jsDuration = jsInstructions.length * jsExecutionInterval;

            while (Date.now() - startTime < jsDuration) {
                const elapsed = Date.now() - startTime;

                // Check if it's time to execute the next JS instruction
                if (
                    nextJsIndex < jsInstructions.length &&
                    elapsed >= nextJsIndex * jsExecutionInterval
                ) {
                    logger.info(
                        `Executing JavaScript instruction ${nextJsIndex + 1}/${jsInstructions.length}: ${jsInstructions[nextJsIndex].substring(0, 50)}...`
                    );
                    try {
                        await page.evaluate(jsInstructions[nextJsIndex]);
                        logger.debug(
                            `JavaScript instruction ${nextJsIndex + 1} completed`
                        );
                    } catch (error) {
                        logger.error(
                            `JavaScript instruction ${nextJsIndex + 1} failed:`,
                            error
                        );
                        throw new Error(
                            `Failed to execute JavaScript instruction ${nextJsIndex + 1}: ${error}`
                        );
                    }
                    nextJsIndex++;
                }

                // Take screenshot
                const screenshot = (await page.screenshot({
                    type: 'png',
                    fullPage: false,
                    encoding: 'binary',
                })) as Buffer;

                frames.push({
                    screenshot,
                    timestamp: new Date(),
                    index: frameIndex,
                });

                frameIndex++;
                logger.debug(
                    `Captured high-frequency frame ${frameIndex} at ${elapsed}ms`
                );

                // Wait for next screenshot interval
                const nextScreenshotTime =
                    startTime + frameIndex * screenshotInterval;
                const waitTime = Math.max(0, nextScreenshotTime - Date.now());
                if (waitTime > 0) {
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }

            // Update jsInstructionCount to reflect actual frames captured during JS execution
            jsInstructionCount = frameIndex;
        }

        // Calculate remaining time and frames needed at configured intervals
        const remainingDuration =
            options.duration * 1000 - jsInstructionCount * screenshotInterval; // Remaining time in ms
        const remainingFrames = Math.max(
            0,
            Math.floor(remainingDuration / screenshotInterval)
        );

        logger.info(
            `Captured ${jsInstructionCount} frames during JS execution. Capturing ${remainingFrames} additional frames at ${screenshotInterval}ms intervals for remaining ${remainingDuration}ms`
        );

        // Capture remaining frames at configured intervals
        for (let i = 0; i < remainingFrames; i++) {
            const frameStart = Date.now();

            // Take screenshot of viewport (top tile only)
            const screenshot = (await page.screenshot({
                type: 'png',
                fullPage: false,
                encoding: 'binary',
            })) as Buffer;

            const frameIndex = jsInstructionCount + i;
            frames.push({
                screenshot,
                timestamp: new Date(),
                index: frameIndex,
            });

            logger.debug(
                `Captured duration frame ${frameIndex + 1} (${i + 1}/${remainingFrames})`
            );

            // Wait for next interval (if not the last frame)
            if (i < remainingFrames - 1) {
                const elapsed = Date.now() - frameStart;
                const waitTime = Math.max(0, screenshotInterval - elapsed);
                if (waitTime > 0) {
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
        }

        const endTime = new Date();

        const result: ScreencastResult = {
            url: options.url,
            frames,
            startTime,
            endTime,
            duration: options.duration,
            interval: options.interval,
            viewport,
            format: 'png',
        };

        logger.info(`Screencast completed: ${frames.length} frames captured`);

        // Clean up the page after successful capture
        if (page && !page.isClosed()) {
            await page.close().catch(() => {});
        }

        return result;
    } catch (error: any) {
        logger.error('Error capturing screencast:', error);

        // Clean up the page
        if (page && !page.isClosed()) {
            await page.close().catch(() => {});
        }

        throw error;
    }
}
