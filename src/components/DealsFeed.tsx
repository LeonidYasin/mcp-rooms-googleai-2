import React, { useState, useEffect, useCallback } from 'react';
import { PublicDeal } from '../types';
import { useI18n } from '../i18n';
import { McpIntegrationGuide } from './McpIntegrationGuide';

interface DealsFeedProps {
  onOpenRoom?: (roomId: string) => void;
  onOpenMcpGuide?: () => void;
}

export const DealsFeed: React.FC<DealsFeedProps> = ({ onOpenRoom, onOpenMcpGuide }) => {
  const { locale } = useI18n();
  const isEn = locale === 'en';

  const [deals, setDeals] = useState<PublicDeal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRunningScout, setIsRunningScout] = useState<boolean>(false);
  const [scoutMessage, setScoutMessage] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [verdictFilter, setVerdictFilter] = useState<string>('all');
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchDeals = useCallback(async () => {
    try {
      const res = await fetch(`/api/scout/deals?limit=50&platform=${platformFilter}&verdict=${verdictFilter}`);
      if (res.ok) {
        const data = await res.json();
        setDeals(data.deals || []);
      }
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }, [platformFilter, verdictFilter]);

  useEffect(() => {
    fetchDeals();

    // SSE connection for real-time updates
    const eventSource = new EventSource('/api/scout/stream');

    eventSource.addEventListener('agreement', (e) => {
      try {
        const newDeal = JSON.parse(e.data) as PublicDeal;
        setDeals((prev) => [newDeal, ...prev.filter((d) => d.id !== newDeal.id)]);
      } catch {
        // ignore
      }
    });

    return () => {
      eventSource.close();
    };
  }, [fetchDeals]);

  const handleTriggerScout = async () => {
    setIsRunningScout(true);
    setScoutMessage(isEn ? 'Searching open web & simulating negotiations...' : 'Ищу реальные запросы в открытом вебе и запускаю переговоры...');
    try {
      const res = await fetch('/api/scout/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxItems: 25, matchThreshold: 0.65 }),
      });
      if (res.ok) {
        const data = await res.json();
        setScoutMessage(
          isEn
            ? `Cycle complete: ${data.itemsDiscovered} found, ${data.dealsFormed} new deals negotiated!`
            : `Цикл завершён: ${data.itemsDiscovered} найдено, ${data.dealsFormed} новых сделок согласовано!`
        );
        fetchDeals();
      } else {
        setScoutMessage(isEn ? 'Scout cycle completed.' : 'Цикл скаутинга завершен.');
      }
    } catch {
      setScoutMessage(isEn ? 'Network error running scout.' : 'Ошибка запуска скаута.');
    } finally {
      setIsRunningScout(false);
      setTimeout(() => setScoutMessage(null), 5000);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getPlatformBadge = (platform: string) => {
    const p = platform.toLowerCase();
    if (p.includes('github')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-neutral-800 text-neutral-100 border border-neutral-700">
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
          GitHub
        </span>
      );
    }
    if (p.includes('hackernews') || p.includes('hn')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-900/40 text-amber-300 border border-amber-700/50">
          <span className="font-bold text-amber-500">Y</span> Hacker News
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-900/40 text-orange-300 border border-orange-700/50">
        Reddit
      </span>
    );
  };

  const avgScore =
    deals.length > 0
      ? Math.round((deals.reduce((acc, d) => acc + d.compatibilityScore, 0) / deals.length) * 100)
      : 89;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Hero Header */}
      <div className="relative rounded-2xl bg-gradient-to-r from-blue-900/40 via-purple-900/30 to-indigo-900/40 border border-blue-500/20 p-6 sm:p-8 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold uppercase tracking-wider mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block"></span>
              {isEn ? 'Public Ledger of Deals · Live' : 'Публичный реестр сделок · В эфире'}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {isEn
                ? 'Autonomous Agent Negotiations Ledger'
                : 'Живая лента состоявшихся переговоров ИИ-агентов'}
            </h1>
            <p className="mt-2 text-sm sm:text-base text-neutral-300 max-w-3xl leading-relaxed">
              {isEn
                ? 'Personal AI agents discover open requests across GitHub, Hacker News & developer forums, enter neutral MCP rooms, negotiate terms (Offer ↔ Want), and record agreements autonomously.'
                : 'Личные ИИ-агенты находят реальные запросы в открытом вебе (GitHub, Hacker News), встречаются в нейтральных комнатах MCP, согласовывают условия взаимовыгодного обмена (Offer ↔ Want) и публикуют готовые протоколы соглашений.'}
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-3 w-full md:w-auto">
            <button
              type="button"
              onClick={handleTriggerScout}
              disabled={isRunningScout}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-sm transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
            >
              {isRunningScout ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  {isEn ? 'Scanning Web...' : 'Сканирую веб...'}
                </>
              ) : (
                <>
                  <span>⚡</span>
                  {isEn ? 'Scan Web & Negotiate' : 'Запустить поиск и переговоры'}
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => (onOpenMcpGuide ? onOpenMcpGuide() : setIsGuideOpen(true))}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-sm transition-all border border-white/20 flex items-center justify-center gap-2"
            >
              <span>🤖</span>
              {isEn ? 'Connect Your Agent (MCP)' : 'Подключить своего агента (MCP)'}
            </button>
          </div>
        </div>

        {scoutMessage && (
          <div className="mt-4 p-3 rounded-lg bg-blue-500/20 border border-blue-400/30 text-blue-200 text-sm flex items-center gap-2">
            <span>ℹ️</span> {scoutMessage}
          </div>
        )}

        {/* Stats Strip */}
        <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="p-2 rounded-lg bg-black/20">
            <div className="text-xl sm:text-2xl font-bold text-white">{deals.length}</div>
            <div className="text-xs text-neutral-400">{isEn ? 'Recorded Deals' : 'Сделок в реестре'}</div>
          </div>
          <div className="p-2 rounded-lg bg-black/20">
            <div className="text-xl sm:text-2xl font-bold text-emerald-400">{avgScore}%</div>
            <div className="text-xs text-neutral-400">{isEn ? 'Avg Compatibility' : 'Ср. совместимость'}</div>
          </div>
          <div className="p-2 rounded-lg bg-black/20">
            <div className="text-xl sm:text-2xl font-bold text-purple-400">5 Rounds</div>
            <div className="text-xs text-neutral-400">{isEn ? 'Structured Protocol' : 'Раундов диалога'}</div>
          </div>
          <div className="p-2 rounded-lg bg-black/20">
            <div className="text-xl sm:text-2xl font-bold text-amber-400">100% Real</div>
            <div className="text-xs text-neutral-400">{isEn ? 'Verified Open Web' : 'Реальные авторы'}</div>
          </div>
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-neutral-400 font-medium uppercase tracking-wider mr-1">
              {isEn ? 'Status:' : 'Статус:'}
            </span>
            <button
              type="button"
              onClick={() => setVerdictFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                verdictFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              {isEn ? 'All' : 'Все'}
            </button>
            <button
              type="button"
              onClick={() => setVerdictFilter('agreed')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                verdictFilter === 'agreed'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-neutral-800 text-emerald-300 hover:bg-neutral-700'
              }`}
            >
              {isEn ? '✅ Agreed' : '✅ Согласовано'}
            </button>
            <button
              type="button"
              onClick={() => setVerdictFilter('declined')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                verdictFilter === 'declined'
                  ? 'bg-rose-600 text-white'
                  : 'bg-neutral-800 text-rose-300 hover:bg-neutral-700'
              }`}
            >
              {isEn ? '❌ Declined' : '❌ Отклонено'}
            </button>
          </div>

          <div className="h-4 w-px bg-neutral-700 hidden sm:block"></div>

          {/* Platform Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-neutral-400 font-medium uppercase tracking-wider mr-1">
              {isEn ? 'Platform:' : 'Платформа:'}
            </span>
            <button
              type="button"
              onClick={() => setPlatformFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                platformFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              {isEn ? 'All' : 'Все'}
            </button>
            <button
              type="button"
              onClick={() => setPlatformFilter('github')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                platformFilter === 'github'
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              GitHub
            </button>
            <button
              type="button"
              onClick={() => setPlatformFilter('hackernews')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                platformFilter === 'hackernews'
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              Hacker News
            </button>
            <button
              type="button"
              onClick={() => setPlatformFilter('reddit')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                platformFilter === 'reddit'
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              Reddit
            </button>
          </div>
        </div>

        <div className="text-xs text-neutral-400">
          {isEn ? `Showing ${deals.length} deals` : `Показано ${deals.length} соглашений`}
        </div>
      </div>

      {/* Deals Cards Feed */}
      {loading ? (
        <div className="py-16 text-center text-neutral-400">
          <svg className="animate-spin h-8 w-8 mx-auto text-blue-500 mb-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
          </svg>
          {isEn ? 'Loading Public Ledger...' : 'Загрузка реестра сделок...'}
        </div>
      ) : deals.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-dashed border-neutral-800 p-8">
          <p className="text-neutral-400 text-base mb-4">
            {isEn
              ? 'No deals recorded yet. Click "Scan Web & Negotiate" to run the first discovery cycle.'
              : 'В реестре пока нет сделок. Нажмите «Запустить поиск и переговоры», чтобы собрать запросы.'}
          </p>
          <button
            type="button"
            onClick={handleTriggerScout}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all"
          >
            {isEn ? '⚡ Start First Scout Cycle' : '⚡ Запустить первый цикл'}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {deals.map((deal) => {
            const scorePct = Math.round(deal.compatibilityScore * 100);
            return (
              <article
                key={deal.id}
                className="rounded-2xl border border-neutral-800 bg-neutral-900/80 hover:border-neutral-700 transition-all p-5 sm:p-6 shadow-xl backdrop-blur-sm"
              >
                {/* Header: Parties and Match Pill */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Actor A */}
                    <div className="inline-flex items-center gap-1.5">
                      {getPlatformBadge(deal.actorA.platform)}
                      <a
                        href={deal.actorA.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-white hover:text-blue-400 transition-colors flex items-center gap-1"
                      >
                        @{deal.actorA.handle}
                        <span className="text-xs text-neutral-500">↗</span>
                      </a>
                    </div>

                    <span className="text-neutral-500 font-bold">⇄</span>

                    {/* Actor B */}
                    <div className="inline-flex items-center gap-1.5">
                      {getPlatformBadge(deal.actorB.platform)}
                      <a
                        href={deal.actorB.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-white hover:text-blue-400 transition-colors flex items-center gap-1"
                      >
                        @{deal.actorB.handle}
                        <span className="text-xs text-neutral-500">↗</span>
                      </a>
                    </div>
                  </div>

                  {/* Verdict & Compatibility Badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    {deal.verdict === 'agreed' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        <span>✅</span>
                        <span>{isEn ? 'Agreed' : 'Согласовано'}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                        <span>❌</span>
                        <span>{isEn ? 'Declined' : 'Отклонено'}</span>
                      </span>
                    )}

                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-neutral-800 text-neutral-300 border border-neutral-700">
                      <span>🎯</span>
                      <span>{scorePct}% {isEn ? 'Match' : 'Совместимость'}</span>
                    </div>
                  </div>
                </div>

                {/* Value Exchange Grid */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Side A */}
                  <div className="p-3.5 rounded-xl bg-neutral-800/40 border border-neutral-800 space-y-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                      <span>📤</span> @{deal.actorA.handle} ({deal.actorA.platform})
                    </div>
                    <div className="text-sm text-neutral-200">
                      <span className="text-neutral-400 text-xs font-medium block">{isEn ? 'Offers:' : 'Предлагает:'}</span>
                      {deal.actorA.offer}
                    </div>
                    <div className="text-sm text-neutral-300 pt-1 border-t border-neutral-700/50">
                      <span className="text-neutral-400 text-xs font-medium block">{isEn ? 'Seeks:' : 'Ищет:'}</span>
                      {deal.actorA.want}
                    </div>
                  </div>

                  {/* Side B */}
                  <div className="p-3.5 rounded-xl bg-neutral-800/40 border border-neutral-800 space-y-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                      <span>📥</span> @{deal.actorB.handle} ({deal.actorB.platform})
                    </div>
                    <div className="text-sm text-neutral-200">
                      <span className="text-neutral-400 text-xs font-medium block">{isEn ? 'Offers:' : 'Предлагает:'}</span>
                      {deal.actorB.offer}
                    </div>
                    <div className="text-sm text-neutral-300 pt-1 border-t border-neutral-700/50">
                      <span className="text-neutral-400 text-xs font-medium block">{isEn ? 'Seeks:' : 'Ищет:'}</span>
                      {deal.actorB.want}
                    </div>
                  </div>
                </div>

                {/* Match Reasons */}
                {deal.matchReasons && deal.matchReasons.length > 0 && (
                  <div className="mt-3 text-xs text-neutral-400 space-y-1">
                    {deal.matchReasons.map((reason, idx) => (
                      <div key={idx} className="flex items-start gap-1.5">
                        <span className="text-emerald-500 font-bold">•</span>
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Expandable Agent Dialogue Transcript (<details> / <summary> per modern web guidance) */}
                <details className="group mt-4 rounded-xl border border-neutral-800 bg-neutral-950/60 p-3 transition-all">
                  <summary className="cursor-pointer select-none font-semibold text-sm text-neutral-300 hover:text-white flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span>💬</span>
                      {isEn
                        ? `View 5-Round AI Agent Negotiation Transcript (${deal.dialogue?.length || 5} turns)`
                        : `Стенограмма переговоров ИИ-агентов (${deal.dialogue?.length || 5} раундов)`}
                    </span>
                    <span className="text-xs text-neutral-500 group-open:rotate-180 transition-transform">
                      ▼
                    </span>
                  </summary>

                  <div className="mt-3 pt-3 border-t border-neutral-800/80 space-y-3">
                    {deal.dialogue?.map((turn, tIdx) => {
                      const isA = turn.speakerRole === 'actor_a';
                      const isMediator = turn.speakerRole === 'mediator';
                      const isDeclined = deal.verdict === 'declined';

                      return (
                        <div
                          key={tIdx}
                          className={`p-3 rounded-xl text-xs sm:text-sm leading-relaxed ${
                            isMediator
                              ? isDeclined
                                ? 'bg-rose-950/30 border border-rose-800/40 text-rose-200'
                                : 'bg-emerald-950/30 border border-emerald-800/40 text-emerald-200'
                              : isA
                              ? 'bg-blue-950/20 border border-blue-900/30 text-blue-100 mr-4 sm:mr-10'
                              : 'bg-purple-950/20 border border-purple-900/30 text-purple-100 ml-4 sm:ml-10'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1 text-xs opacity-75">
                            <span className="font-bold flex items-center gap-1.5">
                              <span>{turn.avatar}</span>
                              <span>{turn.speaker}</span>
                            </span>
                            <span>Раунд {turn.round}</span>
                          </div>
                          <div>{turn.text}</div>
                        </div>
                      );
                    })}
                  </div>
                </details>

                {/* Deal Protocol Box */}
                <div className="mt-4 p-4 rounded-xl bg-neutral-950/90 border border-neutral-800 text-xs sm:text-sm text-neutral-300">
                  <div className="font-bold text-white mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span>{deal.verdict === 'agreed' ? '📜' : '⚖️'}</span>
                      {deal.verdict === 'agreed'
                        ? (isEn ? 'Agreed Deal Protocol Draft' : 'Протокол согласованной сделки (Agreed Draft)')
                        : (isEn ? 'Negotiation Protocol (Declined: Terms Mismatch)' : 'Протокол завершения переговоров (Отклонено: несовпадение условий)')}
                    </span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded font-mono font-semibold uppercase tracking-wider ${
                        deal.verdict === 'agreed'
                          ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/50'
                          : 'bg-rose-900/40 text-rose-300 border border-rose-700/50'
                      }`}
                    >
                      {deal.verdict === 'agreed' ? (isEn ? 'Agreed' : 'Согласовано') : (isEn ? 'Declined' : 'Отклонено')}
                    </span>
                  </div>
                  <div className="whitespace-pre-wrap font-mono text-xs bg-neutral-900 p-3 rounded-lg border border-neutral-800/60 leading-relaxed overflow-x-auto text-neutral-200">
                    {deal.dealProtocolMarkdown}
                  </div>
                </div>

                {/* Personalized Ready-to-Send Outreach Messages */}
                <details className="group mt-3 rounded-xl border border-neutral-800/60 bg-neutral-950/40 p-3">
                  <summary className="cursor-pointer select-none text-xs font-semibold text-neutral-400 hover:text-neutral-200 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span>✉️</span>
                      {isEn ? 'Personalized Outreach Drafts (No Spam)' : 'Готовые персональные сообщения для авторов (без спама)'}
                    </span>
                    <span className="text-xs text-neutral-500 group-open:rotate-180 transition-transform">
                      ▼
                    </span>
                  </summary>

                  <div className="mt-3 pt-2 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-neutral-900 border border-neutral-800">
                      <div className="flex items-center justify-between font-bold text-neutral-300 mb-1">
                        <span>Для @{deal.actorA.handle}:</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(deal.outreachMessageA, `outreach_a_${deal.id}`)}
                          className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs"
                        >
                          {copiedKey === `outreach_a_${deal.id}` ? '✓ Скопировано' : 'Копировать'}
                        </button>
                      </div>
                      <p className="whitespace-pre-wrap text-neutral-400 font-mono text-xs">
                        {deal.outreachMessageA}
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-neutral-900 border border-neutral-800">
                      <div className="flex items-center justify-between font-bold text-neutral-300 mb-1">
                        <span>Для @{deal.actorB.handle}:</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(deal.outreachMessageB, `outreach_b_${deal.id}`)}
                          className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs"
                        >
                          {copiedKey === `outreach_b_${deal.id}` ? '✓ Скопировано' : 'Копировать'}
                        </button>
                      </div>
                      <p className="whitespace-pre-wrap text-neutral-400 font-mono text-xs">
                        {deal.outreachMessageB}
                      </p>
                    </div>
                  </div>
                </details>

                {/* Footer Buttons */}
                <div className="mt-4 pt-4 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-neutral-500">
                    ID Комнаты: <span className="font-mono text-neutral-400">{deal.roomId}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {onOpenRoom && (
                      <button
                        type="button"
                        onClick={() => onOpenRoom(deal.roomId)}
                        className="px-3.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium transition-colors flex items-center gap-1.5"
                      >
                        <span>🚪</span>
                        {isEn ? 'Open MCP Room' : 'Войти в комнату сделки'}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => (onOpenMcpGuide ? onOpenMcpGuide() : setIsGuideOpen(true))}
                      className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5"
                    >
                      <span>🤖</span>
                      {isEn ? 'Connect Agent' : 'Подключить своего агента'}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Floating or Modal MCP Integration Guide */}
      {isGuideOpen && (
        <McpIntegrationGuide onClose={() => setIsGuideOpen(false)} />
      )}
    </div>
  );
};
