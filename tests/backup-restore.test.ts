import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import DatabaseModule from 'better-sqlite3';
import { initDatabase, createListingInDb, getListingByIdFromDb } from '../server/db';
import { backupDatabase } from '../scripts/backup-db';
import { verifyAndRestoreDatabase } from '../scripts/restore-db';

const Database = (DatabaseModule as any).default || DatabaseModule;

describe('SQLite Backup & Restore Integrity (PR-10)', () => {
  let tmpDir: string;
  let backupDir: string;

  beforeAll(() => {
    initDatabase();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rooms-backup-test-'));
    backupDir = path.join(tmpDir, 'backups');
  });

  afterAll(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Temp dir clean up
    }
  });

  it('creates a point-in-time VACUUM backup file', () => {
    const run = Date.now().toString(36);
    const listingId = `listing-backup-${run}`;

    createListingInDb({
      id: listingId,
      owner: `user:${run}`,
      author_name: 'Backup Test Author',
      content: {
        title: 'Запись для проверки бэкапа',
        description: 'Описание записи в базе данных перед сбором бэкапа.',
        category: 'things',
        kind: 'offer',
        modes: ['pickup', 'online'],
        locality: 'Казань',
      },
    });

    const backupResult = backupDatabase(backupDir);
    expect(backupResult.success).toBe(true);
    expect(fs.existsSync(backupResult.backupPath)).toBe(true);
    expect(backupResult.sizeBytes).toBeGreaterThan(0);

    // Verify backup contains the record
    const backupDb = new Database(backupResult.backupPath, { readonly: true });
    const row = backupDb.prepare('SELECT * FROM listings WHERE id = ?').get(listingId) as any;
    backupDb.close();

    expect(row).toBeDefined();
    expect(row.id).toBe(listingId);
  });

  it('verifies integrity and restores database safely', () => {
    const run = Date.now().toString(36);
    const listingId = `listing-restore-${run}`;

    createListingInDb({
      id: listingId,
      owner: `user:${run}`,
      author_name: 'Restore Test Author',
      content: {
        title: 'Запись для проверки восстановления',
        description: 'Описание записи перед восстановлением.',
        category: 'services',
        kind: 'offer',
        modes: ['pickup', 'online'],
        locality: 'Москва',
      },
    });

    const backupResult = backupDatabase(backupDir);

    // Restore into a fresh target path
    const targetPath = path.join(tmpDir, 'restored.db');
    const restoreResult = verifyAndRestoreDatabase(backupResult.backupPath, targetPath);

    expect(restoreResult.success).toBe(true);
    expect(fs.existsSync(restoreResult.targetPath)).toBe(true);

    const restoredDb = new Database(restoreResult.targetPath, { readonly: true });
    const row = restoredDb.prepare('SELECT * FROM listings WHERE id = ?').get(listingId) as any;
    restoredDb.close();

    expect(row).toBeDefined();
    expect(row.title).toBe('Запись для проверки восстановления');
  });

  it('rejects invalid or corrupted files during restore check', () => {
    const fakePath = path.join(tmpDir, 'corrupted.db');
    fs.writeFileSync(fakePath, 'NOT A VALID SQLITE HEADER FILE CONTENT');

    expect(() => verifyAndRestoreDatabase(fakePath)).toThrow('Указанный файл не является валидным файлом SQLite');
  });
});
