import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * F-11 contract: the fictional catalogue and profiles are demo data. A fresh
 * database must stay empty unless DEMO_SEED=1 is set explicitly.
 *
 * The module is imported dynamically with its own DATABASE_PATH so the shared
 * test database of the other suites is not touched.
 */
type DbModule = typeof import('../server/db');

describe('demo seed mode', () => {
  const originalPath = process.env.DATABASE_PATH;
  const originalSeed = process.env.DEMO_SEED;
  let dirs: string[] = [];

  const loadFreshDatabase = async (options: { demoSeed: boolean }): Promise<DbModule> => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rooms-seed-'));
    dirs.push(dir);
    process.env.DATABASE_PATH = path.join(dir, 'fresh.db');
    if (options.demoSeed) {
      process.env.DEMO_SEED = '1';
    } else {
      delete process.env.DEMO_SEED;
    }
    vi.resetModules();
    return import('../server/db');
  };

  afterEach(() => {
    if (originalPath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = originalPath;
    if (originalSeed === undefined) delete process.env.DEMO_SEED;
    else process.env.DEMO_SEED = originalSeed;

    for (const dir of dirs) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // Windows can keep the WAL handle for a moment; the temp dir is disposable.
      }
    }
    dirs = [];
    vi.resetModules();
  });

  it('leaves a fresh database empty without DEMO_SEED', async () => {
    const db = await loadFreshDatabase({ demoSeed: false });
    expect(db.demoSeedEnabled()).toBe(false);

    db.initDatabase();

    expect(db.getListingsFromDb()).toHaveLength(0);
    expect(db.getProfilesFromDb()).toHaveLength(0);
    db.db.close();
  });

  it('seeds a fixed demo set when DEMO_SEED=1, idempotently', async () => {
    const db = await loadFreshDatabase({ demoSeed: true });
    expect(db.demoSeedEnabled()).toBe(true);

    db.initDatabase();
    const listings = db.getListingsFromDb().length;
    const profiles = db.getProfilesFromDb().length;
    expect(listings).toBeGreaterThan(0);
    expect(profiles).toBeGreaterThan(0);

    // A second start must not duplicate the demo set.
    db.initDatabase();
    expect(db.getListingsFromDb().length).toBe(listings);
    expect(db.getProfilesFromDb().length).toBe(profiles);
    db.db.close();
  });
});
