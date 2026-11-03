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

describe('demo seed mode & deduplication (TASK-11)', () => {
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

    expect(db.getListingsFromDb({})).toHaveLength(0);
    expect(db.getProfilesFromDb()).toHaveLength(0);
    db.db.close();
  });

  it('seeds a fixed demo set when DEMO_SEED=1, strictly idempotently across multiple runs', async () => {
    const db = await loadFreshDatabase({ demoSeed: true });
    expect(db.demoSeedEnabled()).toBe(true);

    db.initDatabase();
    const initialListings = db.getListingsFromDb({}).length;
    const initialProfiles = db.getProfilesFromDb().length;
    expect(initialListings).toBeGreaterThan(0);
    expect(initialProfiles).toBeGreaterThan(0);

    // Multiple consecutive runs must NEVER duplicate the demo set.
    for (let i = 0; i < 5; i++) {
      db.initDatabase();
      db.seedProfiles(db.db);
      db.seedInitialData(db.db);
      db.ensureNewCategoriesSeeded(db.db);

      expect(db.getListingsFromDb({}).length).toBe(initialListings);
      expect(db.getProfilesFromDb().length).toBe(initialProfiles);
    }

    db.db.close();
  });

  describe('Deduplication & Data Hygiene', () => {
    it('detects duplicates and cleans them safely, re-linking rooms and negotiations', async () => {
      const dbModule = await loadFreshDatabase({ demoSeed: false });
      const { db, initDatabase, findDuplicateListings, cleanupDuplicateListings } = dbModule;
      initDatabase();

      const now = Date.now();

      // 1. Insert 3 identical listings for owner user:test-author
      const insertListingStmt = db.prepare(`
        INSERT INTO listings (
          id, owner, author_name, title, description, category, subcategory,
          kind, modes, locality, price_minor, currency, status, visibility, revision, created_at, updated_at, expires_at, photos_json, responses_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      // Canonical (oldest)
      insertListingStmt.run(
        'dup-orig-01',
        'user:test-author',
        'Тестовый Автор',
        'Услуги настройки серверов и Docker',
        'Настройка серверов, Caddy, Docker Compose под ключ',
        'services',
        'ИТ',
        'offer',
        JSON.stringify(['online']),
        'Москва',
        1000000,
        'RUB',
        'active',
        'public',
        1,
        now - 10000,
        now - 10000,
        now + 86400000,
        '[]',
        0
      );

      // Duplicate 2
      insertListingStmt.run(
        'dup-copy-02',
        'user:test-author',
        'Тестовый Автор',
        '  Услуги настройки серверов и Docker  ', // testing trimmed normalization
        'Настройка серверов, Caddy, Docker Compose под ключ',
        'services',
        'ИТ',
        'offer',
        JSON.stringify(['online']),
        'Москва',
        1000000,
        'RUB',
        'active',
        'public',
        1,
        now - 5000,
        now - 5000,
        now + 86400000,
        '[]',
        0
      );

      // Duplicate 3
      insertListingStmt.run(
        'dup-copy-03',
        'user:test-author',
        'Тестовый Автор',
        'услуги настройки серверов и docker', // testing case-insensitive normalization
        'Настройка серверов, Caddy, Docker Compose под ключ',
        'services',
        'ИТ',
        'offer',
        JSON.stringify(['online']),
        'Москва',
        1000000,
        'RUB',
        'draft',
        'private',
        1,
        now - 1000,
        now - 1000,
        now + 86400000,
        '[]',
        0
      );

      // 2. Link a room to duplicate #2
      db.prepare(`
        INSERT INTO rooms (id, listing_id, listing_title, category, participants_json, visibility, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'room-dup-test-01',
        'dup-copy-02',
        'Услуги настройки серверов и Docker',
        'services',
        JSON.stringify(['user:test-author', 'user:client-01']),
        'private',
        'active',
        now,
        now
      );

      // 3. Link a negotiation to duplicate #3
      db.prepare(`
        INSERT INTO negotiations (id, room_id, listing_id, user_goal, initiator_agent, counterpart_agent, round, max_rounds, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'nego-dup-test-01',
        'room-dup-test-01',
        'dup-copy-03',
        'Согласовать скидку',
        'agent:a',
        'agent:b',
        1,
        5,
        'active',
        now,
        now
      );

      // Verify before cleanup: 3 listings
      expect(db.prepare('SELECT COUNT(*) as cnt FROM listings').get()).toEqual({ cnt: 3 });

      // 4. Test findDuplicateListings
      const foundGroups = findDuplicateListings(db);
      expect(foundGroups).toHaveLength(1);
      expect(foundGroups[0].canonicalId).toBe('dup-orig-01');
      expect(foundGroups[0].duplicateIds).toEqual(['dup-copy-02', 'dup-copy-03']);

      // 5. Test dry-run: no deletion happens
      const dryReport = cleanupDuplicateListings({ dryRun: true, dbInstance: db });
      expect(dryReport.dryRun).toBe(true);
      expect(dryReport.groupsFound).toBe(1);
      expect(dryReport.duplicatesFound).toBe(2);
      expect(dryReport.duplicatesRemoved).toBe(0);
      expect(db.prepare('SELECT COUNT(*) as cnt FROM listings').get()).toEqual({ cnt: 3 });

      // 6. Test real cleanup execution
      const liveReport = cleanupDuplicateListings({ dryRun: false, dbInstance: db });
      expect(liveReport.dryRun).toBe(false);
      expect(liveReport.duplicatesRemoved).toBe(2);
      expect(liveReport.roomsRelinked).toBe(1);
      expect(liveReport.negotiationsRelinked).toBe(1);

      // Only canonical listing remains
      const remaining = db.prepare('SELECT id FROM listings').all() as Array<{ id: string }>;
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('dup-orig-01');

      // Room and negotiation are successfully relinked to canonical ID
      const updatedRoom = db.prepare('SELECT listing_id FROM rooms WHERE id = ?').get('room-dup-test-01') as any;
      expect(updatedRoom.listing_id).toBe('dup-orig-01');

      const updatedNego = db.prepare('SELECT listing_id FROM negotiations WHERE id = ?').get('nego-dup-test-01') as any;
      expect(updatedNego.listing_id).toBe('dup-orig-01');

      // Subsequent scan finds 0 duplicates
      expect(findDuplicateListings(db)).toHaveLength(0);

      db.close();
    });
  });
});
