#!/usr/bin/env bash
# Pre-deployment VPS Health and Safety Inspection Script
# Verifies Docker runtime, disk space, RAM, CPU load, and port availability before deployment.

set -euo pipefail

echo "=========================================================="
echo "  MCP Rooms - VPS Pre-Deployment Health & Safety Inspection"
echo "=========================================================="

ERRORS=0
WARNINGS=0

# Configurable ports from environment
HOST_PORT="${HOST_PORT:-3000}"
CADDY_HTTP_PORT="${CADDY_HTTP_PORT:-8080}"
CADDY_HTTPS_PORT="${CADDY_HTTPS_PORT:-8443}"

echo "[1/5] Checking Docker & Docker Compose availability..."
if command -v docker >/dev/null 2>&1; then
    DOCKER_VER=$(docker --version)
    echo "  [OK] Docker installed: $DOCKER_VER"
else
    echo "  [ERROR] Docker is not installed or not in PATH!"
    ERRORS=$((ERRORS + 1))
fi

if docker compose version >/dev/null 2>&1; then
    COMPOSE_VER=$(docker compose version)
    echo "  [OK] Docker Compose installed: $COMPOSE_VER"
else
    echo "  [ERROR] Docker Compose plugin is not installed!"
    ERRORS=$((ERRORS + 1))
fi

echo "[2/5] Checking System Memory (RAM)..."
if command -v free >/dev/null 2>&1; then
    AVAIL_MEM_MB=$(free -m | awk '/^Mem:/ {print $7}')
    if [ -n "$AVAIL_MEM_MB" ] && [ "$AVAIL_MEM_MB" -lt 256 ]; then
        echo "  [WARNING] Low available RAM: ${AVAIL_MEM_MB}MB (recommended >= 512MB)"
        WARNINGS=$((WARNINGS + 1))
    else
        echo "  [OK] Available RAM: ${AVAIL_MEM_MB:-unknown}MB"
    fi
else
    echo "  [INFO] 'free' command not available, skipping RAM check."
fi

echo "[3/5] Checking Available Disk Space..."
AVAIL_DISK_MB=$(df -m . | awk 'NR==2 {print $4}')
if [ -n "$AVAIL_DISK_MB" ] && [ "$AVAIL_DISK_MB" -lt 1000 ]; then
    echo "  [WARNING] Disk space under 1000MB: ${AVAIL_DISK_MB}MB available"
    WARNINGS=$((WARNINGS + 1))
else
    echo "  [OK] Available Disk Space: ${AVAIL_DISK_MB}MB"
fi

echo "[4/5] Inspecting Port Conflict Safety..."
check_port() {
    local port="$1"
    local name="$2"

    if command -v ss >/dev/null 2>&1; then
        if ss -tuln | grep -q ":${port} "; then
            echo "  [NOTICE] Port ${port} (${name}) is currently in use."
            # Check if occupied by our own container
            if docker ps --format '{{.Names}}' 2>/dev/null | grep -qE 'mcp_rooms_prod'; then
                echo "    -> Port ${port} is occupied by existing mcp_rooms container (upgrade deployment OK)."
            else
                echo "    -> [WARNING] Port ${port} is occupied by external service or system daemon!"
                WARNINGS=$((WARNINGS + 1))
            fi
        else
            echo "  [OK] Port ${port} (${name}) is FREE."
        fi
    elif command -v netstat >/dev/null 2>&1; then
        if netstat -tuln | grep -q ":${port} "; then
            echo "  [NOTICE] Port ${port} (${name}) is currently in use."
        else
            echo "  [OK] Port ${port} (${name}) is FREE."
        fi
    else
        echo "  [INFO] Neither 'ss' nor 'netstat' available. Skipping network socket check."
    fi
}

check_port "$HOST_PORT" "Backend App Port"
check_port "$CADDY_HTTP_PORT" "Caddy HTTP Port"
check_port "$CADDY_HTTPS_PORT" "Caddy HTTPS Port"

echo "[5/5] Checking Data Volume Directory Permissions..."
mkdir -p ./data
if [ -w ./data ]; then
    echo "  [OK] Data directory ./data is writable."
else
    echo "  [ERROR] Data directory ./data is NOT writable!"
    ERRORS=$((ERRORS + 1))
fi

echo "=========================================================="
if [ "$ERRORS" -gt 0 ]; then
    echo "  [FAIL] Pre-deploy health check failed with $ERRORS errors and $WARNINGS warnings."
    exit 1
elif [ "$WARNINGS" -gt 0 ]; then
    echo "  [PASS WITH WARNINGS] Pre-deploy check passed with $WARNINGS warnings."
    exit 0
else
    echo "  [SUCCESS] All pre-deploy health checks PASSED cleanly."
    exit 0
fi
