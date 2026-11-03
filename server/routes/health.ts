import { Router } from 'express';
import path from 'path';
import { db } from '../db';
import { configuredModel, llmStatus } from '../llm';

export const healthRouter = Router();

// Configuration of the chat model, not a live probe: it answers whether the
// next /api/chat call would attempt a model call, and why not if it would not.
// There is no invented default model id — see GEMINI_MODEL in .env.example.
healthRouter.get('/api/llm/status', (_req, res) => {
  const gemini = llmStatus();
  const openRouterKey = (process.env.OPENROUTER_API_KEY || '').trim();
  const openRouterModel = (process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat:free').trim();

  const isServerConfigured = Boolean(openRouterKey || gemini.configured);
  const serverProvider = openRouterKey ? 'openrouter' : gemini.configured ? 'gemini' : null;
  const serverModel = openRouterKey ? openRouterModel : gemini.model;

  res.json({
    ...gemini,
    configured: isServerConfigured,
    serverProvider,
    model: serverModel,
    degradedReason: isServerConfigured ? null : gemini.degradedReason,
    supportedProviders: ['openrouter', 'gemini', 'deepseek', 'openai', 'custom'],
    freeModelRecommendation: 'deepseek/deepseek-chat:free',
    hasOpenRouter: Boolean(openRouterKey),
    hasGemini: gemini.configured,
  });
});

healthRouter.get('/api/health', (_req, res) => {
  const memory = process.memoryUsage();
  const dbPath = process.env.DATABASE_PATH || path.resolve(process.cwd(), 'data', 'mcp_rooms.db');

  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: {
      status: 'connected',
      path: dbPath,
    },
    memory: {
      rss: memory.rss,
      heapUsed: memory.heapUsed,
      heapTotal: memory.heapTotal,
    },
  });
});

healthRouter.get('/healthz', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get('/readyz', (_req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({
      status: 'ready',
      database: 'connected',
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'not_ready',
      database: 'disconnected',
      error: err.message,
    });
  }
});
