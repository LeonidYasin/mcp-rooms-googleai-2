import { Router } from 'express';
import {
  getPublicDealsFromDb,
  getPublicDealByIdFromDb,
  getScoutProfilesFromDb,
  countPublicDealsInDb,
  countScoutProfilesInDb,
} from '../db';
import { runAutonomousScoutCycle } from '../scout-worker';
import { roomEventBus } from '../events';
import { logger } from '../logger';

export const scoutRouter = Router();

/**
 * Public feed of negotiated deals («Public Ledger of Deals»)
 */
scoutRouter.get('/api/scout/deals', (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const platform = (req.query.platform as string) || 'all';
    const verdict = (req.query.verdict as string) || 'all';

    let deals = getPublicDealsFromDb({ status: 'published', limit, offset });
    if (platform !== 'all') {
      deals = deals.filter(
        (d) =>
          d.actorA.platform.toLowerCase() === platform.toLowerCase() ||
          d.actorB.platform.toLowerCase() === platform.toLowerCase()
      );
    }
    if (verdict !== 'all') {
      deals = deals.filter((d) => d.verdict === verdict);
    }

    res.json({
      deals,
      total: countPublicDealsInDb(),
      limit,
      offset,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Single deal detail with full transcript and protocol
 */
scoutRouter.get('/api/scout/deals/:id', (req, res) => {
  try {
    const deal = getPublicDealByIdFromDb(String(req.params.id));
    if (!deal) {
      res.status(404).json({ error: 'deal_not_found', message: 'Deal not found in public ledger' });
      return;
    }
    res.json(deal);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Raw collected scout profiles
 */
scoutRouter.get('/api/scout/profiles', (req, res) => {
  try {
    const platform = (req.query.platform as string) || 'all';
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const profiles = getScoutProfilesFromDb({ platform, limit });
    res.json({
      profiles,
      total: countScoutProfilesInDb(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Summary stats for header badges and widgets
 */
scoutRouter.get('/api/scout/stats', (_req, res) => {
  try {
    const totalDeals = countPublicDealsInDb();
    const totalProfiles = countScoutProfilesInDb();
    res.json({
      totalDeals,
      totalProfiles,
      activeScout: true,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Trigger an on-demand scout & match run
 */
scoutRouter.post('/api/scout/run', async (req, res) => {
  try {
    const maxItems = Number(req.body?.maxItems) || 25;
    const matchThreshold = Number(req.body?.matchThreshold) || 0.70;

    logger.info(`On-demand scout run requested via API (maxItems=${maxItems}, threshold=${matchThreshold})`);
    const result = await runAutonomousScoutCycle({ maxItems, matchThreshold });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * SSE stream for real-time live deal updates
 */
scoutRouter.get('/api/scout/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  res.write(': connected\n\n');

  // Heartbeat ping every 15s to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 15_000);

  // Subscribe to public feed deal broadcasts
  const unsubscribe = roomEventBus.subscribe('public-feed', (event) => {
    try {
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event.data)}\n\n`);
    } catch {
      // client disconnected
    }
  });

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});
