import { authHeaders } from './api';

export interface McpToolInfo {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

export interface McpCallOutcome {
  ok: boolean;
  data?: unknown;
  error?: string;
  durationMs: number;
}

interface JsonRpcResponse {
  jsonrpc?: string;
  id?: number | string | null;
  result?: any;
  error?: { code?: number; message?: string };
}

async function postJsonRpc(payload: Record<string, unknown>): Promise<JsonRpcResponse> {
  const res = await fetch('/mcp', {
    method: 'POST',
    headers: authHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), ...payload }),
  });
  if (!res.ok) {
    let message = `HTTP ${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error?.message) message = body.error.message;
    } catch {
      // non-JSON error body
    }
    throw new Error(message);
  }
  return (await res.json()) as JsonRpcResponse;
}

/** Real tools/list call against POST /mcp. No local fallback list. */
export async function listMcpTools(): Promise<McpToolInfo[]> {
  const body = await postJsonRpc({ method: 'tools/list' });
  if (body.error) throw new Error(body.error.message || 'MCP error');
  const tools = body.result?.tools;
  if (!Array.isArray(tools)) throw new Error('tools/list returned no tools array');
  return tools as McpToolInfo[];
}

/**
 * Real tools/call. The server wraps the payload as JSON text inside
 * result.content[0]; we return exactly what it sent, including tool-level errors.
 */
export async function callMcpTool(name: string, args: Record<string, unknown>): Promise<McpCallOutcome> {
  const started = performance.now();
  try {
    const body = await postJsonRpc({ method: 'tools/call', params: { name, arguments: args } });
    const durationMs = Math.round(performance.now() - started);
    if (body.error) {
      return { ok: false, error: body.error.message || 'MCP error', durationMs };
    }
    const text = body.result?.content?.[0]?.text;
    let data: unknown;
    if (typeof text === 'string') {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    } else {
      data = body.result?.data;
    }
    const toolError = data && typeof data === 'object' && typeof (data as any).error === 'string';
    return { ok: !toolError, data, error: toolError ? (data as any).error : undefined, durationMs };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err), durationMs: Math.round(performance.now() - started) };
  }
}
