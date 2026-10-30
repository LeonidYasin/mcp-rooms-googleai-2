import React, { useState } from 'react';
import {
  Listing,
  ListingCategory,
  ListingKind,
  FulfilmentMode,
  CATEGORY_LABELS,
  MODE_LABELS,
  ListingPhoto,
} from '../types';
import { formatPrice } from './ListingCard';
import { useI18n, TranslationKey } from '../i18n';

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPublish: (listing: Listing) => void;
}

export const PublishModal: React.FC<PublishModalProps> = ({
  isOpen,
  onClose,
  onPublish,
}) => {
  const { t, locale } = useI18n();
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [kind, setKind] = useState<ListingKind>('offer');
  const [category, setCategory] = useState<ListingCategory>('things');
  const [subcategory, setSubcategory] = useState('');
  const [title, setTitle] = useState('');
  const [isPriceNegotiable, setIsPriceNegotiable] = useState(false);
  const [priceRubles, setPriceRubles] = useState<string>('25000');
  const [modes, setModes] = useState<FulfilmentMode[]>(['pickup', 'shipping']);
  const [locality, setLocality] = useState('Казань');
  const [region, setRegion] = useState('Татарстан');
  const [country, setCountry] = useState('Россия');
  const [condition, setCondition] = useState('Отличное состояние');
  const [description, setDescription] = useState('');
  const [authorName, setAuthorName] = useState('Пользователь площадки');
  const [photos, setPhotos] = useState<ListingPhoto[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleModeToggle = (mode: FulfilmentMode) => {
    if (modes.includes(mode)) {
      if (modes.length > 1) {
        setModes(modes.filter((m) => m !== mode));
      }
    } else {
      setModes([...modes, mode]);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const availableSlots = 8 - photos.length;
    const filesToProcess = Array.from(files).slice(0, availableSlots);

    filesToProcess.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setPhotos((prev) => [
            ...prev,
            {
              id: 'photo-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
              name: file.name,
              dataUrl: reader.result as string,
            },
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemovePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const validateAndSubmit = () => {
    setErrorMsg(null);
    if (!title.trim()) {
      setErrorMsg('Пожалуйста, введите название объявления');
      return;
    }
    if (title.length > 120) {
      setErrorMsg('Длина названия не должна превышать 120 символов');
      return;
    }
    if (!description.trim()) {
      setErrorMsg('Пожалуйста, добавьте описание');
      return;
    }
    if (modes.includes('pickup') && !locality.trim()) {
      setErrorMsg('Для способа «Самовывоз» необходимо указать город/локацию');
      return;
    }

    const priceMinor = isPriceNegotiable ? null : Math.max(0, Math.floor(Number(priceRubles) * 100));

    const newListing: Listing = {
      id: 'listing-' + Date.now(),
      owner: 'user:local-agent-' + Math.random().toString(36).substring(2, 6),
      author_name: authorName.trim() || 'Пользователь площадки',
      content: {
        title: title.trim(),
        description: description.trim(),
        category,
        subcategory: subcategory.trim() || undefined,
        kind,
        modes,
        locality: locality.trim(),
        region: region.trim() || undefined,
        country: country.trim() || undefined,
        price_minor: priceMinor,
        currency: 'RUB',
        media_ids: photos.map((p) => p.id),
        condition: condition.trim() || undefined,
      },
      status: 'active',
      visibility: 'public',
      revision: 1,
      created_at: Date.now(),
      updated_at: Date.now(),
      expires_at: Date.now() + 3600000 * 24 * 90,
      photos,
      responses_count: 0,
    };

    onPublish(newListing);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-[var(--canvas)] border border-[var(--line)] rounded-2xl max-w-2xl w-full my-auto shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[var(--line)] flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[var(--ink)]">
              Подать объявление (MCP Rooms)
            </h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Сначала черновик и предпросмотр — публикация выполняется осознанно.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--ink)] text-xl p-1 rounded-md"
          >
            ✕
          </button>
        </div>

        {/* Tab switch */}
        <div className="px-6 pt-3 border-b border-[var(--line)] flex gap-4 text-sm font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('edit')}
            className={`pb-2.5 cursor-pointer border-b-2 transition-colors ${
              activeTab === 'edit'
                ? 'border-[var(--blue)] text-[var(--blue)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            1. Заполнение черновика
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`pb-2.5 cursor-pointer border-b-2 transition-colors ${
              activeTab === 'preview'
                ? 'border-[var(--blue)] text-[var(--blue)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            2. Предпросмотр карточки
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {errorMsg && (
            <div className="p-3 bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-200 rounded-lg text-xs font-semibold">
              ⚠️ {errorMsg}
            </div>
          )}

          {activeTab === 'edit' ? (
            <>
              {/* Kind selector */}
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">
                  Тип объявления
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setKind('offer')}
                    className={`py-2.5 px-4 rounded-lg font-semibold text-center border transition-all ${
                      kind === 'offer'
                        ? 'border-[var(--blue)] bg-[var(--soft)] text-[var(--blue)] shadow-xs'
                        : 'border-[var(--line)] text-[var(--ink)] hover:bg-[var(--surface)]'
                    }`}
                  >
                    📦 Предлагаю (продажа / услуга)
                  </button>
                  <button
                    type="button"
                    onClick={() => setKind('request')}
                    className={`py-2.5 px-4 rounded-lg font-semibold text-center border transition-all ${
                      kind === 'request'
                        ? 'border-[var(--blue)] bg-[var(--soft)] text-[var(--blue)] shadow-xs'
                        : 'border-[var(--line)] text-[var(--ink)] hover:bg-[var(--surface)]'
                    }`}
                  >
                    🔍 {locale === 'en' ? 'Seeking (request / buying)' : 'Ищу (запрос / покупка)'}
                  </button>
                </div>
              </div>

              {/* Category & Subcategory */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">
                    Категория
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ListingCategory)}
                    className="w-full h-10 px-3 border border-[var(--line)] rounded-lg bg-[var(--surface)] text-[var(--ink)] text-sm outline-none"
                  >
                    <option value="business">Бизнес и стартапы</option>
                    <option value="jobs">Работа и вакансии</option>
                    <option value="services">Услуги и мастера</option>
                    <option value="real_estate">Недвижимость и аренда</option>
                    <option value="communities">Сообщества и команды (Парламент)</option>
                    <option value="things">Вещи и товары</option>
                    <option value="dating">Знакомства и хобби</option>
                    <option value="rides">Поездки</option>
                    <option value="delivery">Доставка</option>
                    <option value="other">Другое</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">
                    Подкатегория / Направление
                  </label>
                  <input
                    type="text"
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                    placeholder="Например: Велосипеды, Электроника"
                    className="w-full h-10 px-3 border border-[var(--line)] rounded-lg bg-[var(--surface)] text-[var(--ink)] text-sm outline-none"
                  />
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">
                  Название объявления (макс. 120 символов)
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Например: Шоссейный велосипед Merida Scultura"
                  className="w-full h-10 px-3 border border-[var(--line)] rounded-lg bg-[var(--surface)] text-[var(--ink)] text-sm outline-none"
                />
                <div className="text-right text-xs text-[var(--muted)] mt-1">
                  {title.length}/120
                </div>
              </div>

              {/* Price */}
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">
                  Цена
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    disabled={isPriceNegotiable}
                    value={priceRubles}
                    onChange={(e) => setPriceRubles(e.target.value)}
                    placeholder="25000"
                    className="flex-1 h-10 px-3 border border-[var(--line)] rounded-lg bg-[var(--surface)] text-[var(--ink)] text-sm outline-none disabled:opacity-50"
                  />
                  <span className="font-semibold text-[var(--ink)]">₽</span>
                  <label className="flex items-center gap-2 text-xs text-[var(--ink)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPriceNegotiable}
                      onChange={(e) => setIsPriceNegotiable(e.target.checked)}
                      className="rounded"
                    />
                    <span>По договорённости</span>
                  </label>
                </div>
              </div>

              {/* Modes */}
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">
                  Способы передачи (выберите хотя бы один)
                </label>
                <div className="flex flex-wrap gap-4">
                  {(['pickup', 'shipping', 'online'] as FulfilmentMode[]).map((m) => (
                    <label key={m} className="flex items-center gap-2 cursor-pointer text-sm text-[var(--ink)]">
                      <input
                        type="checkbox"
                        checked={modes.includes(m)}
                        onChange={() => handleModeToggle(m)}
                      />
                      <span>{MODE_LABELS[m]}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Locality & Condition */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">
                    Город / Населённый пункт {modes.includes('pickup') && '*'}
                  </label>
                  <input
                    type="text"
                    value={locality}
                    onChange={(e) => setLocality(e.target.value)}
                    placeholder="Казань"
                    className="w-full h-10 px-3 border border-[var(--line)] rounded-lg bg-[var(--surface)] text-[var(--ink)] text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">
                    Состояние
                  </label>
                  <input
                    type="text"
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    placeholder="Новое / Отличное / Б/У"
                    className="w-full h-10 px-3 border border-[var(--line)] rounded-lg bg-[var(--surface)] text-[var(--ink)] text-sm outline-none"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">
                  Описание и честные условия
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Опишите вещь или услугу, характеристики, причину продажи и дефекты при их наличии..."
                  className="w-full p-3 border border-[var(--line)] rounded-lg bg-[var(--surface)] text-[var(--ink)] text-sm outline-none"
                />
              </div>

              {/* Photos upload (up to 8 photos) */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                    Фотографии (до 8 штук)
                  </label>
                  <span className="text-xs text-[var(--muted)]">{photos.length} из 8</span>
                </div>

                <div className="flex flex-wrap gap-3">
                  {photos.map((p, idx) => (
                    <div key={p.id} className="relative w-20 h-20 rounded-lg overflow-hidden border border-[var(--line)] group">
                      <img src={p.dataUrl} alt={`Фото ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(p.id)}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-80 hover:opacity-100"
                        title="Удалить фото"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  {photos.length < 8 && (
                    <label className="w-20 h-20 rounded-lg border-2 border-dashed border-[var(--line)] hover:border-[var(--blue)] flex flex-col items-center justify-center text-xs text-[var(--muted)] cursor-pointer hover:bg-[var(--surface)] transition-colors">
                      <span className="text-lg">+</span>
                      <span>Фото</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
                <p className="text-xs text-[var(--muted)] mt-2">
                  Только настоящие фотографии вашего предмета. Никаких картинок из интернета или стоковых подмен.
                </p>
              </div>

              {/* Author name */}
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">
                  Имя автора объявления
                </label>
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="Александр"
                  className="w-full h-10 px-3 border border-[var(--line)] rounded-lg bg-[var(--surface)] text-[var(--ink)] text-sm outline-none"
                />
              </div>
            </>
          ) : (
            /* PREVIEW TAB */
            <div className="border border-[var(--line)] rounded-xl p-5 bg-[var(--surface)] space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[var(--green)] bg-[var(--greenbg)] px-2.5 py-0.5 rounded-full">
                  {kind === 'offer' ? t('kind.offer') : t('kind.request')} · {t(`cat.${category}` as TranslationKey)}
                </span>
                {subcategory && (
                  <span className="text-xs text-[var(--muted)]">→ {subcategory}</span>
                )}
              </div>

              <h3 className="text-2xl font-bold text-[var(--ink)]">
                {title || 'Название ещё не введено'}
              </h3>

              <div className="text-2xl font-extrabold text-[var(--ink)]">
                {isPriceNegotiable
                  ? 'Цена по договорённости'
                  : formatPrice(Math.floor(Number(priceRubles || 0) * 100), 'RUB')}
              </div>

              <div className="text-xs text-[var(--muted)]">
                Локация: {locality || 'Не указана'} · {modes.map((m) => MODE_LABELS[m]).join(', ')}
              </div>

              {photos.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {photos.map((p, idx) => (
                    <img
                      key={p.id}
                      src={p.dataUrl}
                      alt={`Предпросмотр ${idx}`}
                      className="w-full h-24 object-cover rounded-md border border-[var(--line)]"
                    />
                  ))}
                </div>
              ) : (
                <div className="p-4 border border-[var(--line)] rounded-lg bg-[var(--canvas)] text-center text-xs text-[var(--muted)]">
                  Фотографии не добавлены. Будет отображена фирменная заглушка честного черновика.
                </div>
              )}

              <div className="p-3 bg-[var(--canvas)] rounded-lg border border-[var(--line)] text-sm whitespace-pre-wrap">
                {description || 'Описание не заполнено.'}
              </div>

              <div className="text-xs text-[var(--muted)]">
                Автор: <strong>{authorName || 'Пользователь площадки'}</strong>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-[var(--line)] bg-[var(--surface)] flex flex-wrap justify-between items-center gap-3">
          <div className="text-xs text-[var(--muted)]">
            Черновик проверяется валидатором listing_contract
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-[var(--line)] rounded-lg hover:bg-[var(--canvas)] text-[var(--ink)] cursor-pointer"
            >
              Отмена
            </button>
            {activeTab === 'edit' ? (
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className="px-4 py-2 text-sm bg-[var(--surface)] border border-[var(--line)] hover:bg-[var(--raised)] text-[var(--ink)] font-semibold rounded-lg cursor-pointer"
              >
                Предпросмотр →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab('edit')}
                className="px-4 py-2 text-sm border border-[var(--line)] rounded-lg text-[var(--ink)] cursor-pointer"
              >
                ← Вернуться к правкам
              </button>
            )}
            <button
              type="button"
              onClick={validateAndSubmit}
              className="px-5 py-2 text-sm bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Опубликовать
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
