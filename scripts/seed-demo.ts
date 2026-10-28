#!/usr/bin/env node
/**
 * Seeds the fictional demo catalogue and profiles.
 *
 *   npm run seed:demo
 *
 * The server itself seeds nothing unless DEMO_SEED=1 is set explicitly, so a
 * fresh deployment starts with an empty catalogue. Everything this script
 * inserts is demo data — never present it as real listings or real people.
 */
import { getListingsFromDb, getProfilesFromDb, initDatabase } from '../server/db';

process.env.DEMO_SEED = '1';

initDatabase();

const listings = getListingsFromDb({});
const profiles = getProfilesFromDb();

process.stdout.write(
  [
    '',
    'DEMO_SEED=1: fictional demo data ensured.',
    `  listings: ${listings.length}`,
    `  profiles: ${profiles.length}`,
    '',
    'These are made-up examples. Do not treat them as real demand, offers or people.',
    'To start from an empty database instead, remove this data and unset DEMO_SEED.',
    '',
  ].join('\n')
);
