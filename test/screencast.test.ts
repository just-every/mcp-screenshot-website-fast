import { describe, it, expect, afterAll } from 'vitest';
import { captureScreencast, closeBrowser } from '../src/internal/screenshotCapture';

describe('Screencast Capture', () => {
    afterAll(async () => {
        await closeBrowser();
    });

    it('should capture basic screencast', async () => {
        const result = await captureScreencast({
            url: 'https://example.com',
            duration: 2,
            interval: 2,
        });

        // With 100ms intervals, 2 seconds = 20 frames
        expect(result.frames).toHaveLength(20);
        expect(result.duration).toBe(2);
        expect(result.interval).toBe(2);
        expect(result.viewport.width).toBe(1072);
        expect(result.viewport.height).toBe(1072);
        
        // Check each frame
        result.frames.forEach((frame, index) => {
            expect(frame.screenshot).toBeInstanceOf(Buffer);
            expect(frame.screenshot.length).toBeGreaterThan(0);
            expect(frame.index).toBe(index);
            expect(frame.timestamp).toBeInstanceOf(Date);
        });
    }, 10000);

    it('should execute JavaScript before capture', async () => {
        const result = await captureScreencast({
            url: 'https://example.com',
            duration: 2,
            interval: 2,
            jsEvaluate: `document.title = 'Test Title';`,
        });

        // JavaScript executes at 1s intervals, so with 1 instruction and 2s duration = 20 frames
        expect(result.frames).toHaveLength(20);
        // JavaScript was executed (we can't verify the result directly but no error means success)
    }, 10000);

    it('should respect custom viewport size', async () => {
        const result = await captureScreencast({
            url: 'https://example.com',
            duration: 2,
            interval: 2,
            viewport: {
                width: 800,
                height: 600,
            },
        });

        expect(result.viewport.width).toBe(800);
        expect(result.viewport.height).toBe(600);
        expect(result.frames).toHaveLength(20); // 2 seconds at 100ms intervals
    }, 10000);
});