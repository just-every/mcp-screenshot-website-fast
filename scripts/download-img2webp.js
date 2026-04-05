#!/usr/bin/env node

import { mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { createWriteStream, existsSync } from 'fs';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// WebP binary download URLs
const WEBP_URLS = {
    'darwin-arm64':
        'https://storage.googleapis.com/downloads.webmproject.org/releases/webp/libwebp-1.4.0-mac-arm64.tar.gz',
    'darwin-x64':
        'https://storage.googleapis.com/downloads.webmproject.org/releases/webp/libwebp-1.4.0-mac-x86-64.tar.gz',
    'linux-x64':
        'https://storage.googleapis.com/downloads.webmproject.org/releases/webp/libwebp-1.4.0-linux-x86-64.tar.gz',
    'win32-x64':
        'https://storage.googleapis.com/downloads.webmproject.org/releases/webp/libwebp-1.4.0-windows-x64.zip',
};

function getBinaryName(platform) {
    if (platform === 'darwin-arm64') {
        return 'img2webp-darwin';
    }
    if (platform === 'darwin-x64') {
        return 'img2webp-darwin-x64';
    }
    if (platform === 'linux-x64') {
        return 'img2webp-linux';
    }
    if (platform === 'win32-x64') {
        return 'img2webp-win.exe';
    }

    return `img2webp-${platform}`;
}

async function downloadAndExtract(url, platform) {
    console.log(`Downloading WebP tools for ${platform}...`);

    const binDir = join(projectRoot, 'dist', 'bin');
    await mkdir(binDir, { recursive: true });

    const binaryName = getBinaryName(platform);
    const binaryPath = join(binDir, binaryName);
    if (existsSync(binaryPath)) {
        console.log(`✅ Reusing existing img2webp for ${platform}`);
        return;
    }

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download ${url}: ${response.statusText}`);
    }

    if (platform.startsWith('win32')) {
        // Handle ZIP for Windows
        const zipPath = join(binDir, 'webp.zip');
        await pipeline(response.body, createWriteStream(zipPath));

        // Extract using unzip (assuming it's available)
        const { execa } = await import('execa');
        await execa('unzip', [
            '-j',
            zipPath,
            '*/bin/img2webp.exe',
            '-d',
            binDir,
        ]);

        // Rename to standard format
        const { rename, unlink } = await import('fs/promises');
        await rename(
            join(binDir, 'img2webp.exe'),
            join(binDir, 'img2webp-win.exe')
        );
        await unlink(zipPath);
    } else {
        // Handle TAR.GZ for Unix systems
        const tarPath = join(binDir, 'webp.tar.gz');
        await pipeline(response.body, createWriteStream(tarPath));

        // Extract the entire tar to find the binary
        const { execa } = await import('execa');
        const tempExtractDir = join(binDir, 'temp_extract');
        await mkdir(tempExtractDir, { recursive: true });

        try {
            // Extract everything to temp directory
            await execa('tar', ['-xzf', tarPath], { cwd: tempExtractDir });

            // Find the img2webp binary recursively
            const { readdir, stat } = await import('fs/promises');

            async function findBinary(dir) {
                const items = await readdir(dir);
                for (const item of items) {
                    const itemPath = join(dir, item);
                    const stats = await stat(itemPath);

                    if (stats.isDirectory()) {
                        const found = await findBinary(itemPath);
                        if (found) return found;
                    } else if (item === 'img2webp') {
                        return itemPath;
                    }
                }
                return null;
            }

            const binaryPath = await findBinary(tempExtractDir);
            if (!binaryPath) {
                throw new Error('img2webp binary not found in archive');
            }

            // Copy to final location
            const { copyFile, unlink, chmod } = await import('fs/promises');
            const finalPath = join(binDir, binaryName);

            await copyFile(binaryPath, finalPath);
            await chmod(finalPath, '755');

            // Clean up
            await unlink(tarPath);
            await rm(tempExtractDir, { recursive: true, force: true });
        } catch (error) {
            // Clean up on error
            await rm(tempExtractDir, { recursive: true, force: true }).catch(
                () => {}
            );
            throw error;
        }
    }

    console.log(`✅ Downloaded and extracted img2webp for ${platform}`);
}

async function main() {
    try {
        // Determine which platforms to download for
        const platforms = process.argv.slice(2);

        if (platforms.length === 0) {
            // Default: download for current platform
            const platform = process.platform;
            const arch = process.arch;
            const key = `${platform}-${arch}`;

            if (WEBP_URLS[key]) {
                await downloadAndExtract(WEBP_URLS[key], key);
            } else {
                console.error(
                    `No WebP binary available for ${platform}-${arch}`
                );
                process.exit(1);
            }
        } else {
            // Download for specified platforms
            for (const platform of platforms) {
                if (WEBP_URLS[platform]) {
                    await downloadAndExtract(WEBP_URLS[platform], platform);
                } else {
                    console.error(`Unknown platform: ${platform}`);
                    console.log(
                        'Available platforms:',
                        Object.keys(WEBP_URLS).join(', ')
                    );
                    process.exit(1);
                }
            }
        }

        console.log('🎉 All WebP binaries downloaded successfully!');
    } catch (error) {
        console.error(
            '❌ Failed to download WebP binaries:',
            error instanceof Error ? error.message : String(error)
        );
        process.exit(1);
    }
}

main();
