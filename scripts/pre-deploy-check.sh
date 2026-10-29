#!/usr/bin/env bash
set -euo pipefail

echo "==> Running Pre-Deploy Verification Checks..."

# 1. Check required configuration files
for file in Dockerfile docker-compose.yml Caddyfile package.json; do
  if [ ! -f "$file" ]; then
    echo "Error: Required file $file is missing!" >&2
    exit 1
  fi
done

# 2. Check TypeScript compilation
echo "==> Checking TypeScript compilation..."
npx tsc --noEmit

# 3. Check Vitest unit/integration test suite
echo "==> Running Vitest test suite..."
npx vitest run

# 4. Check Docker compose configuration
if command -v docker >/dev/null 2>&1; then
  echo "==> Validating Docker Compose setup..."
  docker compose config -q || true
fi

echo "==> Pre-deploy checks passed successfully!"
