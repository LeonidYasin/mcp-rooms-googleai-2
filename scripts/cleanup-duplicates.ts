#!/usr/bin/env node
/**
 * Scans the database for duplicate listings and cleans them safely.
 *
 * Usage:
 *   npx tsx scripts/cleanup-duplicates.ts [--dry-run] [--verbose] [--json]
 */
import { initDatabase, dbPath } from '../server/db';
import { cleanupDuplicateListings, findDuplicateListings } from '../server/dedup';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose') || args.includes('-v');
const jsonOutput = args.includes('--json');

initDatabase();

if (!jsonOutput) {
  console.log('==================================================');
  console.log('  MCP Rooms Database Deduplication & Data Hygiene');
  console.log('==================================================');
  console.log(`Database: ${dbPath}`);
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (Simulation only, no data changed)' : '🧹 LIVE CLEANUP'}`);
  console.log('');
}

const report = cleanupDuplicateListings({ dryRun });

if (jsonOutput) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

if (report.groupsFound === 0) {
  console.log('✅ No duplicate listings found. Database is completely clean!');
  process.exit(0);
}

console.log(`Found ${report.groupsFound} duplicate group(s) with ${report.duplicatesFound} redundant listing(s):\n`);

for (let i = 0; i < report.details.length; i++) {
  const item = report.details[i];
  console.log(`Group #${i + 1}: [${item.category}/${item.kind}] "${item.title}"`);
  console.log(`  Owner: ${item.owner}`);
  console.log(`  Canonical ID (kept): ${item.canonicalId}`);
  console.log(`  Duplicate IDs (${dryRun ? 'to remove' : 'removed'}): ${item.removedIds.join(', ')}`);
  if (item.relinkedRooms > 0) {
    console.log(`  Rooms relinked: ${item.relinkedRooms}`);
  }
  if (item.relinkedNegotiations > 0) {
    console.log(`  Negotiations relinked: ${item.relinkedNegotiations}`);
  }
  console.log('');
}

console.log('--------------------------------------------------');
console.log('Summary:');
console.log(`  Groups processed: ${report.groupsFound}`);
console.log(`  Duplicates ${dryRun ? 'identified' : 'removed'}: ${dryRun ? report.duplicatesFound : report.duplicatesRemoved}`);
console.log(`  Rooms relinked: ${report.roomsRelinked}`);
console.log(`  Negotiations relinked: ${report.negotiationsRelinked}`);
console.log(`  Embeddings transferred: ${report.embeddingsTransferred}`);
console.log(`  Audit logs updated: ${report.auditLogsUpdated}`);
console.log('--------------------------------------------------');

if (dryRun) {
  console.log('💡 Run without --dry-run to apply these cleanup changes.');
} else {
  console.log('🎉 Cleanup completed successfully! Database hygiene restored.');
}
