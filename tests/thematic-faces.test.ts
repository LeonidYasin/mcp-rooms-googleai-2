import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { createApp } from '../server/app';
import { FACES_REGISTRY, getFaceConfig, ALL_FACES } from '../src/lib/faces';
import { NegotiationTerms } from '../server/negotiator';

describe('Thematic Multi-Face UI & Kernel Vertical Modules', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      if (server) {
        server.close(() => resolve());
      } else {
        resolve();
      }
    });
  });

  describe('FACES_REGISTRY Frontend Configuration', () => {
    it('defines all 8 required marketplace faces', () => {
      const requiredFaces = [
        'general',
        'ai_dev',
        'invest',
        'dating',
        'taxi',
        'services',
        'logistics',
        'real_estate',
      ];
      for (const faceId of requiredFaces) {
        expect(FACES_REGISTRY[faceId as keyof typeof FACES_REGISTRY]).toBeDefined();
        const config = getFaceConfig(faceId);
        expect(config.id).toBe(faceId);
        expect(config.emoji.length).toBeGreaterThan(0);
        expect(config.nameRu.length).toBeGreaterThan(0);
        expect(config.nameEn.length).toBeGreaterThan(0);
        expect(config.taglineRu.length).toBeGreaterThan(0);
        expect(config.primaryCategories.length).toBeGreaterThan(0);
        expect(config.quickChips.length).toBeGreaterThan(0);
      }
    });

    it('returns general face as fallback for unknown face ids', () => {
      const config = getFaceConfig('unknown_random_face');
      expect(config.id).toBe('general');
    });

    it('has specialized domain features for invest, dating, and taxi', () => {
      const invest = getFaceConfig('invest');
      expect(invest.specialFeature.type).toBe('venture');
      expect(invest.primaryCategories).toContain('business');

      const dating = getFaceConfig('dating');
      expect(dating.specialFeature.type).toBe('dating');
      expect(dating.primaryCategories).toContain('dating');

      const taxi = getFaceConfig('taxi');
      expect(taxi.specialFeature.type).toBe('rides');
      expect(taxi.primaryCategories).toContain('rides');

      const aiDev = getFaceConfig('ai_dev');
      expect(aiDev.specialFeature.type).toBe('compute');
    });
  });

  describe('REST API /api/faces & /api/listings?face=...', () => {
    it('GET /api/faces returns registry of all available faces', async () => {
      const res = await fetch(`${baseUrl}/api/faces`);
      expect(res.status).toBe(200);
      const faces = await res.json();
      expect(Array.isArray(faces)).toBe(true);
      expect(faces.length).toBe(8);

      const ids = faces.map((f: any) => f.id);
      expect(ids).toContain('general');
      expect(ids).toContain('invest');
      expect(ids).toContain('dating');
      expect(ids).toContain('taxi');
    });

    it('GET /api/listings?face=taxi filters listings strictly by rides category', async () => {
      const res = await fetch(`${baseUrl}/api/listings?face=taxi`);
      expect(res.status).toBe(200);
      const listings = await res.json();
      expect(Array.isArray(listings)).toBe(true);
      expect(listings.length).toBeGreaterThan(0);
      for (const item of listings) {
        expect(item.content.category).toBe('rides');
      }
    });

    it('GET /api/listings?face=dating filters listings by dating/communities category', async () => {
      const res = await fetch(`${baseUrl}/api/listings?face=dating`);
      expect(res.status).toBe(200);
      const listings = await res.json();
      expect(Array.isArray(listings)).toBe(true);
      expect(listings.length).toBeGreaterThan(0);
      for (const item of listings) {
        expect(['dating', 'communities']).toContain(item.content.category);
      }
    });

    it('GET /api/listings?face=invest filters listings by business/jobs/communities category', async () => {
      const res = await fetch(`${baseUrl}/api/listings?face=invest`);
      expect(res.status).toBe(200);
      const listings = await res.json();
      expect(Array.isArray(listings)).toBe(true);
      expect(listings.length).toBeGreaterThan(0);
      for (const item of listings) {
        expect(['business', 'jobs', 'communities']).toContain(item.content.category);
      }
    });
  });

  describe('Kernel Negotiation Domain Extensions', () => {
    it('validates specialized negotiation terms structure', () => {
      const terms: NegotiationTerms = {
        price: '75 000 $',
        schedule: 'Закрытие раунда в течение 30 дней',
        investment: {
          valuation: '1 250 000 $',
          ticketSize: '75 000 $',
          instrument: 'SAFE',
          equityShare: '6%',
        },
        dating: {
          venue: 'Кафе Смена, Казань',
          activity: 'Кофе и обсуждение архитектуры',
          datingGoal: 'Знакомство и общение',
        },
        ride: {
          origin: 'ул. Кремлевская, 1',
          destination: 'Аэропорт Казань',
          vehicleClass: 'Комфорт+',
          departureTime: '15:30',
        },
      };

      expect(terms.investment?.instrument).toBe('SAFE');
      expect(terms.investment?.equityShare).toBe('6%');
      expect(terms.dating?.venue).toBe('Кафе Смена, Казань');
      expect(terms.ride?.vehicleClass).toBe('Комфорт+');
    });
  });
});
