import React, { useState, useRef, useEffect } from 'react';
import { FaceId, ALL_FACES, getFaceConfig } from '../lib/faces';
import { useI18n } from '../i18n';

interface FaceSwitcherProps {
  currentFace: FaceId;
  onSelectFace: (face: FaceId) => void;
  variant?: 'header' | 'banner';
}

export const FaceSwitcher: React.FC<FaceSwitcherProps> = ({
  currentFace,
  onSelectFace,
  variant = 'header',
}) => {
  const { locale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeConfig = getFaceConfig(currentFace);
  const isEn = locale === 'en';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const getButtonLabel = () => {
    return isEn
      ? (activeConfig.shortNameEn || activeConfig.nameEn)
      : (activeConfig.shortNameRu || activeConfig.nameRu);
  };

  return (
    <div className="relative inline-block text-left shrink-0" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={isEn ? 'Switch Theme' : 'Сменить витрину'}
        title={isEn ? `Current Theme: ${activeConfig.nameEn}. Click to switch.` : `Текущая витрина: ${activeConfig.nameRu}. Нажмите для смены.`}
        className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 h-8 rounded-lg border text-xs font-bold transition-all cursor-pointer shadow-2xs select-none active:scale-98 shrink-0 min-w-0 ${
          currentFace === 'general'
            ? 'bg-[var(--surface)] hover:bg-[var(--raised)] border-[var(--line)] text-[var(--ink)]'
            : `bg-[var(--surface)] hover:bg-[var(--raised)] ${activeConfig.borderAccent} text-[var(--ink)] ring-1 ring-offset-0 ring-[var(--line)]`
        }`}
      >
        <span className="text-sm sm:text-base leading-none shrink-0">{currentFace === 'general' ? '🎭' : activeConfig.emoji}</span>
        <span className="min-w-0 max-w-[95px] sm:max-w-[125px] xl:max-w-[145px] truncate font-bold">
          {getButtonLabel()}
        </span>
        <span className="text-[10px] text-[var(--muted)] ml-0.5 shrink-0">▾</span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 mt-2 w-72 sm:w-80 max-w-[calc(100vw-24px)] rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xl z-50 py-1.5 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 max-h-[70vh] overflow-y-auto"
        >
          <div className="px-3 py-2 border-b border-[var(--line)] flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
              {isEn ? '🎭 Marketplace Themes (Faces)' : '🎭 Тематические витрины'}
            </span>
            <span className="text-[10px] bg-[var(--raised)] px-1.5 py-0.5 rounded text-[var(--muted)]">
              {ALL_FACES.length} {isEn ? 'faces' : 'тем'}
            </span>
          </div>

          <div className="py-1">
            {ALL_FACES.map((face) => {
              const isSelected = face.id === currentFace;
              return (
                <button
                  key={face.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onSelectFace(face.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition-colors cursor-pointer ${
                    isSelected
                      ? `${face.bgTint} bg-opacity-40 font-bold border-l-2`
                      : 'hover:bg-[var(--raised)] border-l-2 border-transparent'
                  }`}
                  style={{
                    borderLeftColor: isSelected ? face.accentColor : 'transparent',
                  }}
                >
                  <span className="text-xl sm:text-2xl mt-0.5 shrink-0 leading-none">{face.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs sm:text-sm font-bold text-[var(--ink)] truncate">
                        {isEn ? face.nameEn : face.nameRu}
                      </span>
                      {isSelected && (
                        <span className="text-[11px] text-emerald-500 font-bold shrink-0">✓</span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--muted)] line-clamp-1 mt-0.5">
                      {isEn ? face.taglineEn : face.taglineRu}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-[var(--raised)] text-[var(--muted)]">
                        {face.specialFeature[isEn ? 'labelEn' : 'labelRu']}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
