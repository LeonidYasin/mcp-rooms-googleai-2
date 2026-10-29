import path from 'path';
import fs from 'fs';
import DatabaseModule from 'better-sqlite3';

const Database = (DatabaseModule as any).default || DatabaseModule;

export function verifyAndRestoreDatabase(backupPath: string, targetDbPath?: string): { success: true; targetPath: string } {
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Файл бэкапа не найден: ${backupPath}`);
  }

  // 1. Verify SQLite header
  const buf = Buffer.alloc(16);
  const fd = fs.openSync(backupPath, 'r');
  fs.readSync(fd, buf, 0, 16, 0);
  fs.closeSync(fd);

  if (buf.toString('utf8', 0, 15) !== 'SQLite format 3') {
    throw new Error('Указанный файл не является валидным файлом SQLite');
  }

  // 2. Verify DB integrity via quick_check
  const backupDb = new Database(backupPath, { readonly: true });
  const check = backupDb.prepare('PRAGMA quick_check').get() as { quick_check: string };
  backupDb.close();

  if (!check || check.quick_check !== 'ok') {
    throw new Error(`Проверка целостности файла бэкапа не пройдена: ${check?.quick_check || 'error'}`);
  }

  // 3. Restore file
  const defaultDataDir = path.resolve(process.cwd(), 'data');
  const targetPath = targetDbPath || process.env.DATABASE_PATH || path.join(defaultDataDir, 'mcp_rooms.db');

  const targetDir = path.dirname(targetPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  fs.copyFileSync(backupPath, targetPath);

  return {
    success: true,
    targetPath,
  };
}

if (process.argv[1] && process.argv[1].endsWith('restore-db.ts')) {
  const inputBackup = process.argv[2];
  if (!inputBackup) {
    console.error('❌ Укажите путь к файлу бэкапа: npx tsx scripts/restore-db.ts <path-to-backup.db>');
    process.exit(1);
  }

  try {
    const result = verifyAndRestoreDatabase(inputBackup);
    console.log(`✅ Восстановление базы данных успешно завершено в: ${result.targetPath}`);
  } catch (err: any) {
    console.error('❌ Ошибка при восстановлении базы данных:', err?.message || err);
    process.exit(1);
  }
}
