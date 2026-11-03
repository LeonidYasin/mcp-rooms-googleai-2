#!/usr/bin/env node
/**
 * Batch reindexer for Gemini Embeddings in MCP Rooms.
 *
 * Usage:
 *   npm run embeddings:reindex
 *   npm run embeddings:reindex -- --force
 *   npm run embeddings:reindex -- --dry-run
 *   npm run embeddings:reindex -- --delay 100
 */
import { parseArgs } from 'node:util';
import { initDatabase, getListingsFromDb } from '../server/db';
import { getEmbeddingProviderStatus, reindexAllListings } from '../server/embeddings';

const USAGE = `Usage:
  npm run embeddings:reindex [-- --force] [--dry-run] [--delay <ms>]

Options:
  --force       Recompute embeddings even if listing already has one cached
  --dry-run     Check listings without calling the embedding API
  --delay <ms>  Delay in milliseconds between API calls (default: 50ms, respects rate limits)
  -h, --help    Show this help message
`;

async function main() {
  const { values } = parseArgs({
    options: {
      force: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      delay: { type: 'string', default: '50' },
      help: { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: false,
  });

  if (values.help) {
    process.stdout.write(USAGE);
    return;
  }

  initDatabase();

  const status = getEmbeddingProviderStatus();
  console.log('=== MCP Rooms Embeddings Reindexer ===');
  console.log(`Provider:  ${status.provider}`);
  console.log(`Model:     ${status.model}`);
  console.log(`Available: ${status.isAvailable ? '✅ YES' : '❌ NO'}`);
  console.log(`Reason:    ${status.reason}`);
  console.log('--------------------------------------');

  const allListings = getListingsFromDb({});
  console.log(`Total listings in database: ${allListings.length}`);

  if (values['dry-run']) {
    const needIndexing = allListings.filter((l) => values.force || !l.embedding_json);
    console.log(`[Dry-Run] Listings needing embedding computation: ${needIndexing.length}`);
    for (const item of needIndexing) {
      console.log(`  - [${item.id}] ${item.content.title} (${item.content.kind})`);
    }
    return;
  }

  if (!status.isAvailable) {
    console.warn(`[Warning] Embedding provider is not available (${status.reason}).`);
    console.warn('Set GEMINI_API_KEY environment variable to enable text-embedding-004.');
    return;
  }

  const batchDelayMs = Math.max(0, parseInt(values.delay || '50', 10) || 50);
  console.log(`Starting indexing with delay ${batchDelayMs}ms between items (force=${values.force})...`);

  const result = await reindexAllListings({
    force: values.force,
    batchDelayMs,
    onProgress: (processed, total, listingId, itemStatus) => {
      const icon = itemStatus === 'indexed' ? '✨' : itemStatus === 'skipped' ? '⏩' : '⚠️';
      console.log(`[${processed}/${total}] ${icon} Listing ${listingId}: ${itemStatus}`);
    },
  });

  console.log('--------------------------------------');
  console.log('=== Reindexing Completed ===');
  console.log(`Total:     ${result.total}`);
  console.log(`Indexed:   ${result.indexed}`);
  console.log(`Skipped:   ${result.skipped}`);
  console.log(`Errors:    ${result.errors}`);
}

main().catch((err) => {
  console.error('[Error] Reindexing failed:', err);
  process.exit(1);
});
