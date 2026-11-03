import React from 'react';
import { FaceId, getFaceConfig, QuickChip } from '../lib/faces';
import { useI18n } from '../i18n';

interface FaceBannerProps {
  currentFace: FaceId;
  onSelectFace: (face: FaceId) => void;
  onApplyChip: (chip: QuickChip) => void;
  activeChipQuery: string;
  onOpenPublish: () => void;
}

export const FaceBanner: React.FC<FaceBannerProps> = ({
  currentFace,
  onSelectFace,
  onApplyChip,
  activeChipQuery,
  onOpenPublish,
}) => {
  const { locale } = useI18n();
  const isEn = locale === 'en';
  const face = getFaceConfig(currentFace);

  if (currentFace === 'general') {
    return (
      <div className="mb-4 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent border border-[var(--line)] rounded-2xl p-3.5 sm:p-4 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">🌐</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--blue)]">
                {isEn ? face.badgeEn : face.badgeRu}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-[var(--ink)] tracking-tight">
              {isEn ? face.taglineEn : face.taglineRu}
            </h2>
            <p className="text-xs text-[var(--muted)] mt-0.5 line-clamp-2">
              {isEn ? face.descriptionEn : face.descriptionRu}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenPublish}
              className="bg-[var(--surface)] hover:bg-[var(--raised)] border border-[var(--line)] hover:border-[var(--blue)] text-[var(--ink)] text-xs font-semibold px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-98"
            >
              ＋ {isEn ? 'Create Listing' : 'Создать объявление'}
            </button>
          </div>
        </div>

        {/* Quick Chips Row */}
        <div className="mt-2.5 pt-2 border-t border-[var(--line)] flex items-center gap-2 overflow-x-auto no-scrollbar text-xs">
          <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider shrink-0">
            {isEn ? 'Quick Filters:' : 'Быстрый поиск:'}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {face.quickChips.map((chip, idx) => {
              const isActive = activeChipQuery.toLowerCase() === chip.query.toLowerCase();
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onApplyChip(chip)}
                  className={`px-2.5 py-0.5 rounded-lg font-medium text-xs transition-all cursor-pointer select-none whitespace-nowrap ${
                    isActive
                      ? 'bg-[var(--blue)] text-white font-bold shadow-xs'
                      : 'bg-[var(--surface)] hover:bg-[var(--raised)] border border-[var(--line)] text-[var(--ink)]'
                  }`}
                >
                  {isEn ? chip.labelEn : chip.labelRu}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Thematic Specialized Banner (Compact & Sleek)
  return (
    <div
      className={`mb-4 rounded-2xl border p-3.5 sm:p-4 transition-all shadow-xs ${face.borderAccent} ${face.bgTint} relative overflow-hidden`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xl leading-none">{face.emoji}</span>
            <span
              className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md text-white"
              style={{ backgroundColor: face.accentColor }}
            >
              {isEn ? face.badgeEn : face.badgeRu}
            </span>
            <span className="text-[10px] font-semibold text-[var(--muted)] bg-[var(--surface)] border border-[var(--line)] px-2 py-0.5 rounded-md">
              ✨ {face.specialFeature[isEn ? 'labelEn' : 'labelRu']}
            </span>
          </div>

          <h2 className="text-base sm:text-lg font-bold text-[var(--ink)] tracking-tight">
            {isEn ? face.taglineEn : face.taglineRu}
          </h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            {isEn ? face.descriptionEn : face.descriptionRu}
          </p>

          <div className="mt-1 text-[11px] text-[var(--ink)] opacity-85 flex items-center gap-1.5 font-medium">
            <span>ℹ️</span>
            <span>{face.specialFeature[isEn ? 'infoEn' : 'infoRu']}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenPublish}
            style={{ backgroundColor: face.accentColor }}
            className="text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-xs active:scale-98 hover:opacity-95"
          >
            ＋ {isEn ? `Publish in ${face.nameEn}` : `Подать в ${face.nameRu}`}
          </button>
          <button
            type="button"
            onClick={() => onSelectFace('general')}
            title={isEn ? 'Switch back to all categories' : 'Вернуться ко всем категориям'}
            className="bg-[var(--surface)] hover:bg-[var(--raised)] border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] text-xs font-semibold px-2.5 py-2 rounded-xl transition-all cursor-pointer"
          >
            ✕ {isEn ? 'All' : 'Все темы'}
          </button>
        </div>
      </div>

      {/* Quick Chips Row */}
      <div className="mt-2.5 pt-2 border-t border-[var(--line)] flex items-center gap-2 overflow-x-auto no-scrollbar text-xs">
        <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider shrink-0">
          {isEn ? 'Popular Tags:' : 'Популярные теги:'}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {face.quickChips.map((chip, idx) => {
            const isActive = activeChipQuery.toLowerCase() === chip.query.toLowerCase();
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onApplyChip(chip)}
                className={`px-2.5 py-0.5 rounded-lg font-medium text-xs transition-all cursor-pointer select-none whitespace-nowrap ${
                  isActive
                    ? 'text-white font-bold shadow-xs'
                    : 'bg-[var(--surface)] hover:bg-[var(--raised)] border border-[var(--line)] text-[var(--ink)]'
                }`}
                style={{
                  backgroundColor: isActive ? face.accentColor : undefined,
                  borderColor: isActive ? face.accentColor : undefined,
                }}
              >
                {isEn ? chip.labelEn : chip.labelRu}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
