#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RESTART_DELAY = 5000; // 5 seconds
const MAX_RESTART_ATTEMPTS = 10;
const RESTART_WINDOW = 60000; // 1 minute

let restartAttempts = 0;
let lastRestartTime = Date.now();

function log(message: string) {
    console.error(`[MCP Supervisor] ${new Date().toISOString()} - ${message}`);
}

function startServer(): void {
    // Reset restart counter if enough time has passed
    if (Date.now() - lastRestartTime > RESTART_WINDOW) {
        restartAttempts = 0;
    }

    if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
        log(
            `Max restart attempts (${MAX_RESTART_ATTEMPTS}) reached within ${RESTART_WINDOW / 1000}s. Exiting.`
        );
        process.exit(1);
    }

    restartAttempts++;
    lastRestartTime = Date.now();

    log(
        `Starting MCP server (attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS})`
    );

    // Use tsx to run the TypeScript file directly
    const serverPath = join(__dirname, 'serve.ts');
    const child = spawn('tsx', [serverPath], {
        stdio: ['inherit', 'inherit', 'inherit'],
        env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'production' },
    });

    child.on('exit', (code, signal) => {
        if (code === 0) {
            log('MCP server exited cleanly');
            process.exit(0);
        } else {
            log(`MCP server crashed with code ${code} and signal ${signal}`);
            log(`Restarting in ${RESTART_DELAY / 1000} seconds...`);
            setTimeout(startServer, RESTART_DELAY);
        }
    });

    child.on('error', error => {
        log(`Failed to start MCP server: ${error.message}`);
        log(`Restarting in ${RESTART_DELAY / 1000} seconds...`);
        setTimeout(startServer, RESTART_DELAY);
    });

    // Forward signals to child process
    process.on('SIGINT', () => {
        log('Received SIGINT, shutting down...');
        child.kill('SIGINT');
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        log('Received SIGTERM, shutting down...');
        child.kill('SIGTERM');
        process.exit(0);
    });
}

// Start the server
startServer();
