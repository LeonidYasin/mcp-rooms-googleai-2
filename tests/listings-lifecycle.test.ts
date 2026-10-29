import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { app } from '../server';
import { initDatabase, getListingByIdFromDb } from '../server/db';
import { executeMcpToolCall } from '../server/mcp';
import { authJson, issueTestKey } from './auth-helpers';

describe('Listings publication lifecycle: draft -> preview -> publish -> withdraw', () => {
  let server: Server;
  let baseUrl: string;
  let ownerKey: string;
  let strangerKey: string;

  const run = Date.now().toString(36);
  const ownerId = `user:lifecycle-owner-${run}`;
  const strangerId = `user:lifecycle-stranger-${run}`;

  beforeAll(async () => {
    initDatabase();
    ownerKey = issueTestKey(ownerId).key;
    strangerKey = issueTestKey(strangerId).key;

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (!server) return;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('creates a listing in draft status with private visibility', async () => {
    const res = await fetch(`${baseUrl}/api/listings`, {
      method: 'POST',
      headers: authJson(ownerKey),
      body: JSON.stringify({
        title: 'Тестовый черновик',
        description: 'Подробное описание черновика для проверки публикационного цикла.',
        category: 'things',
        kind: 'offer',
        locality: 'Казань',
        price_rubles: 1500,
      }),
    });

    expect(res.status).toBe(201);
    const draft = await res.json();
    expect(draft.status).toBe('draft');
    expect(draft.visibility).toBe('private');
    expect(draft.revision).toBe(1);

    // The draft must NOT appear in the public catalog listing
    const catalogRes = await fetch(`${baseUrl}/api/listings`);
    const catalog = await catalogRes.json();
    expect(catalog.some((item: any) => item.id === draft.id)).toBe(false);
  });

  it('generates a preview and consent token for the owner', async () => {
    const createRes = await fetch(`${baseUrl}/api/listings`, {
      method: 'POST',
      headers: authJson(ownerKey),
      body: JSON.stringify({
        title: 'Предпросмотр товара',
        description: 'Описание предпросмотра товара для проверки согласия.',
        category: 'things',
        kind: 'offer',
        locality: 'Казань',
      }),
    });
    const draft = await createRes.json();

    // Stranger cannot request preview
    const strangerPreviewRes = await fetch(`${baseUrl}/api/listings/${draft.id}/preview`, {
      method: 'POST',
      headers: authJson(strangerKey),
    });
    expect(strangerPreviewRes.status).toBe(403);

    // Owner can request preview
    const previewRes = await fetch(`${baseUrl}/api/listings/${draft.id}/preview`, {
      method: 'POST',
      headers: authJson(ownerKey),
    });
    expect(previewRes.status).toBe(200);
    const preview = await previewRes.json();
    expect(preview.listing_id).toBe(draft.id);
    expect(preview.revision).toBe(1);
    expect(preview.consent_token).toBeDefined();
    expect(preview.preview.owner).toBeUndefined(); // public projection sanitized
  });

  it('publishes the draft with valid consent token and revision CAS', async () => {
    const createRes = await fetch(`${baseUrl}/api/listings`, {
      method: 'POST',
      headers: authJson(ownerKey),
      body: JSON.stringify({
        title: 'Опубликованный товар',
        description: 'Описание товара, который будет опубликован через CAS.',
        category: 'services',
        kind: 'offer',
        locality: 'Москва',
      }),
    });
    const draft = await createRes.json();

    // Preview to get consent token
    const previewRes = await fetch(`${baseUrl}/api/listings/${draft.id}/preview`, {
      method: 'POST',
      headers: authJson(ownerKey),
    });
    const preview = await previewRes.json();

    // Rejection on invalid revision (revision mismatch)
    const badPublishRes = await fetch(`${baseUrl}/api/listings/${draft.id}/publish`, {
      method: 'POST',
      headers: authJson(ownerKey),
      body: JSON.stringify({
        consent_token: preview.consent_token,
        revision: 999,
      }),
    });
    expect(badPublishRes.status).toBe(409);

    // Successful publication
    const publishRes = await fetch(`${baseUrl}/api/listings/${draft.id}/publish`, {
      method: 'POST',
      headers: authJson(ownerKey),
      body: JSON.stringify({
        consent_token: preview.consent_token,
        revision: 1,
      }),
    });
    expect(publishRes.status).toBe(200);
    const published = await publishRes.json();
    expect(published.status).toBe('active');
    expect(published.visibility).toBe('public');
    expect(published.revision).toBe(2);

    // Now it appears in public catalog
    const catalogRes = await fetch(`${baseUrl}/api/listings`);
    const catalog = await catalogRes.json();
    expect(catalog.some((item: any) => item.id === draft.id)).toBe(true);
  });

  it('allows owner to withdraw a published listing', async () => {
    const createRes = await fetch(`${baseUrl}/api/listings`, {
      method: 'POST',
      headers: authJson(ownerKey),
      body: JSON.stringify({
        title: 'Отозванный товар',
        description: 'Товар будет опубликован, а затем отозван автором.',
        category: 'business',
        kind: 'offer',
        locality: 'Казань',
      }),
    });
    const draft = await createRes.json();

    // Publish
    const previewRes = await fetch(`${baseUrl}/api/listings/${draft.id}/preview`, {
      method: 'POST',
      headers: authJson(ownerKey),
    });
    const preview = await previewRes.json();
    await fetch(`${baseUrl}/api/listings/${draft.id}/publish`, {
      method: 'POST',
      headers: authJson(ownerKey),
      body: JSON.stringify({ consent_token: preview.consent_token, revision: 1 }),
    });

    // Stranger cannot withdraw
    const strangerWithdraw = await fetch(`${baseUrl}/api/listings/${draft.id}/withdraw`, {
      method: 'POST',
      headers: authJson(strangerKey),
    });
    expect(strangerWithdraw.status).toBe(403);

    // Owner withdraws
    const withdrawRes = await fetch(`${baseUrl}/api/listings/${draft.id}/withdraw`, {
      method: 'POST',
      headers: authJson(ownerKey),
    });
    expect(withdrawRes.status).toBe(200);

    const stored = getListingByIdFromDb(draft.id);
    expect(stored.status).toBe('archived');

    // Withdrawn listing no longer appears in public catalog
    const catalogRes = await fetch(`${baseUrl}/api/listings`);
    const catalog = await catalogRes.json();
    expect(catalog.some((item: any) => item.id === draft.id)).toBe(false);
  });

  it('supports full lifecycle via MCP tool calls', async () => {
    // 1. Create draft via MCP
    const createResult = await executeMcpToolCall(
      'create_listing',
      {
        title: 'MCP Черновик',
        description: 'Черновик, созданный через MCP инструмент.',
        category: 'jobs',
        kind: 'offer',
        locality: 'Казань',
      },
      { principalId: ownerId }
    );
    expect(createResult.success).toBe(true);
    const listingId = createResult.created_listing.id;
    expect(createResult.created_listing.status).toBe('draft');

    // 2. Preview via MCP
    const previewResult = await executeMcpToolCall(
      'preview_listing',
      { listing_id: listingId },
      { principalId: ownerId }
    );
    expect(previewResult.success).toBe(true);
    expect(previewResult.consent_token).toBeDefined();

    // 3. Publish via MCP
    const publishResult = await executeMcpToolCall(
      'publish_listing',
      {
        listing_id: listingId,
        consent_token: previewResult.consent_token,
        revision: 1,
      },
      { principalId: ownerId }
    );
    expect(publishResult.success).toBe(true);
    expect(publishResult.published_listing.status).toBe('active');

    // 4. Withdraw via MCP
    const withdrawResult = await executeMcpToolCall(
      'withdraw_listing',
      { listing_id: listingId },
      { principalId: ownerId }
    );
    expect(withdrawResult.success).toBe(true);
    expect(withdrawResult.status).toBe('archived');
  });
});
