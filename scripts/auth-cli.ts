#!/usr/bin/env node
/**
 * Operator CLI for identities (PR-4).
 *
 *   npm run auth -- user create --name "Леонид" [--id user:leonid]
 *   npm run auth -- user list
 *   npm run auth -- user disable --id user:leonid
 *   npm run auth -- key issue --user user:leonid --name "laptop" \
 *       [--scope rooms:read --scope rooms:write] [--days 7]
 *   npm run auth -- key list [--user user:leonid]
 *   npm run auth -- key revoke <credential_id>
 *
 * Raw tokens are printed once and never stored in plaintext: the database keeps
 * a sha256 digest only.
 */
import crypto from 'node:crypto';
import { parseArgs } from 'node:util';
import {
  createUserInDb,
  disableUserInDb,
  initDatabase,
  listCredentialsInDb,
  listUsersInDb,
  revokeCredentialInDb,
} from '../server/db';
import {
  ALL_SCOPES,
  DEFAULT_SCOPES,
  DEFAULT_TTL_DAYS,
  MAX_TTL_DAYS,
  isValidPrincipalId,
  issueCredential,
  resolveResource,
} from '../server/auth';

const USAGE = `Usage:
  npm run auth -- user create --name "<display name>" [--id user:<slug>]
  npm run auth -- user list
  npm run auth -- user disable --id user:<slug>
  npm run auth -- key issue --user user:<slug> --name "<label>" [--scope <scope>]... [--days <1..${MAX_TTL_DAYS}>]
  npm run auth -- key list [--user user:<slug>]
  npm run auth -- key revoke <credential_id>

Scopes: ${ALL_SCOPES.join(', ')}
Default scopes: ${DEFAULT_SCOPES.join(', ')}
Default lifetime: ${DEFAULT_TTL_DAYS} days (max ${MAX_TTL_DAYS}).
`;

function slug(): string {
  return 'u-' + crypto.randomBytes(4).toString('hex');
}

function format(ts: number | null): string {
  return ts ? new Date(ts).toISOString() : '—';
}

function main() {
  const [group, action, ...rest] = process.argv.slice(2);
  if (!group || group === '--help' || group === '-h') {
    process.stdout.write(USAGE);
    return;
  }

  initDatabase();

  if (group === 'user') {
    const { values } = parseArgs({
      args: rest,
      options: {
        name: { type: 'string' },
        id: { type: 'string' },
      },
      allowPositionals: true,
    });

    if (action === 'create') {
      const name = values.name?.trim();
      if (!name) throw new Error('--name is required.');
      const id = (values.id || `user:${slug()}`).trim();
      if (!isValidPrincipalId(id)) {
        throw new Error('--id must look like user:<lowercase-slug> (letters, digits, dot, dash, underscore).');
      }
      if (listUsersInDb().some((u) => u.id === id)) {
        throw new Error(`User "${id}" already exists.`);
      }
      const user = createUserInDb({ id, displayName: name, createdAt: Date.now() });
      process.stdout.write(
        [
          '',
          'User created.',
          `  user id:  ${user.id}`,
          `  name:     ${user.displayName}`,
          '',
          `Next: npm run auth -- key issue --user ${user.id} --name "laptop"`,
          '',
        ].join('\n')
      );
      return;
    }

    if (action === 'list') {
      const users = listUsersInDb();
      if (users.length === 0) {
        process.stdout.write('No users yet. Create one with: npm run auth -- user create --name "..."\n');
        return;
      }
      for (const user of users) {
        const keys = listCredentialsInDb(user.id);
        const active = keys.filter((k) => k.revokedAt === null && k.expiresAt > Date.now()).length;
        process.stdout.write(
          `${user.id}  "${user.displayName}"  ${user.disabled ? 'disabled' : 'active'}  keys=${active}/${keys.length}  created=${format(
            user.createdAt
          )}\n`
        );
      }
      return;
    }

    if (action === 'disable') {
      if (!values.id) throw new Error('--id is required.');
      if (!disableUserInDb(values.id)) throw new Error(`No active user "${values.id}".`);
      process.stdout.write(`Disabled ${values.id}. All of its credentials now fail with 401.\n`);
      return;
    }

    throw new Error(`Unknown user action "${action}".\n\n${USAGE}`);
  }

  if (group === 'key') {
    if (action === 'issue') {
      const { values } = parseArgs({
        args: rest,
        options: {
          user: { type: 'string' },
          name: { type: 'string' },
          scope: { type: 'string', multiple: true },
          days: { type: 'string' },
        },
      });
      if (!values.user) throw new Error('--user is required.');
      if (!values.name) throw new Error('--name is required.');

      const issued = issueCredential({
        userId: values.user,
        name: values.name,
        scopes: values.scope,
        days: values.days === undefined ? DEFAULT_TTL_DAYS : Number(values.days),
      });

      process.stdout.write(
        [
          '',
          'Credential issued. The token is shown once and cannot be recovered.',
          '',
          `  user:      ${issued.userId}`,
          `  key id:    ${issued.credentialId}`,
          `  scopes:    ${issued.scopes.join(', ')}`,
          `  expires:   ${format(issued.expiresAt)}`,
          `  resource:  ${issued.resource || '(unbound, dev only)'}`,
          `  token:     ${issued.key}`,
          '',
          'Send it as: Authorization: Bearer mcr_...',
          `Revoke with: npm run auth -- key revoke ${issued.credentialId}`,
          '',
        ].join('\n')
      );
      return;
    }

    if (action === 'list') {
      const { values } = parseArgs({
        args: rest,
        options: { user: { type: 'string' } },
      });
      const keys = listCredentialsInDb(values.user);
      if (keys.length === 0) {
        process.stdout.write('No credentials.\n');
        return;
      }
      const now = Date.now();
      for (const key of keys) {
        const state =
          key.revokedAt !== null ? 'revoked' : key.expiresAt <= now ? 'expired' : 'active';
        process.stdout.write(
          `${key.id}  ${key.userId}  "${key.name}"  ${state}  scopes=${key.scopes.join(',')}  expires=${format(
            key.expiresAt
          )}  last_used=${format(key.lastUsedAt)}\n`
        );
      }
      return;
    }

    if (action === 'revoke') {
      const id = rest[0];
      if (!id) throw new Error('Pass the credential id: npm run auth -- key revoke <credential_id>');
      if (!revokeCredentialInDb(id, Date.now())) throw new Error(`No active credential "${id}".`);
      process.stdout.write(`Revoked ${id}. Requests with that token now get 401.\n`);
      return;
    }

    throw new Error(`Unknown key action "${action}".\n\n${USAGE}`);
  }

  throw new Error(`Unknown command "${group}".\n\n${USAGE}`);
}

try {
  resolveResource();
  main();
} catch (err: any) {
  process.stderr.write(`auth: ${err?.message || err}\n`);
  process.exitCode = 1;
}
