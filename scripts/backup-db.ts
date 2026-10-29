import path from 'path';
import fs from 'fs';
import { db } from '../server/db';

export function backupDatabase(targetDir?: string): { success: true; backupPath: string; sizeBytes: number } {
  const defaultBackupDir = path.resolve(process.cwd(), 'data', 'backups');
  const backupDir = targetDir || defaultBackupDir;

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `mcp_rooms_backup_${timestamp}.db`;
  const backupPath = path.join(backupDir, backupFileName);

  // Escaping single quotes in path for SQLite statement
  const safePath = backupPath.replace(/'/g, "''");
  db.exec(`VACUUM INTO '${safePath}'`);

  const stats = fs.statSync(backupPath);
  return {
    success: true,
    backupPath,
    sizeBytes: stats.size,
  };
}

if (process.argv[1] && process.argv[1].endsWith('backup-db.ts')) {
  try {
    const result = backupDatabase();
    console.log(`✅ Бэкап базы данных создан: ${result.backupPath} (${(result.sizeBytes / 1024).toFixed(1)} КБ)`);
  } catch (err: any) {
    console.error('❌ Ошибка при создании бэкапа:', err?.message || err);
    process.exit(1);
  }
}
