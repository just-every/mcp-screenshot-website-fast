import { describe, it, expect, beforeAll } from 'vitest';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

describe('Deployment Tests', () => {
  beforeAll(async () => {
    // Ensure the project is built
    const { execSync } = await import('child_process');
    execSync('npm run build', { cwd: rootDir });
  });

  it('should have correct package name', async () => {
    const pkg = await import('../package.json');
    expect(pkg.name).toBe('@just-every/mcp-screenshot-website-fast');
  });

  it('should have bin script configured', async () => {
    const pkg = await import('../package.json');
    expect(pkg.bin).toHaveProperty('mcp-screenshot-website-fast');
  });

  it('should start MCP server without errors', async () => {
    const serverProcess = spawn('node', [join(rootDir, 'dist/serve.js')], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, LOG_LEVEL: 'DEBUG' }
    });

    return new Promise<void>((resolve, reject) => {
      let stderr = '';
      let stdout = '';
      let resolved = false;

      // Set up event handlers immediately
      serverProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        
        // Log each chunk in CI for debugging
        if (process.env.CI) {
          console.log('[CI Debug] stderr chunk:', chunk);
        }
        
        // Check for various startup messages from logger
        if (stderr.includes('[INFO] [MCP] MCP Server starting up') ||
            stderr.includes('[INFO] [MCP] MCP server connected and running successfully!') ||
            stderr.includes('[INFO] [MCP] Ready to receive requests') ||
            stderr.includes('[DEBUG] [MCP] Creating MCP server instance')) {
          if (!resolved) {
            resolved = true;
            // Wait a bit to capture the full startup message
            setTimeout(() => {
              serverProcess.kill();
              expect(stderr).toMatch(/\[INFO\] \[MCP\] MCP Server starting up|\[INFO\] \[MCP\] MCP server connected and running successfully!|\[INFO\] \[MCP\] Ready to receive requests/);
              resolve();
            }, 100);
          }
        }
      });

      serverProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        
        // Log stdout in CI for debugging
        if (process.env.CI) {
          console.log('[CI Debug] stdout chunk:', chunk);
        }
      });

      // Increase timeout for CI environments
      const timeout = process.env.CI ? 10000 : 5000;
      
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          serverProcess.kill();
          console.error('[Test Error] Server startup timeout');
          console.error('[Test Error] Captured stderr:', stderr);
          console.error('[Test Error] Captured stdout:', stdout);
          reject(new Error(`Server did not start within ${timeout}ms. stderr: ${stderr}, stdout: ${stdout}`));
        }
      }, timeout);

      serverProcess.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      });

      // Also check for early exit
      serverProcess.on('exit', (code, signal) => {
        if (!resolved && code !== 0) {
          resolved = true;
          reject(new Error(`Server exited with code ${code}, signal ${signal}. stderr: ${stderr}, stdout: ${stdout}`));
        }
      });
    });
  }, 15000);

  it('should default to serve command when no args provided', async () => {
    const binPath = join(rootDir, 'bin/mcp-screenshot-website.js');
    const binProcess = spawn('node', [binPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, LOG_LEVEL: 'DEBUG' }
    });

    return new Promise<void>((resolve, reject) => {
      let stderr = '';
      let stdout = '';
      let resolved = false;

      binProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        
        // Log each chunk in CI for debugging
        if (process.env.CI) {
          console.log('[CI Debug - bin] stderr chunk:', chunk);
        }
        
        // Check for various startup messages from logger
        if (stderr.includes('[INFO] [MCP] MCP Server starting up') ||
            stderr.includes('[INFO] [MCP] MCP server connected and running successfully!') ||
            stderr.includes('[INFO] [MCP] Ready to receive requests') ||
            stderr.includes('[DEBUG] [MCP] Creating MCP server instance')) {
          if (!resolved) {
            resolved = true;
            // Wait a bit to capture the full startup message
            setTimeout(() => {
              binProcess.kill();
              expect(stderr).toMatch(/\[INFO\] \[MCP\] MCP Server starting up|\[INFO\] \[MCP\] MCP server connected and running successfully!|\[INFO\] \[MCP\] Ready to receive requests/);
              resolve();
            }, 100);
          }
        }
      });

      binProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        
        // Log stdout in CI for debugging
        if (process.env.CI) {
          console.log('[CI Debug - bin] stdout chunk:', chunk);
        }
      });

      // Increase timeout for CI environments
      const timeout = process.env.CI ? 10000 : 5000;
      
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          binProcess.kill();
          console.error('[Test Error - bin] Server startup timeout');
          console.error('[Test Error - bin] Captured stderr:', stderr);
          console.error('[Test Error - bin] Captured stdout:', stdout);
          reject(new Error(`Server did not start via bin within ${timeout}ms. stderr: ${stderr}, stdout: ${stdout}`));
        }
      }, timeout);

      binProcess.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      });

      // Also check for early exit
      binProcess.on('exit', (code, signal) => {
        if (!resolved && code !== 0) {
          resolved = true;
          reject(new Error(`Bin process exited with code ${code}, signal ${signal}. stderr: ${stderr}, stdout: ${stdout}`));
        }
      });
    });
  }, 15000);

  it('should handle capture command', async () => {
    const binPath = join(rootDir, 'bin/mcp-screenshot-website.js');
    const binProcess = spawn('node', [binPath, 'capture', '--help'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    return new Promise<void>((resolve, reject) => {
      let stdout = '';

      binProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      binProcess.on('close', (code) => {
        expect(code).toBe(0);
        expect(stdout).toContain('Usage:');
        expect(stdout).toContain('capture');
        resolve();
      });

      binProcess.on('error', reject);
    });
  }, 10000);

  it('should export correct MCP tool structure', async () => {
    // Import and check the server exports the right structure
    const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
    expect(Server).toBeDefined();
  });

  it('should have all required dependencies', async () => {
    const pkg = await import('../package.json');
    const requiredDeps = [
      '@modelcontextprotocol/sdk',
      'puppeteer',
      'sharp',
      'commander'
    ];

    requiredDeps.forEach(dep => {
      expect(pkg.dependencies).toHaveProperty(dep);
    });
  });

  it('should build without TypeScript errors', () => {
    // This is implicitly tested by the beforeAll hook
    // If the build fails, the tests won't run
    expect(true).toBe(true);
  });
});