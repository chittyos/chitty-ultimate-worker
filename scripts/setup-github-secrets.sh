#!/bin/bash

# Script to set up GitHub Actions secrets for CI/CD
# Requires GitHub CLI (gh) to be installed and authenticated

REPO="chittyos/chitty-ultimate-worker"

echo "Setting up GitHub Actions secrets for $REPO..."

# Function to set secret
set_secret() {
    local SECRET_NAME=$1
    local SECRET_VALUE=$2

    echo "Setting $SECRET_NAME..."
    echo "$SECRET_VALUE" | gh secret set $SECRET_NAME --repo=$REPO
}

# Cloudflare secrets
echo "Enter Cloudflare API Token:"
read -s CF_API_TOKEN
set_secret "CF_API_TOKEN" "$CF_API_TOKEN"

echo "Enter Cloudflare Zone ID (for cache purging):"
read CF_ZONE_ID
set_secret "CF_ZONE_ID" "$CF_ZONE_ID"

# Neon database secrets
echo "Enter Neon Project ID:"
read NEON_PROJECT_ID
set_secret "NEON_PROJECT_ID" "$NEON_PROJECT_ID"

echo "Enter Neon API Key:"
read -s NEON_API_KEY
set_secret "NEON_API_KEY" "$NEON_API_KEY"

echo "Enter Neon Database Username:"
read NEON_DATABASE_USERNAME
set_secret "NEON_DATABASE_USERNAME" "$NEON_DATABASE_USERNAME"

echo "Enter Production Database URL:"
read -s NEON_DATABASE_URL_PRODUCTION
set_secret "NEON_DATABASE_URL_PRODUCTION" "$NEON_DATABASE_URL_PRODUCTION"

echo "Enter Staging Database URL:"
read -s NEON_DATABASE_URL_STAGING
set_secret "NEON_DATABASE_URL_STAGING" "$NEON_DATABASE_URL_STAGING"

# Optional AI secrets
read -p "Set up AI service secrets? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Enter OpenAI API Key:"
    read -s OPENAI_API_KEY
    set_secret "OPENAI_API_KEY" "$OPENAI_API_KEY"
fi

# Authentication secret
echo "Enter Auth Secret (generate random if needed):"
read -s AUTH_SECRET
if [ -z "$AUTH_SECRET" ]; then
    AUTH_SECRET=$(openssl rand -base64 32)
    echo "Generated random auth secret"
fi
set_secret "AUTH_SECRET" "$AUTH_SECRET"

echo ""
echo "✅ GitHub Actions secrets configured!"
echo ""
echo "Current secrets:"
gh secret list --repo=$REPO

echo ""
echo "Next steps:"
echo "1. Push code to trigger CI/CD pipeline"
echo "2. Create a PR to test preview deployments with Neon branching"
echo "3. Monitor Actions tab for deployment status"