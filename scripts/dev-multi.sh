#!/bin/bash

# Development script for multi-worker architecture
# This runs all workers together with service bindings

echo "🚀 Starting ChittyOS Multi-Worker Development Environment..."

# Check if worker directories exist
if [ ! -d "workers" ]; then
    echo "Creating workers directory structure..."
    mkdir -p workers/{platform,bridge,consultant,chain,cto,landing}
fi

# Option 1: Run with single command (recommended)
echo "Starting all workers with service bindings..."
wrangler dev \
    --config wrangler.toml \
    --config workers/platform/wrangler.toml \
    --config workers/bridge/wrangler.toml \
    --config workers/consultant/wrangler.toml \
    --config workers/chain/wrangler.toml \
    --config workers/cto/wrangler.toml \
    --config workers/landing/wrangler.toml \
    --local \
    --persist

# Option 2: Run gateway only (for testing unified worker)
# wrangler dev --config wrangler.toml --local --persist