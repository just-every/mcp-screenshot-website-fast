#!/usr/bin/env node
import { spawn } from 'child_process';
import { performance } from 'perf_hooks';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

async function measureStartupTime(command, args, name) {
  const startTime = performance.now();
  
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: rootDir
    });
    
    proc.stderr.on('data', (data) => {
      const output = data.toString();
      if (output.includes('MCP server running')) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        proc.kill();
        resolve({ name, duration });
      }
    });
    
    setTimeout(() => {
      proc.kill();
      const endTime = performance.now();
      resolve({ name, duration: endTime - startTime, error: 'timeout' });
    }, 3000);
  });
}

async function runBenchmarks() {
  console.log('📊 MCP Read Website Fast - Performance Benchmarks\n');
  
  const results = [];
  
  // Test 1: Compiled JavaScript (production)
  console.log('Testing compiled JavaScript...');
  results.push(await measureStartupTime('node', ['dist/serve.js'], 'Compiled JS'));
  
  // Test 2: TypeScript with tsx
  console.log('Testing TypeScript with tsx...');
  results.push(await measureStartupTime('npx', ['tsx', 'src/serve.ts'], 'TypeScript (tsx)'));
  
  // Test 3: Via bin script (production path)
  console.log('Testing via bin script...');
  results.push(await measureStartupTime('node', ['bin/mcp-screenshot-website.js'], 'Bin script'));
  
  // Test 4: Memory usage
  console.log('\nMeasuring memory usage...');
  const memProc = spawn('node', ['dist/serve.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: rootDir
  });
  
  await new Promise(resolve => setTimeout(resolve, 100));
  const memUsage = process.memoryUsage();
  memProc.kill();
  
  // Display results
  console.log('\n📈 Results:\n');
  console.log('Startup Times:');
  results.forEach(({ name, duration, error }) => {
    if (error) {
      console.log(`  ❌ ${name}: Failed (${error})`);
    } else {
      console.log(`  ✅ ${name}: ${duration.toFixed(2)}ms`);
    }
  });
  
  console.log('\nMemory Usage:');
  console.log(`  RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Heap Used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  
  // Compare with baseline
  const compiledResult = results.find(r => r.name === 'Compiled JS');
  if (compiledResult && !compiledResult.error) {
    console.log('\n🚀 Performance Summary:');
    console.log(`  Startup time: ${compiledResult.duration.toFixed(2)}ms`);
    if (compiledResult.duration < 100) {
      console.log('  Status: ⚡ Excellent (< 100ms)');
    } else if (compiledResult.duration < 500) {
      console.log('  Status: ✅ Good (< 500ms)');
    } else {
      console.log('  Status: ⚠️  Needs improvement (> 500ms)');
    }
  }
}

runBenchmarks().catch(console.error);