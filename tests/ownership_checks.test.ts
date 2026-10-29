import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { initDatabase, createListingInDb, getListingByIdFromDb } from '../server/db';
import { issueApiKey } from '../server/auth';
import { app } from '../server';

describe('Strict Listing Ownership Checks API', () => {
  let aliceKey: string;
  let bobKey: string;
  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    initDatabase();

    const alice = issueApiKey('user:alice', 'Alice Laptop', ['*']);
    aliceKey = alice.key;

    const bob = issueApiKey('user:bob', 'Bob Laptop', ['*']);
    bobKey = bob.key;

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  async function jsonFetch(urlPath: string, options: { method: string; token?: string; body?: any }) {
    const url = new URL(urlPath, baseUrl);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (options.token) headers['Authorization'] = `Bearer ${options.token}`;

    const res = await fetch(url.toString(), {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const data = await res.json();
    return { status: res.status, body: data };
  }

  it('allows owner to update their own listing and rejects non-owners with 403', async () => {
    const now = Date.now();
    const listingId = 'listing-owner-test-' + now;

    createListingInDb({
      id: listingId,
      owner: 'user:alice',
      author_name: 'Alice',
      content: {
        title: 'Original Title',
        description: 'Original Description',
        category: 'services',
        kind: 'offer',
        locality: 'Казань',
        price_minor: 100000,
        currency: 'RUB',
        modes: ['pickup'],
        condition: 'new',
      },
      status: 'published',
      visibility: 'public',
      revision: 1,
      created_at: now,
      updated_at: now,
      expires_at: now + 3600000,
      photos: [],
      responses_count: 0,
    });

    // Bob tries to update Alice's listing -> 403 Forbidden
    const bobRes = await jsonFetch(`/api/listings/${listingId}`, {
      method: 'PUT',
      token: bobKey,
      body: { title: 'Hacked Title by Bob' },
    });

    expect(bobRes.status).toBe(403);
    expect(bobRes.body.error).toBe('forbidden');

    // Alice updates her own listing -> 200 OK
    const aliceRes = await jsonFetch(`/api/listings/${listingId}`, {
      method: 'PUT',
      token: aliceKey,
      body: { title: 'Updated Title by Alice', price_rubles: 1500 },
    });

    expect(aliceRes.status).toBe(200);
    expect(aliceRes.body.content.title).toBe('Updated Title by Alice');

    const updatedInDb = getListingByIdFromDb(listingId);
    expect(updatedInDb?.content.title).toBe('Updated Title by Alice');
    expect(updatedInDb?.content.price_minor).toBe(150000);
  });

  it('allows owner to withdraw their listing and rejects non-owners with 403', async () => {
    const now = Date.now();
    const listingId = 'listing-withdraw-test-' + now;

    createListingInDb({
      id: listingId,
      owner: 'user:alice',
      author_name: 'Alice',
      content: {
        title: 'Withdraw Title',
        description: 'Withdraw Description',
        category: 'services',
        kind: 'offer',
        locality: 'Казань',
        price_minor: 100000,
        currency: 'RUB',
        modes: ['pickup'],
        condition: 'new',
      },
      status: 'published',
      visibility: 'public',
      revision: 1,
      created_at: now,
      updated_at: now,
      expires_at: now + 3600000,
      photos: [],
      responses_count: 0,
    });

    // Bob tries to withdraw Alice's listing -> 403 Forbidden
    const bobRes = await jsonFetch(`/api/listings/${listingId}/withdraw`, {
      method: 'POST',
      token: bobKey,
    });

    expect(bobRes.status).toBe(403);
    expect(bobRes.body.error).toBe('forbidden');

    // Alice withdraws her own listing -> 200 OK
    const aliceRes = await jsonFetch(`/api/listings/${listingId}/withdraw`, {
      method: 'POST',
      token: aliceKey,
    });

    expect(aliceRes.status).toBe(200);
    expect(aliceRes.body.status).toBe('archived');
  });
});
