import { Router } from 'express';
import {
  getListingsFromDb,
  getListingByIdFromDb,
  createListingInDb,
  updateListingInDb,
  publishListingInDb,
  withdrawListingInDb,
  toPublicListing,
} from '../db';
import { requireAuth } from '../auth';
import { rateLimit } from '../http-guard';
import { indexListingEmbedding } from '../embeddings';
import { dispatchWebhooksForEvent } from '../webhooks';

export const listingsRouter = Router();

const LISTING_CATEGORIES = [
  'business', 'jobs', 'services', 'real_estate', 'communities', 'things', 'dating', 'rides', 'delivery', 'other',
];
const LISTING_MODES = ['pickup', 'shipping', 'online'];

function normalizeListingInput(
  body: any,
  ownerPrincipalId: string
): { ok: true; listing: any } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

  const content = body.content && typeof body.content === 'object' ? body.content : {};
  const title = text(body.title ?? content.title);
  const description = text(body.description ?? content.description);
  const category = text(body.category ?? content.category);
  const kind = text(body.kind ?? content.kind);
  const locality = text(body.locality ?? content.locality);

  if (title.length < 3 || title.length > 200) errors.push('title: 3..200 characters');
  if (description.length < 3 || description.length > 5000) errors.push('description: 3..5000 characters');
  if (!LISTING_CATEGORIES.includes(category)) errors.push(`category: one of ${LISTING_CATEGORIES.join(', ')}`);
  if (!['offer', 'request'].includes(kind)) errors.push('kind: offer|request');
  if (!locality) errors.push('locality: required');

  const rawPrice = body.price_rubles ?? (content.price_minor ? content.price_minor / 100 : undefined);
  const priceRubles = rawPrice === undefined || rawPrice === null ? 0 : Number(rawPrice);
  if (!Number.isFinite(priceRubles) || priceRubles < 0) errors.push('price_rubles: non-negative number');

  const rawModes = body.modes ?? content.modes ?? ['pickup', 'online'];
  const modes = Array.isArray(rawModes) ? rawModes.filter((m: unknown) => LISTING_MODES.includes(String(m))) : [];
  if (!Array.isArray(rawModes) || modes.length !== rawModes.length) errors.push(`modes: subset of ${LISTING_MODES.join(', ')}`);

  if (errors.length > 0) return { ok: false, errors };

  const now = Date.now();
  return {
    ok: true,
    listing: {
      id: 'listing-' + now + '-' + Math.random().toString(36).substring(2, 8),
      owner: ownerPrincipalId,
      author_name: text(body.author_name ?? content.author_name) || ownerPrincipalId,
      content: {
        title,
        description,
        category,
        subcategory: text(body.subcategory ?? content.subcategory) || undefined,
        kind,
        modes,
        locality,
        region: text(body.region ?? content.region) || undefined,
        country: text(body.country ?? content.country) || undefined,
        price_minor: priceRubles > 0 ? Math.floor(priceRubles * 100) : null,
        currency: 'RUB',
        condition: text(body.condition ?? content.condition) || 'Указано в описании',
      },
      status: 'draft',
      visibility: 'private',
      revision: 1,
      created_at: now,
      updated_at: now,
      expires_at: now + 3600000 * 24 * 90,
      photos: [],
      responses_count: 0,
    },
  };
}

listingsRouter.get('/api/faces', (_req, res) => {
  res.json([
    { id: 'general', name: 'Все категории', nameEn: 'All Categories', emoji: '🌐', primaryCategories: ['real_estate', 'communities', 'business', 'jobs', 'services', 'things', 'dating', 'rides', 'delivery', 'other'] },
    { id: 'ai_dev', name: 'AI & Dev Hub', nameEn: 'AI & Dev Hub', emoji: '⚡', primaryCategories: ['business', 'jobs', 'services'] },
    { id: 'invest', name: 'Стартапы & Инвесторы', nameEn: 'Startups & Investors', emoji: '💼', primaryCategories: ['business', 'jobs', 'communities'] },
    { id: 'dating', name: 'Знакомства & Дейтинг', nameEn: 'Agentic Dating', emoji: '❤️', primaryCategories: ['dating', 'communities'] },
    { id: 'taxi', name: 'Такси & Поездки', nameEn: 'Taxi & Rides On-Demand', emoji: '🚕', primaryCategories: ['rides'] },
    { id: 'services', name: 'Мастера & Услуги', nameEn: 'Local Pros & Services', emoji: '🛠️', primaryCategories: ['services', 'jobs'] },
    { id: 'logistics', name: 'Курьеры & Грузы', nameEn: 'Couriers & Cargo', emoji: '🚚', primaryCategories: ['delivery'] },
    { id: 'real_estate', name: 'Недвижимость & Локации', nameEn: 'Real Estate & Spaces', emoji: '🏢', primaryCategories: ['real_estate'] },
  ]);
});

