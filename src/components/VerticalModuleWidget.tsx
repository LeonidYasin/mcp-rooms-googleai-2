import React, { useState } from 'react';
import { FaceId, getFaceConfig } from '../lib/faces';
import { useI18n } from '../i18n';

interface VerticalModuleWidgetProps {
  currentFace: FaceId;
  onOpenPublish: () => void;
  onOpenRoom?: (roomId: string) => void;
  onSelectFace: (face: FaceId) => void;
}

export const VerticalModuleWidget: React.FC<VerticalModuleWidgetProps> = ({
  currentFace,
  onOpenPublish,
  onOpenRoom,
}) => {
  const { locale } = useI18n();
  const isEn = locale === 'en';
  const face = getFaceConfig(currentFace);

  // Taxi State
  const [taxiOrigin, setTaxiOrigin] = useState('ул. Кремлёвская, 1');
  const [taxiDest, setTaxiDest] = useState('Аэропорт Казань');
  const [taxiTier, setTaxiTier] = useState<'comfort' | 'standard' | 'minivan'>('comfort');
  const [taxiBidding, setTaxiBidding] = useState(false);
  const [taxiPhonePrice, setTaxiPhonePrice] = useState<number | null>(null);

  // Invest State
  const [ticketVal, setTicketVal] = useState<number>(50000);
  const [valuationVal, setValuationVal] = useState<number>(1000000);
  const [safeGenerated, setSafeGenerated] = useState(false);

  // Dating State
  const [datingGoal, setDatingGoal] = useState('coffee');
  const [datingMatched, setDatingMatched] = useState(false);

  // AI Dev State
  const [gpuSelected, setGpuSelected] = useState('H100');
  const [nodeBooked, setNodeBooked] = useState(false);

  if (currentFace === 'general') {
    return null;
  }

  // 1. TAXI WIDGET
  if (currentFace === 'taxi') {
    return (
      <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-[var(--ink)] shadow-xs transition-all animate-in fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 border-b border-amber-500/20 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🚕</span>
            <div>
              <h3 className="font-black text-sm sm:text-base text-[var(--ink)] tracking-tight">
                {isEn ? 'On-Demand Ride Radar & 60-Second Bidding' : 'Радар такси & Динамический торг за 60 секунд'}
              </h3>
              <p className="text-[11px] text-[var(--muted)]">
                {isEn ? 'No 30% aggregator commission. Direct peer-to-peer driver consensus.' : 'Прямой заказ без 30% комиссии агрегатора. Моментальный торг в комнате.'}
              </p>
            </div>
          </div>
          <span className="text-[10px] uppercase font-extrabold bg-amber-500 text-black px-2 py-0.5 rounded-full self-start sm:self-auto">
            ⚡ LIVE DISPATCH
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-[var(--muted)] uppercase mb-1">
              {isEn ? 'From (Origin):' : 'Откуда (Точка А):'}
            </label>
            <input
              type="text"
              value={taxiOrigin}
              onChange={(e) => setTaxiOrigin(e.target.value)}
              className="w-full h-9 px-2.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] font-semibold outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[var(--muted)] uppercase mb-1">
              {isEn ? 'To (Destination):' : 'Куда (Точка Б):'}
            </label>
            <input
              type="text"
              value={taxiDest}
              onChange={(e) => setTaxiDest(e.target.value)}
              className="w-full h-9 px-2.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] font-semibold outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[var(--muted)] uppercase mb-1">
              {isEn ? 'Class:' : 'Класс поездки:'}
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setTaxiTier('comfort')}
                className={`flex-1 h-9 rounded-lg font-bold text-xs border cursor-pointer ${
                  taxiTier === 'comfort' ? 'bg-amber-500 text-black border-amber-600 shadow-xs' : 'bg-[var(--surface)] border-[var(--line)]'
                }`}
              >
                Комфорт+
              </button>
              <button
                type="button"
                onClick={() => setTaxiTier('standard')}
                className={`flex-1 h-9 rounded-lg font-bold text-xs border cursor-pointer ${
                  taxiTier === 'standard' ? 'bg-amber-500 text-black border-amber-600 shadow-xs' : 'bg-[var(--surface)] border-[var(--line)]'
                }`}
              >
                Стандарт
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 pt-2">
          {taxiBidding ? (
            <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
              <span>{isEn ? 'Agents bidding... Found Geely Monjaro (Timur V.) · 1,200 ₽' : 'Торг агентов... Найдена оферта: Geely Monjaro (Тимур В.) · 1 200 ₽'}</span>
            </div>
          ) : taxiPhonePrice ? (
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <span>✅</span>
              <span>{isEn ? `Agreed fare: ${taxiPhonePrice} ₽. Room ready!` : `Согласован тариф: ${taxiPhonePrice} ₽. Комната готова!`}</span>
            </div>
          ) : (
            <div className="text-[11px] text-[var(--muted)]">
              {isEn ? 'Estimated fair price: 1,150–1,300 ₽' : 'Ориентировочная цена поездки: 1 150 – 1 300 ₽'}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setTaxiBidding(true);
              setTimeout(() => {
                setTaxiBidding(false);
                setTaxiPhonePrice(1200);
              }, 1200);
            }}
            className="bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer shadow-xs active:scale-98"
          >
            {isEn ? '📡 Start Agent Bidding' : '📡 Запустить торг агентов (60с)'}
          </button>
        </div>
      </div>
    );
  }

  // 2. INVEST / VENTURE WIDGET
  if (currentFace === 'invest') {
    const equityPct = ((ticketVal / valuationVal) * 100).toFixed(1);
    return (
      <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-violet-500/10 border border-violet-500/30 text-[var(--ink)] shadow-xs transition-all animate-in fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 border-b border-violet-500/20 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💼</span>
            <div>
              <h3 className="font-black text-sm sm:text-base text-[var(--ink)] tracking-tight">
                {isEn ? 'Venture Deal Room & SAFE Round Simulator' : 'Венчурный калькулятор SAFE & Deal Room'}
              </h3>
              <p className="text-[11px] text-[var(--muted)]">
                {isEn ? 'Instant valuation, equity share and milestone tranches inside private rooms.' : 'Моментальный расчет долей, оценки раунда и условий Term Sheet.'}
              </p>
            </div>
          </div>
          <span className="text-[10px] uppercase font-extrabold bg-violet-600 text-white px-2 py-0.5 rounded-full self-start sm:self-auto">
            🦄 PRE-SEED / SEED
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-[var(--muted)] uppercase mb-1">
              {isEn ? 'Check Size (Ticket):' : 'Чек инвестиций (Ticket):'}
            </label>
            <div className="flex items-center gap-1 font-mono font-bold text-sm bg-[var(--surface)] border border-[var(--line)] px-2.5 py-1.5 rounded-lg">
              <span>$</span>
              <input
                type="number"
                step={5000}
                value={ticketVal}
                onChange={(e) => setTicketVal(Number(e.target.value) || 0)}
                className="w-full bg-transparent outline-none font-bold text-violet-600 dark:text-violet-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[var(--muted)] uppercase mb-1">
              {isEn ? 'Post-Money Valuation Cap:' : 'Оценка компании (Valuation Cap):'}
            </label>
            <div className="flex items-center gap-1 font-mono font-bold text-sm bg-[var(--surface)] border border-[var(--line)] px-2.5 py-1.5 rounded-lg">
              <span>$</span>
              <input
                type="number"
                step={50000}
                value={valuationVal}
                onChange={(e) => setValuationVal(Number(e.target.value) || 1)}
                className="w-full bg-transparent outline-none font-bold text-violet-600 dark:text-violet-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[var(--muted)] uppercase mb-1">
              {isEn ? 'Resulting Equity Share:' : 'Доля инвестора (Equity):'}
            </label>
            <div className="h-9 flex items-center justify-between px-3 rounded-lg bg-violet-600 text-white font-mono font-black text-sm shadow-xs">
              <span>{equityPct}%</span>
              <span className="text-[10px] font-sans font-normal opacity-90">Post-Money SAFE</span>
            </div>
          </div>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="text-[11px] text-[var(--muted)] flex items-center gap-1.5">
            <span>🔒</span>
            <span>{isEn ? 'Pitch Decks & Financial models protected by room NDA' : 'Питч-деки и финмодели защищены авто-NDA комнаты'}</span>
          </div>

          <button
            type="button"
            onClick={() => {
              setSafeGenerated(true);
              setTimeout(() => setSafeGenerated(false), 2500);
            }}
            className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer shadow-xs active:scale-98"
          >
            {safeGenerated
              ? (isEn ? '✓ Term Sheet drafted in Room' : '✓ Проект Term Sheet сформирован')
              : (isEn ? '📑 Draft Investment Term Sheet' : '📑 Сформировать драфт Term Sheet')}
          </button>
        </div>
      </div>
    );
  }

  // 3. DATING WIDGET
  if (currentFace === 'dating') {
    return (
      <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-pink-500/10 border border-pink-500/30 text-[var(--ink)] shadow-xs transition-all animate-in fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 border-b border-pink-500/20 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-2xl">❤️</span>
            <div>
              <h3 className="font-black text-sm sm:text-base text-[var(--ink)] tracking-tight">
                {isEn ? 'Agentic Matchmaker · Zero-Knowledge Dating' : 'Мэтчмейкинг ценностей · Дейтинг без свайпов'}
              </h3>
              <p className="text-[11px] text-[var(--muted)]">
                {isEn ? 'Contacts hidden. Personal Angel agents match hobbies, goals and life values.' : 'Номера скрыты. Агенты-ангелы находят пару по глубинным ценностям.'}
              </p>
            </div>
          </div>
          <span className="text-[10px] uppercase font-extrabold bg-pink-500 text-white px-2 py-0.5 rounded-full self-start sm:self-auto">
            💌 SAFE DATE MODE
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-[var(--muted)] uppercase mb-1">
              {isEn ? 'First Date Format:' : 'Формат первого свидания:'}
            </label>
            <select
              value={datingGoal}
              onChange={(e) => setDatingGoal(e.target.value)}
              className="w-full h-9 px-2.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] font-semibold outline-none cursor-pointer"
            >
              <option value="coffee">{isEn ? '☕ Coffee & quiet talk' : '☕ Кофе и неспешная беседа'}</option>
              <option value="art">{isEn ? '🎨 Art gallery / Museum' : '🎨 Выставка современного искусства'}</option>
              <option value="cycling">{isEn ? '🚴 Cycling / Outdoor' : '🚴 Велопрогулка на природе'}</option>
              <option value="games">{isEn ? '🎲 Board games night' : '🎲 Вечер настольных игр'}</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[var(--muted)] uppercase mb-1">
              {isEn ? 'Privacy Shield:' : 'Защита приватности:'}
            </label>
            <div className="h-9 flex items-center gap-1.5 px-2.5 rounded-lg border border-pink-500/30 bg-[var(--surface)] text-[11px] font-medium text-pink-700 dark:text-pink-300">
              <span>🛡️</span>
              <span>{isEn ? 'Phone & Socials hidden' : 'Телефон и соцсети скрыты'}</span>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[var(--muted)] uppercase mb-1">
              {isEn ? 'Match Engine:' : 'Алгоритм:'}
            </label>
            <div className="h-9 flex items-center justify-between px-2.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[11px] font-semibold">
              <span>Gemini Embeddings</span>
              <span className="text-emerald-500 font-bold">96%</span>
            </div>
          </div>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="text-[11px] text-[var(--muted)]">
            {datingMatched
              ? (isEn ? '✨ Found 2 compatible soulmates matching your values!' : '✨ Найдено 2 анкеты с совместимостью >90% в Казани!')
              : (isEn ? 'Agent matches communication style and mutual interests' : 'Агент учитывает психотип, чувство юмора и цели')}
          </div>

          <button
            type="button"
            onClick={() => setDatingMatched(true)}
            className="bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer shadow-xs active:scale-98"
          >
            {isEn ? '❤️ Match via Angel Agent' : '❤️ Запустить мэтчинг через Ангела'}
          </button>
        </div>
      </div>
    );
  }

  // 4. AI & DEV WIDGET
  if (currentFace === 'ai_dev') {
    return (
      <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-[var(--ink)] shadow-xs transition-all animate-in fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 border-b border-emerald-500/20 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            <div>
              <h3 className="font-black text-sm sm:text-base text-[var(--ink)] tracking-tight">
                {isEn ? 'AI Compute Cluster & Model Registry' : 'Кластер GPU-мощностей & MCP-серверов'}
              </h3>
              <p className="text-[11px] text-[var(--muted)]">
                {isEn ? 'Hourly rental of H100/4090, vLLM endpoints and verified MCP servers.' : 'Почасовая аренда нод, эндпоинты vLLM и готовые серверы MCP.'}
              </p>
            </div>
          </div>
          <span className="text-[10px] uppercase font-extrabold bg-emerald-600 text-white px-2 py-0.5 rounded-full self-start sm:self-auto font-mono">
            CUDA 12.6 · VRAM
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono">
          <button
            type="button"
            onClick={() => setGpuSelected('H100')}
            className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
              gpuSelected === 'H100' ? 'bg-emerald-600 text-white border-emerald-700 font-bold shadow-xs' : 'bg-[var(--surface)] border-[var(--line)] text-[var(--ink)]'
            }`}
          >
            <div className="text-xs font-bold">8x NVIDIA H100 80GB</div>
            <div className="text-[10px] opacity-80 mt-0.5">$2.85 / hr · SXM5</div>
          </button>

          <button
            type="button"
            onClick={() => setGpuSelected('4090')}
            className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
              gpuSelected === '4090' ? 'bg-emerald-600 text-white border-emerald-700 font-bold shadow-xs' : 'bg-[var(--surface)] border-[var(--line)] text-[var(--ink)]'
            }`}
          >
            <div className="text-xs font-bold">4x RTX 4090 24GB</div>
            <div className="text-[10px] opacity-80 mt-0.5">$0.75 / hr · vLLM Ready</div>
          </button>

          <button
            type="button"
            onClick={() => setGpuSelected('MCP')}
            className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
              gpuSelected === 'MCP' ? 'bg-emerald-600 text-white border-emerald-700 font-bold shadow-xs' : 'bg-[var(--surface)] border-[var(--line)] text-[var(--ink)]'
            }`}
          >
            <div className="text-xs font-bold">MCP Server Custom</div>
            <div className="text-[10px] opacity-80 mt-0.5">Разработка от 24ч</div>
          </button>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="text-[11px] text-[var(--muted)] flex items-center gap-1.5 font-mono">
            <span>🔑</span>
            <span>{isEn ? 'SSH & OpenAI-compatible endpoint generated in Room' : 'SSH-ключи и эндпоинт выдаются в защищённой комнате'}</span>
          </div>

          <button
            type="button"
            onClick={() => {
              setNodeBooked(true);
              setTimeout(() => setNodeBooked(false), 2000);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer shadow-xs active:scale-98 font-mono"
          >
            {nodeBooked ? (isEn ? '✓ Node Reserved in Room' : '✓ Нода забронирована') : (isEn ? '⚡ Reserve via MCP Room' : '⚡ Забронировать через MCP')}
          </button>
        </div>
      </div>
    );
  }

  // 5. B2B PROCUREMENT WIDGET
  if (currentFace === 'procurement') {
    return (
      <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-blue-700/10 border border-blue-700/30 text-[var(--ink)] shadow-xs transition-all animate-in fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 border-b border-blue-700/20 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📦</span>
            <div>
              <h3 className="font-black text-sm sm:text-base text-[var(--ink)] tracking-tight">
                {isEn ? 'B2B Reverse Auction Lot Dispatch' : 'Реверсивный аукцион оптовых закупок'}
              </h3>
              <p className="text-[11px] text-[var(--muted)]">
                {isEn ? 'Suppliers bid downward per lot. Binding technical specifications and payment terms.' : 'Поставщики снижают цену за партию. Фиксация ГОСТ и отсрочки платежа.'}
              </p>
            </div>
          </div>
          <span className="text-[10px] uppercase font-extrabold bg-blue-700 text-white px-2 py-0.5 rounded-full self-start sm:self-auto font-mono">
            REVERSE BIDDING
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-[var(--surface)] p-3 rounded-xl border border-[var(--line)]">
          <div>
            <span className="text-[10px] text-[var(--muted)] uppercase font-bold block">{isEn ? 'Active RFP Lot:' : 'Текущий активный лот:'}</span>
            <span className="font-bold text-sm">Кабель силовой ВВГнг-LS 3x2.5 (ГОСТ 31996) — 5 000 м</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-[var(--muted)] uppercase font-bold block">{isEn ? 'Best Supplier Bid:' : 'Лучшая ставка поставщика:'}</span>
            <span className="font-black text-sm text-emerald-600 dark:text-emerald-400">68.50 ₽ / м (-18%)</span>
          </div>
        </div>
      </div>
    );
  }

  // 6. EQUIPMENT WIDGET
  if (currentFace === 'equipment') {
    return (
      <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-amber-600/10 border border-amber-600/30 text-[var(--ink)] shadow-xs transition-all animate-in fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 border-b border-amber-600/20 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🚜</span>
            <div>
              <h3 className="font-black text-sm sm:text-base text-[var(--ink)] tracking-tight">
                {isEn ? 'Equipment Deposit & Operating Hour Lock' : 'Калькулятор аренды техники & Проверка залога'}
              </h3>
              <p className="text-[11px] text-[var(--muted)]">
                {isEn ? 'Binding operating hours and refundable deposit in the room Term Sheet.' : 'Фиксация допустимой наработки моточасов и обеспечительного залога.'}
              </p>
            </div>
          </div>
          <span className="text-[10px] uppercase font-extrabold bg-amber-600 text-white px-2 py-0.5 rounded-full self-start sm:self-auto font-mono">
            TOOL SHARING
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <div className="bg-[var(--surface)] p-2.5 rounded-xl border border-[var(--line)]">
            <span className="text-[10px] text-[var(--muted)] block font-bold">{isEn ? 'Daily Rate' : 'Суточный тариф'}</span>
            <span className="text-sm font-bold">2 500 ₽ / день</span>
          </div>
          <div className="bg-[var(--surface)] p-2.5 rounded-xl border border-[var(--line)]">
            <span className="text-[10px] text-[var(--muted)] block font-bold">{isEn ? 'Refundable Deposit' : 'Возвратный залог'}</span>
            <span className="text-sm font-bold text-amber-600 dark:text-amber-400">15 000 ₽</span>
          </div>
          <div className="bg-[var(--surface)] p-2.5 rounded-xl border border-[var(--line)]">
            <span className="text-[10px] text-[var(--muted)] block font-bold">{isEn ? 'Allowed Operating Hours' : 'Лимит моточасов'}</span>
            <span className="text-sm font-bold">8 ч / день</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
