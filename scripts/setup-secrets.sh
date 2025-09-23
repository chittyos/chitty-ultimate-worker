#!/bin/bash

# Script to set up secrets for ChittyOS Unified Worker
# Run: ./scripts/setup-secrets.sh

echo "Setting up secrets for ChittyOS Unified Worker..."

# Check if logged in
if ! wrangler whoami > /dev/null 2>&1; then
    echo "Please login to Cloudflare first:"
    wrangler login
fi

# Function to add secret
add_secret() {
    local SECRET_NAME=$1
    local SECRET_DESC=$2

    echo ""
    echo "Setting up $SECRET_NAME ($SECRET_DESC)..."
    echo "Enter value for $SECRET_NAME:"
    wrangler secret put $SECRET_NAME
}

# Core secrets
add_secret "NEON_DATABASE_URL" "Neon Postgres connection string"
add_secret "CF_API_TOKEN" "Cloudflare API token for analytics"

# AI service secrets
read -p "Do you want to set up AI service secrets? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    add_secret "OPENAI_API_KEY" "OpenAI API key"
    add_secret "ANTHROPIC_API_KEY" "Anthropic Claude API key"
fi

# Authentication secrets
read -p "Do you want to set up authentication secrets? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    add_secret "AUTH_SECRET" "Authentication secret key"
    add_secret "JWT_SECRET" "JWT signing secret"
fi

# List all secrets
echo ""
echo "Current secrets:"
wrangler secret list

echo ""
echo "✅ Secrets setup complete!"
echo ""
echo "For local development, copy .dev.vars.example to .dev.vars and add your values"
echo "cp .dev.vars.example .dev.vars"