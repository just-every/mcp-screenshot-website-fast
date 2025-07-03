#!/usr/bin/env node

import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration
const MAX_RESTART_ATTEMPTS = 10;
const RESTART_WINDOW_MS = 60000; // 1 minute
const INITIAL_BACKOFF_MS = 1000; // 1 second
const MAX_BACKOFF_MS = 30000; // 30 seconds

// Track restart attempts
let restartAttempts: number[] = [];
let currentBackoff = INITIAL_BACKOFF_MS;

// Log to stderr to avoid stdout conflicts
const log = (level: string, message: string, ...args: any[]) => {
    const timestamp = new Date().toISOString();
    console.error(
        `[${timestamp}] [${level}] [restart-wrapper]`,
        message,
        ...args
    );
};

// Clean up old restart attempts outside the window
const cleanupRestartAttempts = () => {
    const now = Date.now();
    restartAttempts = restartAttempts.filter(
        timestamp => now - timestamp < RESTART_WINDOW_MS
    );
};

// Check if we should restart based on rate limiting
const shouldRestart = (): boolean => {
    cleanupRestartAttempts();

    if (restartAttempts.length >= MAX_RESTART_ATTEMPTS) {
        log(
            'ERROR',
            `Reached maximum restart attempts (${MAX_RESTART_ATTEMPTS}) within ${RESTART_WINDOW_MS}ms`
        );
        return false;
    }

    return true;
};

// Calculate backoff with exponential increase
const getBackoffDelay = (): number => {
    const delay = Math.min(currentBackoff, MAX_BACKOFF_MS);
    currentBackoff = Math.min(currentBackoff * 2, MAX_BACKOFF_MS);
    return delay;
};

// Reset backoff on successful run
const resetBackoff = () => {
    currentBackoff = INITIAL_BACKOFF_MS;
};

// Start the server with restart capability
const startServer = () => {
    log('INFO', 'Starting MCP server...');

    const serverPath = join(__dirname, 'serve.js');
    const child = spawn(process.execPath, [serverPath], {
        stdio: 'inherit',
        env: process.env,
    });

    let shuttingDown = false;
    let restartTimer: NodeJS.Timeout | null = null;

    // Track successful startup
    const startupTimer = setTimeout(() => {
        log('INFO', 'Server started successfully');
        resetBackoff();
    }, 5000);

    child.on('exit', (code, signal) => {
        clearTimeout(startupTimer);

        if (shuttingDown) {
            log('INFO', 'Server stopped gracefully');
            process.exit(0);
            return;
        }

        if (code === 0) {
            log('INFO', 'Server exited cleanly');
            process.exit(0);
            return;
        }

        log('WARN', `Server exited with code ${code}, signal ${signal}`);

        if (!shouldRestart()) {
            log('ERROR', 'Too many restart attempts, giving up');
            process.exit(1);
            return;
        }

        const backoffDelay = getBackoffDelay();
        restartAttempts.push(Date.now());

        log(
            'INFO',
            `Restarting server in ${backoffDelay}ms (attempt ${restartAttempts.length}/${MAX_RESTART_ATTEMPTS})...`
        );

        restartTimer = setTimeout(() => {
            startServer();
        }, backoffDelay);
    });

    child.on('error', error => {
        log('ERROR', 'Failed to start server:', error);
        process.exit(1);
    });

    // Handle shutdown signals
    const shutdown = (signal: string) => {
        if (shuttingDown) return;
        shuttingDown = true;

        log('INFO', `Received ${signal}, shutting down...`);

        if (restartTimer) {
            clearTimeout(restartTimer);
        }

        // Give child process time to shut down gracefully
        child.kill(signal as any);

        setTimeout(() => {
            log('WARN', 'Force killing child process');
            child.kill('SIGKILL');
        }, 5000);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
};

// Handle uncaught exceptions in the wrapper
process.on('uncaughtException', error => {
    log('ERROR', 'Uncaught exception in restart wrapper:', error);
    process.exit(1);
});

process.on('unhandledRejection', reason => {
    log('ERROR', 'Unhandled rejection in restart wrapper:', reason);
    process.exit(1);
});

// Start the server
log('INFO', 'MCP server restart wrapper starting...');
log(
    'INFO',
    `Configuration: max attempts=${MAX_RESTART_ATTEMPTS}, window=${RESTART_WINDOW_MS}ms`
);
startServer();
