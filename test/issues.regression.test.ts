import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { closeBrowser } from '../src/internal/screenshotCapture.js';
import { toImportSpecifier } from '../bin/import-path.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const selectorFixtureUrl = `data:text/html,${encodeURIComponent(`
<!doctype html>
<html>
  <head>
    <style>
      body {
        margin: 0;
        padding: 24px;
        background: #f4efe4;
      }

      #target {
        width: 180px;
        height: 90px;
        background: linear-gradient(135deg, #184e77, #f4a261);
        border: 6px solid #1d3557;
        box-sizing: border-box;
      }
    </style>
  </head>
  <body>
    <div id="target"></div>
  </body>
</html>
`)}`;

beforeAll(async () => {
    execSync('npm run build', { cwd: rootDir });
}, 30000);

afterAll(async () => {
    await closeBrowser();
});

async function createClient() {
    const transport = new StdioClientTransport({
        command: 'node',
        args: [join(rootDir, 'dist', 'serve.js')],
        cwd: rootDir,
        stderr: 'pipe',
    });
    const client = new Client({
        name: 'issue-regression-test',
        version: '0.0.0',
    });

    await client.connect(transport);

    return { client, transport };
}

describe('Issue regressions', () => {
    it('converts Windows absolute paths into file URL import specifiers', () => {
        expect(toImportSpecifier('D:\\repo\\dist\\serve-restart.js')).toBe(
            'file:///D:/repo/dist/serve-restart.js'
        );
    });

    it('advertises capture_selector in the MCP tool list', async () => {
        const { client, transport } = await createClient();

        try {
            const result = await client.listTools();
            expect(result.tools.map(tool => tool.name)).toContain(
                'capture_selector'
            );
        } finally {
            await transport.close();
        }
    }, 30000);

    it('captures a selector through the MCP tool', async () => {
        const { client, transport } = await createClient();

        try {
            const result = await client.callTool({
                name: 'capture_selector',
                arguments: {
                    url: selectorFixtureUrl,
                    selector: '#target',
                    width: 500,
                    height: 300,
                    waitUntil: 'load',
                },
            });
            const imageContent = result.content.find(
                item => item.type === 'image'
            );

            expect(imageContent).toBeDefined();
            expect(imageContent?.type).toBe('image');

            const metadata = await sharp(
                Buffer.from((imageContent as { data: string }).data, 'base64')
            ).metadata();

            expect(metadata.width).toBe(180);
            expect(metadata.height).toBe(90);
        } finally {
            await transport.close();
        }
    }, 30000);

    it('reports a helpful error when the selector cannot be found', async () => {
        const { client, transport } = await createClient();

        try {
            await expect(
                client.callTool({
                    name: 'capture_selector',
                    arguments: {
                        url: selectorFixtureUrl,
                        selector: '#missing',
                        selectorTimeoutMS: 500,
                        waitUntil: 'load',
                    },
                })
            ).rejects.toThrow(/#missing/);
        } finally {
            await transport.close();
        }
    }, 30000);
});
