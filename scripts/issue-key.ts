#!/usr/bin/env node
/**
 * Issues, lists and revokes API keys for MCP Rooms.
 *
 *   npm run key:issue -- --principal user:leonid --name "laptop"
 *   npm run key:issue -- --list
 *   npm run key:issue -- --revoke key_ab12cd34
 *
 * The token is printed once and never stored in plaintext: the database keeps
 * only its sha256 digest. Copy it into the client that needs it.
 */
import { parseArgs } from 'node:util';
import { initDatabase, listApiKeysInDb, revokeApiKeyInDb } from '../server/db';
import { issueApiKey, isValidPrincipalId, KEY_PREFIX } from '../server/auth';

const USAGE = `Usage:
  npm run key:issue -- --principal <user:slug|agent:slug|org:slug> --name "<label>"
  npm run key:issue -- --list
  npm run key:issue -- --revoke <key_id>
`;

function main() {
  const { values } = parseArgs({
    options: {
      principal: { type: 'string' },
      name: { type: 'string' },
      list: { type: 'boolean', default: false },
      revoke: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: false,
  });

  if (values.help) {
    process.stdout.write(USAGE);
    return;
  }

  initDatabase();

  if (values.list) {
    const keys = listApiKeysInDb();
    if (keys.length === 0) {
      process.stdout.write('No API keys issued yet.\n');
      return;
    }
    for (const key of keys) {
      const state = key.revokedAt ? 'revoked' : 'active';
      const lastUsed = key.lastUsedAt ? new Date(key.lastUsedAt).toISOString() : 'never';
      process.stdout.write(
        `${key.id}  ${key.principalId}  "${key.name}"  ${state}  created=${new Date(key.createdAt).toISOString()}  last_used=${lastUsed}\n`
      );
    }
    return;
  }

  if (values.revoke) {
    const revoked = revokeApiKeyInDb(values.revoke, Date.now());
    if (!revoked) {
      process.stderr.write(`No active key with id "${values.revoke}". Use --list to see keys.\n`);
      process.exitCode = 1;
      return;
    }
    process.stdout.write(`Revoked ${values.revoke}. Requests with that token now get 401.\n`);
    return;
  }

  const principal = values.principal?.trim();
  const name = values.name?.trim();
  if (!principal || !name) {
    process.stderr.write(`Both --principal and --name are required.\n\n${USAGE}`);
    process.exitCode = 1;
    return;
  }
  if (!isValidPrincipalId(principal)) {
    process.stderr.write(
      `Invalid principal "${principal}". Use user:<slug>, agent:<slug> or org:<slug> with lowercase letters, digits, dot, dash or underscore.\n`
    );
    process.exitCode = 1;
    return;
  }

  const issued = issueApiKey(principal, name);

  process.stdout.write(
    [
      '',
      'API key issued. It is shown once and cannot be recovered.',
      '',
      `  principal: ${issued.principalId}`,
      `  key id:    ${issued.id}`,
      `  token:     ${issued.key}`,
      '',
      `Send it as: Authorization: Bearer ${KEY_PREFIX}...`,
      'Store it in a password manager. Revoke with:',
      `  npm run key:issue -- --revoke ${issued.id}`,
      '',
    ].join('\n')
  );
}

try {
  main();
} catch (err: any) {
  process.stderr.write(`key:issue failed: ${err?.message || err}\n`);
  process.exitCode = 1;
}
