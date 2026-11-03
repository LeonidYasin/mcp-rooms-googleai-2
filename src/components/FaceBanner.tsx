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
      <div className="mb-6 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent border border-[var(--line)] rounded-2xl p-4 sm:p-5 transition-all">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xl">🌐</span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--blue)]">
                {isEn ? face.badgeEn : face.badgeRu}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-[var(--ink)] tracking-tight">
              {isEn ? face.taglineEn : face.taglineRu}
            </h2>
            <p className="text-xs sm:text-sm text-[var(--muted)] mt-1">
              {isEn ? face.descriptionEn : face.descriptionRu}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenPublish}
              className="bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-xs active:scale-98"
            >
              ＋ {isEn ? 'Publish Listing' : 'Подать объявление'}
            </button>
          </div>
        </div>

        {/* Quick Chips Row */}
        <div className="mt-4 pt-3 border-t border-[var(--line)] flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider shrink-0">
            {isEn ? 'Quick Filters:' : 'Быстрый поиск:'}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {face.quickChips.map((chip, idx) => {
              const isActive = activeChipQuery.toLowerCase() === chip.query.toLowerCase();
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onApplyChip(chip)}
                  className={`px-2.5 py-1 rounded-lg font-medium text-xs transition-all cursor-pointer select-none ${
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

  // Thematic Specialized Banner
  return (
    <div
      className={`mb-6 rounded-2xl border p-4 sm:p-5 transition-all shadow-xs ${face.borderAccent} ${face.bgTint} relative overflow-hidden`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-2xl leading-none">{face.emoji}</span>
            <span
              className="text-[11px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md text-white"
              style={{ backgroundColor: face.accentColor }}
            >
              {isEn ? face.badgeEn : face.badgeRu}
            </span>
            <span className="text-[11px] font-semibold text-[var(--muted)] bg-[var(--surface)] border border-[var(--line)] px-2 py-0.5 rounded-md">
              ✨ {face.specialFeature[isEn ? 'labelEn' : 'labelRu']}
            </span>
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-[var(--ink)] tracking-tight">
            {isEn ? face.taglineEn : face.taglineRu}
          </h2>
          <p className="text-xs sm:text-sm text-[var(--muted)] mt-1">
            {isEn ? face.descriptionEn : face.descriptionRu}
          </p>

          <div className="mt-2 text-[11px] text-[var(--ink)] opacity-85 flex items-center gap-1.5 font-medium">
            <span>ℹ️</span>
            <span>{face.specialFeature[isEn ? 'infoEn' : 'infoRu']}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenPublish}
            style={{ backgroundColor: face.accentColor }}
            className="text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-xs active:scale-98 hover:opacity-95"
          >
            ＋ {isEn ? `Publish in ${face.nameEn}` : `Подать в ${face.nameRu}`}
          </button>
          <button
            type="button"
            onClick={() => onSelectFace('general')}
            title={isEn ? 'Switch back to all categories' : 'Вернуться ко всем категориям'}
            className="bg-[var(--surface)] hover:bg-[var(--raised)] border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] text-xs font-semibold px-3 py-2.5 rounded-xl transition-all cursor-pointer"
          >
            ✕ {isEn ? 'All' : 'Все темы'}
          </button>
        </div>
      </div>

      {/* Quick Chips Row */}
      <div className="mt-4 pt-3 border-t border-[var(--line)] flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider shrink-0">
          {isEn ? 'Popular Tags:' : 'Популярные теги:'}
        </span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {face.quickChips.map((chip, idx) => {
            const isActive = activeChipQuery.toLowerCase() === chip.query.toLowerCase();
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onApplyChip(chip)}
                className={`px-2.5 py-1 rounded-lg font-medium text-xs transition-all cursor-pointer select-none ${
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
