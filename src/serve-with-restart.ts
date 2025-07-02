#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Enable debug logging
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'debug';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RESTART_DELAY = 5000; // 5 seconds
const MAX_RESTART_ATTEMPTS = 10;
const RESTART_WINDOW = 60000; // 1 minute

let restartAttempts = 0;
let lastRestartTime = Date.now();

function log(message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const prefix = `[MCP Supervisor] ${timestamp} -`;
    if (data) {
        console.error(prefix, message, JSON.stringify(data, null, 2));
    } else {
        console.error(prefix, message);
    }
}

function startServer(): void {
    log('startServer called');
    log('Environment:', {
        NODE_ENV: process.env.NODE_ENV,
        LOG_LEVEL: process.env.LOG_LEVEL,
        cwd: process.cwd(),
        nodeVersion: process.version,
    });

    // Reset restart counter if enough time has passed
    if (Date.now() - lastRestartTime > RESTART_WINDOW) {
        log('Resetting restart counter (window expired)');
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
    log('Starting child process:', { serverPath, command: 'tsx' });

    const child = spawn('tsx', [serverPath], {
        stdio: ['inherit', 'inherit', 'inherit'],
        env: {
            ...process.env,
            NODE_ENV: process.env.NODE_ENV || 'production',
            LOG_LEVEL: process.env.LOG_LEVEL || 'debug',
        },
    });

    log('Child process spawned', { pid: child.pid });

    child.on('exit', (code, signal) => {
        log('Child process exited', { code, signal, pid: child.pid });

        if (code === 0) {
            log('MCP server exited cleanly');
            process.exit(0);
        } else {
            log(`MCP server crashed with code ${code} and signal ${signal}`);
            log(`Restarting in ${RESTART_DELAY / 1000} seconds...`);
            setTimeout(startServer, RESTART_DELAY);
        }
    });

    child.on('error', (error: any) => {
        log('Failed to start MCP server', {
            message: error.message,
            code: error.code,
            stack: error.stack,
        });
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

// Log startup
log('MCP Supervisor starting...', {
    args: process.argv,
    env: {
        NODE_ENV: process.env.NODE_ENV,
        LOG_LEVEL: process.env.LOG_LEVEL,
    },
});

// Start the server
startServer();