listingsRouter.get('/api/listings', (req, res) => {
  try {
    const { category, kind, locality, query, categories, face } = req.query as any;
    let categoryList: string[] | undefined = undefined;
    if (typeof categories === 'string' && categories.trim()) {
      categoryList = categories.split(',').map((c: string) => c.trim()).filter(Boolean);
    } else if (Array.isArray(categories)) {
      categoryList = categories.map(String);
    } else if (face && typeof face === 'string') {
      const faceCategoryMap: Record<string, string[]> = {
        ai_dev: ['business', 'jobs', 'services'],
        invest: ['business', 'jobs', 'communities'],
        dating: ['dating', 'communities'],
        taxi: ['rides'],
        services: ['services', 'jobs'],
        logistics: ['delivery'],
        real_estate: ['real_estate'],
      };
      categoryList = faceCategoryMap[face];
    }
    const listings = getListingsFromDb({ category, categories: categoryList, kind, locality, query });
    res.json(listings.map(toPublicListing));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

listingsRouter.get('/api/listings/:id', (req, res) => {
  try {
    const listing = getListingByIdFromDb(req.params.id);
    if (!listing) {
      res.status(404).json({ error: 'Listing not found' });
      return;
    }
    res.json(toPublicListing(listing));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

listingsRouter.post('/api/listings', requireAuth, rateLimit('listings', 'RATE_LIMIT_LISTINGS_PER_MINUTE', 30), (req, res) => {
  const principalId = req.principal!.principalId;
  const normalized = normalizeListingInput(req.body || {}, principalId);
  if (!normalized.ok) {
    res.status(422).json({ error: 'invalid_listing', errors: normalized.errors });
    return;
  }
  try {
    const created = createListingInDb(normalized.listing);
    if (created) {
      void indexListingEmbedding(created);
    }
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

listingsRouter.put('/api/listings/:id', requireAuth, (req, res) => {
  try {
    const listingId = String(req.params.id);
    const listing = getListingByIdFromDb(listingId);
    if (!listing) {
      res.status(404).json({ error: 'not_found', message: 'Listing not found' });
      return;
    }
    if (listing.owner !== req.principal!.principalId) {
      res.status(403).json({ error: 'forbidden', message: 'Не являетесь владельцем объявления' });
      return;
    }

    const updated = updateListingInDb(listingId, req.body || {}, req.principal!.principalId);
    if (!updated) {
      res.status(400).json({ error: 'update_failed', message: 'Could not update listing' });
      return;
    }
    void indexListingEmbedding(updated);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

listingsRouter.post('/api/listings/:id/preview', requireAuth, (req, res) => {
  try {
    const listingId = String(req.params.id);
    const listing = getListingByIdFromDb(listingId);
    if (!listing) {
      res.status(404).json({ error: 'not_found', message: 'Listing not found' });
      return;
    }
    if (listing.owner !== req.principal!.principalId) {
      res.status(403).json({ error: 'forbidden', message: 'Не являетесь владельцем объявления' });
      return;
    }

    const consentToken = `consent-${listing.id}-r${listing.revision}-${Date.now()}`;
    res.json({
      listing_id: listing.id,
      revision: listing.revision,
      status: listing.status,
      consent_token: consentToken,
      preview: toPublicListing(listing),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

listingsRouter.post('/api/listings/:id/publish', requireAuth, (req, res) => {
  try {
    const listingId = String(req.params.id);
    const { consent_token, revision } = req.body || {};
    if (!consent_token || typeof consent_token !== 'string') {
      res.status(422).json({ error: 'consent_required', message: 'consent_token is required' });
      return;
    }
    const expectedRevision = Number(revision);
    if (!Number.isInteger(expectedRevision) || expectedRevision < 1) {
      res.status(422).json({ error: 'invalid_revision', message: 'revision must be a positive integer' });
      return;
    }

    const result = publishListingInDb(listingId, req.principal!.principalId, expectedRevision);
    if (!result.success) {
      if (result.reason === 'not_found') {
        res.status(404).json({ error: 'not_found', message: 'Listing not found' });
        return;
      }
      if (result.reason === 'forbidden') {
        res.status(403).json({ error: 'forbidden', message: 'Не являетесь владельцем объявления' });
        return;
      }
      if (result.reason === 'revision_mismatch') {
        res.status(409).json({ error: 'revision_mismatch', current_revision: result.currentRevision });
        return;
      }
      res.status(400).json({ error: result.reason });
      return;
    }

    const publicListing = toPublicListing(result.listing);
    dispatchWebhooksForEvent('listing.published', publicListing);
    res.json(publicListing);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

listingsRouter.post('/api/listings/:id/withdraw', requireAuth, (req, res) => {
  try {
    const listingId = String(req.params.id);
    const result = withdrawListingInDb(listingId, req.principal!.principalId);
    if (!result.success) {
      if (result.reason === 'not_found') {
        res.status(404).json({ error: 'not_found', message: 'Listing not found' });
        return;
      }
      if (result.reason === 'forbidden') {
        res.status(403).json({ error: 'forbidden', message: 'Не являетесь владельцем объявления' });
        return;
      }
      res.status(400).json({ error: result.reason });
      return;
    }

    dispatchWebhooksForEvent('listing.withdrawn', { id: listingId, owner: req.principal!.principalId });
    res.json({ success: true, status: 'archived', listing_id: listingId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
