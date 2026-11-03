#!/usr/bin/env node
/**
 * Seeds the fictional demo catalogue and profiles idempotently.
 *
 *   npm run seed:demo
 *
 * The server itself seeds nothing unless DEMO_SEED=1 is set explicitly, so a
 * fresh deployment starts with an empty catalogue. Everything this script
 * inserts is demo data — never present it as real listings or real people.
 */
import {
  getListingsFromDb,
  getProfilesFromDb,
  initDatabase,
  seedProfiles,
  seedInitialData,
  ensureNewCategoriesSeeded,
} from '../server/db';
import { cleanupDuplicateListings } from '../server/dedup';

process.env.DEMO_SEED = '1';

// Initialize schema and migrations
initDatabase();

// Ensure all profiles and demo listings are seeded with strict idempotency
seedProfiles();
seedInitialData();
ensureNewCategoriesSeeded();

// Safe cleanup in case any legacy duplicate rows were present
const dedupReport = cleanupDuplicateListings();

const listings = getListingsFromDb({});
const profiles = getProfilesFromDb();

process.stdout.write(
  [
    '',
    'DEMO_SEED=1: fictional demo data ensured (idempotent).',
    `  listings: ${listings.length}`,
    `  profiles: ${profiles.length}`,
    dedupReport.duplicatesRemoved > 0 ? `  duplicates cleaned: ${dedupReport.duplicatesRemoved}` : '',
    '',
    'These are made-up examples. Do not treat them as real demand, offers or people.',
    'To start from an empty database instead, remove this data and unset DEMO_SEED.',
    '',
  ].filter(Boolean).join('\n') + '\n'
);
