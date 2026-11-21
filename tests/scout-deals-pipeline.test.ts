import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { initDatabase, getPublicDealsFromDb, getPublicDealByIdFromDb, getScoutProfilesFromDb } from '../server/db';
import { extractHeuristicProfile } from '../server/extractor';
import { findScoutMatches, simulateAutonomousNegotiation } from '../server/scout-matcher';
import { RawScoutItem } from '../server/scout';
import { createApp } from '../server/app';

describe('Autonomous Scout & Public Ledger Pipeline', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    initDatabase();
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('correctly extracts Offer/Want profiles from unstructured posts', () => {
    const rawGitHub: RawScoutItem = {
      id: 'gh_test_101',
      sourceUrl: 'https://github.com/example/polyagent/issues/101',
      platform: 'github',
      authorHandle: 'alice_dev',
      title: 'Looking for contributors to build MCP integration',
      body: 'We are building an open-source AI agent system. Looking for developers to contribute MCP protocol servers. Rev-share and equity available for core contributors. Remote only.',
      tags: ['mcp', 'help wanted', 'ai-agent'],
      createdAt: Date.now(),
    };

    const extracted = extractHeuristicProfile(rawGitHub);

    expect(extracted.offer.summary).toBeTruthy();
    expect(extracted.want.summary).toContain('Разработчики');
    expect(extracted.offer.category).toBe('services');
    expect(extracted.negotiation_constraints.budget_or_terms).toContain('Equity / Rev-share');
    expect(extracted.negotiation_constraints.deal_breakers.some((d) => d.includes('Remote'))).toBe(true);
    expect(extracted.offer.vector_text).toContain('Looking for contributors');
  });

  it('finds complementary asymmetric matches between Offer and Want', () => {
    const profileA = {
      id: 'prof_test_a',
      sourceUrl: 'https://github.com/a/repo/issues/1',
      platform: 'github',
      authorHandle: 'dev_a',
      title: 'Need GTM partner for MCP agent',
      offer: {
        summary: 'Готовый рабочий MCP сервер и SDK для агентов',
        category: 'services',
        vector_text: 'Готовый рабочий MCP сервер и SDK для агентов на TypeScript',
      },
      want: {
        summary: 'Ищу маркетолога и GTM ко-фаундера для продвижения',
        category: 'business',
        urgency: 'high' as const,
        vector_text: 'Ищу маркетолога и GTM ко-фаундера для продвижения продукта',
      },
      negotiationConstraints: {
        budget_or_terms: 'Rev-share 50/50',
        deal_breakers: ['Только Remote'],
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const profileB = {
      id: 'prof_test_b',
      sourceUrl: 'https://news.ycombinator.com/item?id=999999',
      platform: 'hackernews',
      authorHandle: 'marketer_b',
      title: 'SEEKING WORK / Co-founder | GTM Specialist',
      offer: {
        summary: 'Экспертиза в GTM, запуск на Product Hunt и привлечение пользователей',
        category: 'business',
        vector_text: 'Экспертиза в GTM, запуск на Product Hunt и маркетинг AI продуктов',
      },
      want: {
        summary: 'Ищу технического партнера с готовым MCP агентом',
        category: 'services',
        urgency: 'high' as const,
        vector_text: 'Ищу технического партнера с готовым MCP агентом и SDK',
      },
      negotiationConstraints: {
        budget_or_terms: 'Rev-share / долевое участие',
        deal_breakers: ['Прозрачный трекинг'],
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const matches = findScoutMatches([profileA, profileB], 0.60);
    expect(matches.length).toBeGreaterThanOrEqual(1);

    const match = matches[0];
    expect(match.totalCompatibility).toBeGreaterThanOrEqual(0.60);
    expect(match.matchReasons.length).toBeGreaterThan(0);
  });

  it('simulates a 5-round agent-to-agent dialogue and generates deal protocol and outreach', async () => {
    const actorA = {
      id: 'prof_sim_a',
      sourceUrl: 'https://github.com/author1/proj/issues/5',
      platform: 'github',
      authorHandle: 'alex_coder',
      title: 'MCP tool provider',
      offer: {
        summary: 'Разработка MCP коннекторов к SQLite и Postgres',
        category: 'services',
        vector_text: 'Разработка MCP коннекторов к базам данных',
      },
      want: {
        summary: 'Интеграция с готовым агентным фреймворком',
        category: 'business',
        urgency: 'medium' as const,
        vector_text: 'Интеграция с агентным фреймворком',
      },
      negotiationConstraints: {
        budget_or_terms: 'Rev-share 30%',
        deal_breakers: ['MIT License'],
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const actorB = {
      id: 'prof_sim_b',
      sourceUrl: 'https://news.ycombinator.com/item?id=123456',
      platform: 'hackernews',
      authorHandle: 'elena_product',
      title: 'Agent framework seeking storage integration',
      offer: {
        summary: 'Готовый агентный оркестратор и пользовательская база',
        category: 'business',
        vector_text: 'Готовый агентный оркестратор',
      },
      want: {
        summary: 'Разработчик баз данных и коннекторов',
        category: 'services',
        urgency: 'high' as const,
        vector_text: 'Разработчик баз данных и коннекторов к SQLite',
      },
      negotiationConstraints: {
        budget_or_terms: 'По спринтам / Rev-share',
        deal_breakers: ['SLA на багфиксы'],
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const result = await simulateAutonomousNegotiation(actorA, actorB, 0.92);

    expect(result.dialogue).toHaveLength(5);
    expect(result.dialogue[0].round).toBe(1);
    expect(result.dialogue[4].round).toBe(5);
    expect(result.dealProtocol).toContain('Протокол сделки');
    expect(result.dealProtocol).toContain('alex_coder');
    expect(result.dealProtocol).toContain('elena_product');
    expect(result.outreachA).toContain('alex_coder');
    expect(result.outreachB).toContain('elena_product');
  });

  it('serves deals feed via GET /api/scout/deals and GET /api/scout/stats', async () => {
    const statsRes = await fetch(`${baseUrl}/api/scout/stats`);
    expect(statsRes.status).toBe(200);
    const stats = await statsRes.json() as any;
    expect(stats).toHaveProperty('totalDeals');
    expect(stats).toHaveProperty('totalProfiles');
    expect(stats.activeScout).toBe(true);

    const dealsRes = await fetch(`${baseUrl}/api/scout/deals`);
    expect(dealsRes.status).toBe(200);
    const dealsData = await dealsRes.json() as any;
    expect(dealsData).toHaveProperty('deals');
    expect(Array.isArray(dealsData.deals)).toBe(true);

    if (dealsData.deals.length > 0) {
      const firstDeal = dealsData.deals[0];
      expect(firstDeal).toHaveProperty('id');
      expect(firstDeal).toHaveProperty('roomId');
      expect(firstDeal).toHaveProperty('actorA');
      expect(firstDeal).toHaveProperty('actorB');
      expect(firstDeal).toHaveProperty('dialogue');
      expect(firstDeal).toHaveProperty('dealProtocolMarkdown');

      const singleRes = await fetch(`${baseUrl}/api/scout/deals/${firstDeal.id}`);
      expect(singleRes.status).toBe(200);
      const single = await singleRes.json() as any;
      expect(single.id).toBe(firstDeal.id);
    }
  });
});
