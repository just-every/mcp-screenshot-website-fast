#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const args = process.argv.slice(2);

async function main() {
  // Default to 'serve' if no arguments provided (for MCP usage)
  const command = args[0] || 'serve';
  
  // Check if compiled dist exists
  const distExists = existsSync(join(__dirname, '..', 'dist'));
  
  if (distExists) {
    // Use compiled JavaScript for production (fast startup)
    if (command === 'serve') {
      const servePath = join(__dirname, '..', 'dist', 'serve.js');
      await import(servePath);
    } else {
      const cliPath = join(__dirname, '..', 'dist', 'index.js');
      await import(cliPath);
    }
  } else {
    // Fall back to TypeScript with tsx for development
    try {
      await import('tsx/esm');
      
      if (command === 'serve') {
        const servePath = join(__dirname, '..', 'src', 'serve.ts');
        await import(servePath);
      } else {
        const cliPath = join(__dirname, '..', 'src', 'index.ts');
        await import(cliPath);
      }
    } catch (error) {
      console.error('Error: Development dependencies not installed. Please run "npm install" first.');
      process.exit(1);
    }
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});