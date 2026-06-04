import { describe, expect, it } from 'vitest';
import {
    captureConsole,
    captureScreenshot,
    captureScreencast,
    captureSelectorScreenshot,
} from '../src/internal/screenshotCapture.js';
import { assertSafeCaptureUrl } from '../src/internal/urlSecurity.js';

describe('capture URL security', () => {
    it.each([
        'file:///etc/passwd',
        'data:text/html,<h1>blocked</h1>',
        'javascript:alert(1)',
        'chrome://version',
        'about:blank',
        'ftp://example.com/file.txt',
    ])('rejects non-http URL scheme %s', async url => {
        await expect(assertSafeCaptureUrl(url)).rejects.toThrow(
            /Blocked unsafe capture URL/
        );
    });

    it.each([
        'http://localhost',
        'http://127.0.0.1',
        'http://0.0.0.0',
        'http://10.0.0.1',
        'http://172.16.0.1',
        'http://192.168.1.10',
        'http://169.254.169.254',
        'http://[::1]',
        'http://[::ffff:127.0.0.1]',
        'http://[::ffff:7f00:1]',
        'http://[fc00::1]',
        'http://[fe80::1]',
    ])('rejects private or local destination %s', async url => {
        await expect(assertSafeCaptureUrl(url)).rejects.toThrow(
            /Blocked unsafe capture URL/
        );
    });

    it('allows public http and https URLs', async () => {
        await expect(assertSafeCaptureUrl('https://example.com')).resolves.toBe(
            undefined
        );
        await expect(assertSafeCaptureUrl('http://example.com')).resolves.toBe(
            undefined
        );
    });

    it('rejects unsafe URLs at each capture entrypoint', async () => {
        await expect(
            captureConsole({ url: 'file:///etc/passwd' })
        ).rejects.toThrow(/Blocked unsafe capture URL/);
        await expect(
            captureScreenshot({ url: 'http://127.0.0.1' })
        ).rejects.toThrow(/Blocked unsafe capture URL/);
        await expect(
            captureSelectorScreenshot({
                url: 'data:text/html,<h1>blocked</h1>',
                selector: 'h1',
            })
        ).rejects.toThrow(/Blocked unsafe capture URL/);
        await expect(
            captureScreencast({
                url: 'http://169.254.169.254',
                duration: 1,
                interval: 1,
            })
        ).rejects.toThrow(/Blocked unsafe capture URL/);
    });
});
