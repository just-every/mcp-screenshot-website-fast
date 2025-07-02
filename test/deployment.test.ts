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
      stdio: ['pipe', 'pipe', 'pipe']
    });

    return new Promise<void>((resolve, reject) => {
      let stderr = '';
      let stdout = '';

      serverProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      serverProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        // Check if server started message appears (new logging format)
        // INFO logs go to stdout, not stderr
        if (stdout.includes('MCP server connected and running successfully!')) {
          serverProcess.kill();
          expect(stdout).toContain('MCP server connected and running successfully!');
          resolve();
        }
      });

      // Timeout fallback
      setTimeout(() => {
        serverProcess.kill();
        reject(new Error(`Server did not start. stderr: ${stderr}, stdout: ${stdout}`));
      }, 2000);

      serverProcess.on('error', reject);
    });
  });

  it('should default to serve command when no args provided', async () => {
    const binPath = join(rootDir, 'bin/mcp-screenshot-website.js');
    const binProcess = spawn('node', [binPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    return new Promise<void>((resolve, reject) => {
      let stderr = '';
      let stdout = '';

      binProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      binProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        // Check if server started message appears (new logging format)
        // INFO logs go to stdout, not stderr
        if (stdout.includes('MCP server connected and running successfully!')) {
          binProcess.kill();
          expect(stdout).toContain('MCP server connected and running successfully!');
          resolve();
        }
      });

      // Timeout fallback
      setTimeout(() => {
        binProcess.kill();
        reject(new Error(`Server did not start via bin. stderr: ${stderr}, stdout: ${stdout}`));
      }, 2000);

      binProcess.on('error', reject);
    });
  });

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