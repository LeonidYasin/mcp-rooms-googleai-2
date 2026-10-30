#!/usr/bin/env bash
# Automatically applies the updated Caddyfile preserving Glacier and Agora,
# and routing mcp-rooms (port 3000) for leonid-mcp.duckdns.org.
set -e

CADDYFILE="/etc/caddy/Caddyfile"
BACKUP="/etc/caddy/Caddyfile.bak_$(date +%s)"

echo "📦 Creating backup of $CADDYFILE -> $BACKUP..."
cp "$CADDYFILE" "$BACKUP"

echo "✍️ Writing new verified Caddy configuration..."
cat << 'EOF' > "$CADDYFILE"
{
    admin 127.0.0.1:2019
}

leonid-mcp.duckdns.org {
    encode zstd gzip

    # 1. Preserved: Glacier service
    handle /glacier {
        redir * /glacier/ 308
    }
    handle /glacier/* {
        request_body {
            max_size 17MB
        }
        reverse_proxy 127.0.0.1:3003 {
            header_down Referrer-Policy strict-origin-when-cross-origin
            flush_interval -1
            stream_timeout 24h
        }
    }

    # 2. Preserved: Agora service
    handle_path /agora/* {
        reverse_proxy 127.0.0.1:3011 {
            header_up Host {upstream_hostport}
        }
    }

    # 3. MCP Rooms: Server-Sent Events (SSE) streaming for real-time rooms
    @sse path /api/rooms/*/stream
    handle @sse {
        reverse_proxy 127.0.0.1:3000 {
            flush_interval -1
        }
    }

    # 4. MCP Rooms: Web Storefront, React SPA, and MCP JSON-RPC protocol
    handle {
        reverse_proxy 127.0.0.1:3000
    }
}

http://31.77.9.27 {
    handle /.well-known/acme-challenge/* {
        root * /var/lib/acme-http
        file_server
    }
    handle {
        respond "Not found" 404
    }
}
EOF

echo "🔍 Validating Caddyfile syntax..."
caddy validate --config "$CADDYFILE"

echo "🔄 Reloading Caddy..."
systemctl reload caddy

echo "🎉 SUCCESS: Caddy reloaded! https://leonid-mcp.duckdns.org is now live with MCP Rooms!"
