import { Router } from 'express';
import { handleMcpJsonRpcRequest } from '../mcp';
import { optionalAuth } from '../auth';
import { rateLimit } from '../http-guard';

export const mcpRouter = Router();

// tools/list and the public listing resources are open, but anything that
// touches a room or writes data requires a key (audit F-01).
function mcpRequiresAuth(body: any): boolean {
  if (body?.method === 'tools/call') return true;
  if (body?.method === 'resources/read') {
    const uri = typeof body?.params?.uri === 'string' ? body.params.uri : '';
    return uri.startsWith('rooms://');
  }
  return false;
}

// Accept requests on /mcp, /sse, or /mcp/sse for maximum compatibility with all MCP clients
mcpRouter.post(['/mcp', '/sse', '/mcp/sse'], optionalAuth, rateLimit('mcp', 'RATE_LIMIT_MCP_PER_MINUTE', 240), async (req, res) => {
  if (mcpRequiresAuth(req.body) && !req.principal) {
    res.status(401).json({
      jsonrpc: '2.0',
      id: req.body?.id ?? null,
      error: {
        code: -32001,
        message: 'Unauthorized: this MCP method requires Authorization: Bearer <token>',
      },
    });
    return;
  }
  try {
    const result = await handleMcpJsonRpcRequest(req.body, {
      principalId: req.principal?.principalId,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: { code: -32603, message: err?.message || 'Internal MCP server error' },
    });
  }
});

// Classic SSE transport endpoint: allows clients connecting via EventSource GET /sse to discover the POST endpoint
mcpRouter.get(['/sse', '/mcp/sse'], optionalAuth, (req, res) => {
  const sessionId = `mcp-sess-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(`event: endpoint\ndata: /sse?sessionId=${sessionId}\n\n`);
  const heartbeat = setInterval(() => {
    res.write(`: ping\n\n`);
  }, 15000);
  req.on('close', () => {
    clearInterval(heartbeat);
  });
});
