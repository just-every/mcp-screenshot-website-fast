#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const args = process.argv.slice(2);

async function main() {
  // Check if compiled dist exists
  const distExists = existsSync(join(__dirname, '..', 'dist'));
  
  if (distExists) {
    // Use compiled JavaScript for production (fast startup)
    const servePath = join(__dirname, '..', 'dist', 'serve-with-restart.js');
    await import(servePath);
  } else {
    // Fall back to TypeScript with tsx for development
    try {
      await import('tsx/esm');
      const servePath = join(__dirname, '..', 'src', 'serve-with-restart.ts');
      await import(servePath);
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