#!/usr/bin/env bash
# Diagnostics and Caddy Configuration Helper for MCP Rooms
set -e

echo "=============================================="
echo "🔍 1. Web Servers & Caddy Process"
echo "=============================================="
ps aux | grep -E 'caddy|nginx|apache' | grep -v grep || echo "No web servers in ps aux"

echo ""
echo "=============================================="
echo "🌐 2. Listening Ports 80 and 443"
echo "=============================================="
ss -tlpn 2>/dev/null | grep -E ':(80|443|3000)\b' || netstat -tlpn 2>/dev/null | grep -E ':(80|443|3000)\b' || true

echo ""
echo "=============================================="
echo "📂 3. Caddy and Nginx Config Files Found"
echo "=============================================="
find /etc -maxdepth 3 -name "*caddy*" -o -name "*Caddy*" 2>/dev/null || true
find /etc -maxdepth 3 -name "*nginx*" 2>/dev/null || true

echo ""
echo "=============================================="
echo "⚙️ 4. Systemd Service Status"
echo "=============================================="
systemctl status caddy --no-pager 2>/dev/null || echo "caddy service not found or inactive"
