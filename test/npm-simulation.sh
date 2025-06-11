#!/bin/bash

# This script simulates how the package will work when installed via npm

echo "Testing npm package simulation..."

# 1. Build the project
echo "Building project..."
npm run build

# 2. Test that the bin script works with default (serve) command
echo "Testing default serve command..."
timeout 1s node bin/mcp-screenshot-website.js 2>&1 | grep -q "screenshot-website-fast MCP server running"
if [ $? -eq 0 ]; then
    echo "✓ Default serve command works"
else
    echo "✗ Default serve command failed"
    exit 1
fi

# 3. Test that the bin script works with explicit serve command
echo "Testing explicit serve command..."
timeout 1s node bin/mcp-screenshot-website.js serve 2>&1 | grep -q "screenshot-website-fast MCP server running"
if [ $? -eq 0 ]; then
    echo "✓ Explicit serve command works"
else
    echo "✗ Explicit serve command failed"
    exit 1
fi

# 4. Test that the capture command works
echo "Testing capture command help..."
node bin/mcp-screenshot-website.js capture --help > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✓ Capture command works"
else
    echo "✗ Capture command failed"
    exit 1
fi

echo ""
echo "All tests passed! Package is ready for npm deployment."