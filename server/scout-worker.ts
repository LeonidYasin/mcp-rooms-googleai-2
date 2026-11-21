import { discoverRawItems } from './scout';
import { extractParticipantProfile } from './extractor';
import { matchAndNegotiateAll } from './scout-matcher';
import { logger } from './logger';
import { countScoutProfilesInDb, countPublicDealsInDb } from './db';

let isCycleRunning = false;
let scoutIntervalTimer: NodeJS.Timeout | null = null;

export interface ScoutCycleResult {
  startedAt: number;
  completedAt: number;
  itemsDiscovered: number;
  profilesIndexed: number;
  dealsFormed: number;
  totalProfilesInDb: number;
  totalDealsInDb: number;
  errors: string[];
}

/**
 * Runs one complete autonomous cycle:
 * Discovery -> Extraction -> Asymmetric Matching -> Agent-to-Agent Negotiation -> Public Ledger
 */
export async function runAutonomousScoutCycle(options?: {
  maxItems?: number;
  matchThreshold?: number;
}): Promise<ScoutCycleResult> {
  if (isCycleRunning) {
    logger.warn('Scout cycle is already in progress, skipping overlapping run.');
    return {
      startedAt: Date.now(),
      completedAt: Date.now(),
      itemsDiscovered: 0,
      profilesIndexed: 0,
      dealsFormed: 0,
      totalProfilesInDb: countScoutProfilesInDb(),
      totalDealsInDb: countPublicDealsInDb(),
      errors: ['cycle_already_in_progress'],
    };
  }

  isCycleRunning = true;
  const startedAt = Date.now();
  const errors: string[] = [];
  const maxItems = options?.maxItems || 25;
  const matchThreshold = options?.matchThreshold || 0.70;

  let itemsDiscovered = 0;
  let profilesIndexed = 0;
  let dealsFormed = 0;

  try {
    logger.info(`[Autonomous Scout] Step 1: Discovering raw requests (target: ${maxItems})...`);
    const rawItems = await discoverRawItems({ maxItems });
    itemsDiscovered = rawItems.length;

    logger.info(`[Autonomous Scout] Step 2: Extracting Offer / Want profiles & vectors (${rawItems.length} items)...`);
    for (const item of rawItems) {
      try {
        const record = await extractParticipantProfile(item);
        if (record) {
          profilesIndexed++;
        }
      } catch (err: any) {
        errors.push(`Extraction failed for ${item.sourceUrl}: ${err.message}`);
      }
    }

    logger.info(`[Autonomous Scout] Step 3: Running Asymmetric Vector Matching & Agent-to-Agent Negotiation...`);
    const newDeals = await matchAndNegotiateAll(matchThreshold);
    dealsFormed = newDeals.length;

    logger.info(`[Autonomous Scout] Cycle complete: ${itemsDiscovered} found, ${profilesIndexed} indexed, ${dealsFormed} deals formed.`);
  } catch (err: any) {
    logger.error(`[Autonomous Scout] Cycle error: ${err.message}`);
    errors.push(err.message);
  } finally {
    isCycleRunning = false;
  }

  const completedAt = Date.now();
  return {
    startedAt,
    completedAt,
    itemsDiscovered,
    profilesIndexed,
    dealsFormed,
    totalProfilesInDb: countScoutProfilesInDb(),
    totalDealsInDb: countPublicDealsInDb(),
    errors,
  };
}

/**
 * Initializes autonomous background schedule if enabled.
 */
export function startScoutBackgroundWorker(): void {
  const isEnabled = process.env.SCOUT_ENABLED === 'true' || process.env.SCOUT_ENABLED === '1';
  const intervalMinutes = Number(process.env.SCOUT_INTERVAL_MINUTES) || 60;

  if (!isEnabled) {
    logger.info('[Autonomous Scout] Background worker is disabled (SCOUT_ENABLED is not set). Manual runs available via /api/scout/run.');
    return;
  }

  logger.info(`[Autonomous Scout] Starting background worker: runs every ${intervalMinutes} minutes.`);

  // Initial delay of 10 seconds after server startup before first cycle
  setTimeout(() => {
    runAutonomousScoutCycle().catch((err) => {
      logger.warn(`[Autonomous Scout] Initial cycle error: ${err.message}`);
    });
  }, 10_000);

  scoutIntervalTimer = setInterval(() => {
    runAutonomousScoutCycle().catch((err) => {
      logger.warn(`[Autonomous Scout] Scheduled cycle error: ${err.message}`);
    });
  }, intervalMinutes * 60 * 1000);
}

export function stopScoutBackgroundWorker(): void {
  if (scoutIntervalTimer) {
    clearInterval(scoutIntervalTimer);
    scoutIntervalTimer = null;
    logger.info('[Autonomous Scout] Background worker stopped.');
  }
}
