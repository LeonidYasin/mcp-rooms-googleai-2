import React, { useState } from 'react';
import {
  Listing,
  ListingCategory,
  ListingKind,
  FulfilmentMode,
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
  const [locality, setLocality] = useState(locale === 'en' ? 'Kazan' : 'Казань');
  const [region, setRegion] = useState(locale === 'en' ? 'Tatarstan' : 'Татарстан');
  const [country, setCountry] = useState(locale === 'en' ? 'Russia' : 'Россия');
  const [condition, setCondition] = useState(locale === 'en' ? 'Excellent condition' : 'Отличное состояние');
  const [description, setDescription] = useState('');
  const [authorName, setAuthorName] = useState(locale === 'en' ? 'Platform User' : 'Пользователь площадки');
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
      setErrorMsg(locale === 'en' ? 'Please enter a title for the listing' : 'Пожалуйста, введите название объявления');
      return;
    }
    if (title.length > 120) {
      setErrorMsg(locale === 'en' ? 'Title length must not exceed 120 characters' : 'Длина названия не должна превышать 120 символов');
      return;
    }
    if (!description.trim()) {
      setErrorMsg(locale === 'en' ? 'Please add a description' : 'Пожалуйста, добавьте описание');
      return;
    }
    if (modes.includes('pickup') && !locality.trim()) {
      setErrorMsg(locale === 'en' ? 'For pickup fulfilment mode, location is required' : 'Для способа «Самовывоз» необходимо указать город/локацию');
      return;
    }

    const priceMinor = isPriceNegotiable ? null : Math.max(0, Math.floor(Number(priceRubles) * 100));

    const newListing: Listing = {
      id: 'listing-' + Date.now(),
      owner: 'user:local-agent-' + Math.random().toString(36).substring(2, 6),
      author_name: authorName.trim() || (locale === 'en' ? 'Platform User' : 'Пользователь площадки'),
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

  const allCategories: ListingCategory[] = [
    'business',
    'jobs',
    'services',
    'real_estate',
    'communities',
    'things',
    'dating',
    'rides',
    'delivery',
    'other',
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-[var(--canvas)] border border-[var(--line)] rounded-2xl max-w-2xl w-full my-auto shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[var(--line)] flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[var(--ink)]">
              {t('publish.title')}
            </h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              {t('publish.subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--ink)] text-xl p-1 rounded-md cursor-pointer"
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
            {t('publish.tab_edit')}
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
            {t('publish.tab_preview')}
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
                  {t('publish.kind_label')}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setKind('offer')}
                    className={`py-2.5 px-4 rounded-lg font-semibold text-center border transition-all cursor-pointer ${
                      kind === 'offer'
                        ? 'border-[var(--blue)] bg-[var(--soft)] text-[var(--blue)] shadow-xs'
                        : 'border-[var(--line)] text-[var(--ink)] hover:bg-[var(--surface)]'
                    }`}
                  >
                    📦 {locale === 'en' ? 'Offer (item / service)' : 'Предлагаю (продажа / услуга)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setKind('request')}
                    className={`py-2.5 px-4 rounded-lg font-semibold text-center border transition-all cursor-pointer ${
                      kind === 'request'
                        ? 'border-[var(--blue)] bg-[var(--soft)] text-[var(--blue)] shadow-xs'
                        : 'border-[var(--line)] text-[var(--ink)] hover:bg-[var(--surface)]'
                    }`}
                  >
                    🔍 {locale === 'en' ? 'Seeking (request / buy)' : 'Ищу (запрос / покупка)'}
                  </button>
                </div>
              </div>

              {/* Category & Subcategory */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">
                    {t('publish.category_label')}
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ListingCategory)}
                    className="w-full h-10 px-3 border border-[var(--line)] rounded-lg bg-[var(--surface)] text-[var(--ink)] text-sm outline-none cursor-pointer"
                  >
                    {allCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {t(`cat.${cat}` as TranslationKey)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">
                    {locale === 'en' ? 'Subcategory / Direction' : 'Подкатегория / Направление'}
                  </label>
                  <input
                    type="text"
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                    placeholder={locale === 'en' ? 'E.g.: Bicycles, Electronics' : 'Например: Велосипеды, Электроника'}
                    className="w-full h-10 px-3 border border-[var(--line)] rounded-lg bg-[var(--surface)] text-[var(--ink)] text-sm outline-none"
                  />
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">
                  {locale === 'en' ? 'Title (max 120 characters)' : 'Название объявления (макс. 120 символов)'}
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={locale === 'en' ? 'E.g.: City commuter bicycle, Size M' : 'Например: Шоссейный велосипед Merida Scultura'}
                  className="w-full h-10 px-3 border border-[var(--line)] rounded-lg bg-[var(--surface)] text-[var(--ink)] text-sm outline-none"
                />
                <div className="text-right text-xs text-[var(--muted)] mt-1">
                  {title.length}/120
                </div>
              </div>

              {/* Price */}
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">
                  {t('publish.price_label')}
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
                    <span>{locale === 'en' ? 'Negotiable' : 'По договорённости'}</span>
                  </label>
                </div>
              </div>

              {/* Modes */}
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">
                  {locale === 'en' ? 'Fulfilment methods (select at least one)' : 'Способы передачи (выберите хотя бы один)'}
                </label>
                <div className="flex flex-wrap gap-4">
                  {(['pickup', 'shipping', 'online'] as FulfilmentMode[]).map((m) => (
                    <label key={m} className="flex items-center gap-2 cursor-pointer text-sm text-[var(--ink)]">
                      <input
                        type="checkbox"
                        checked={modes.includes(m)}
                        onChange={() => handleModeToggle(m)}
                      />
                      <span>{t(`mode.${m}` as TranslationKey)}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Locality & Condition */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">
                    {locale === 'en' ? 'City / Locality' : 'Город / Населённый пункт'} {modes.includes('pickup') && '*'}
                  </label>
                  <input
                    type="text"
                    value={locality}
                    onChange={(e) => setLocality(e.target.value)}
                    placeholder={locale === 'en' ? 'Kazan' : 'Казань'}
                    className="w-full h-10 px-3 border border-[var(--line)] rounded-lg bg-[var(--surface)] text-[var(--ink)] text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">
                    {locale === 'en' ? 'Condition' : 'Состояние'}
                  </label>
                  <input
                    type="text"
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    placeholder={locale === 'en' ? 'New / Excellent / Used' : 'Новое / Отличное / Б/У'}
                    className="w-full h-10 px-3 border border-[var(--line)] rounded-lg bg-[var(--surface)] text-[var(--ink)] text-sm outline-none"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">
                  {locale === 'en' ? 'Description & honest conditions' : 'Описание и честные условия'}
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    locale === 'en'
                      ? 'Describe the item or service, specifications, reason for selling and any known defects...'
                      : 'Опишите вещь или услугу, характеристики, причину продажи и дефекты при их наличии...'
                  }
                  className="w-full p-3 border border-[var(--line)] rounded-lg bg-[var(--surface)] text-[var(--ink)] text-sm outline-none"
                />
              </div>

              {/* Photos upload (up to 8 photos) */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                    {locale === 'en' ? 'Photos (up to 8)' : 'Фотографии (до 8 штук)'}
                  </label>
                  <span className="text-xs text-[var(--muted)]">
                    {photos.length} {locale === 'en' ? 'of 8' : 'из 8'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-3">
                  {photos.map((p, idx) => (
                    <div key={p.id} className="relative w-20 h-20 rounded-lg overflow-hidden border border-[var(--line)] group">
                      <img src={p.dataUrl} alt={locale === 'en' ? `Photo ${idx + 1}` : `Фото ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(p.id)}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-80 hover:opacity-100 cursor-pointer"
                        title={locale === 'en' ? 'Delete photo' : 'Удалить фото'}
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  {photos.length < 8 && (
                    <label className="w-20 h-20 rounded-lg border-2 border-dashed border-[var(--line)] hover:border-[var(--blue)] flex flex-col items-center justify-center text-xs text-[var(--muted)] cursor-pointer hover:bg-[var(--surface)] transition-colors">
                      <span className="text-lg">+</span>
                      <span>{locale === 'en' ? 'Photo' : 'Фото'}</span>
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
                  {locale === 'en'
                    ? 'Only genuine photos of your real item. No stock internet images or AI generated pictures.'
                    : 'Только настоящие фотографии вашего предмета. Никаких картинок из интернета или стоковых подмен.'}
                </p>
              </div>

              {/* Author name */}
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">
                  {locale === 'en' ? 'Author Name' : 'Имя автора объявления'}
                </label>
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder={locale === 'en' ? 'Alex' : 'Александр'}
                  className="w-full h-10 px-3 border border-[var(--line)] rounded-lg bg-[var(--surface)] text-[var(--ink)] text-sm outline-none"
                />
              </div>
            </>
          ) : (
            /* PREVIEW TAB */
            <div className="border border-[var(--line)] rounded-xl p-5 bg-[var(--surface)] space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-2.5 py-0.5 rounded-full">
                  {kind === 'offer' ? t('kind.offer') : t('kind.request')} · {t(`cat.${category}` as TranslationKey)}
                </span>
                {subcategory && (
                  <span className="text-xs text-[var(--muted)]">→ {subcategory}</span>
                )}
              </div>

              <h3 className="text-2xl font-bold text-[var(--ink)]">
                {title || (locale === 'en' ? 'Title not entered yet' : 'Название ещё не введено')}
              </h3>

              <div className="text-2xl font-extrabold text-[var(--ink)]">
                {isPriceNegotiable
                  ? (locale === 'en' ? 'Price negotiable' : 'Цена по договорённости')
                  : formatPrice(Math.floor(Number(priceRubles || 0) * 100), 'RUB')}
              </div>

              <div className="text-xs text-[var(--muted)]">
                {locale === 'en' ? 'Location:' : 'Локация:'} {locality || (locale === 'en' ? 'Not specified' : 'Не указана')} · {modes.map((m) => t(`mode.${m}` as TranslationKey)).join(', ')}
              </div>

              {photos.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {photos.map((p, idx) => (
                    <img
                      key={p.id}
                      src={p.dataUrl}
                      alt={locale === 'en' ? `Preview ${idx}` : `Предпросмотр ${idx}`}
                      className="w-full h-24 object-cover rounded-md border border-[var(--line)]"
                    />
                  ))}
                </div>
              ) : (
                <div className="p-4 border border-[var(--line)] rounded-lg bg-[var(--canvas)] text-center text-xs text-[var(--muted)]">
                  {locale === 'en'
                    ? 'No photos added. Authentic prototype placeholder will be displayed.'
                    : 'Фотографии не добавлены. Будет отображена фирменная заглушка честного черновика.'}
                </div>
              )}

              <div className="p-3 bg-[var(--canvas)] rounded-lg border border-[var(--line)] text-sm whitespace-pre-wrap">
                {description || (locale === 'en' ? 'Description not provided.' : 'Описание не заполнено.')}
              </div>

              <div className="text-xs text-[var(--muted)]">
                {locale === 'en' ? 'Author:' : 'Автор:'} <strong>{authorName || (locale === 'en' ? 'Platform User' : 'Пользователь площадки')}</strong>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-[var(--line)] bg-[var(--surface)] flex flex-wrap justify-between items-center gap-3">
          <div className="text-xs text-[var(--muted)]">
            {locale === 'en' ? 'Draft validated by listing_contract rules' : 'Черновик проверяется валидатором listing_contract'}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-[var(--line)] rounded-lg hover:bg-[var(--canvas)] text-[var(--ink)] cursor-pointer"
            >
              {t('modal.cancel')}
            </button>
            {activeTab === 'edit' ? (
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className="px-4 py-2 text-sm bg-[var(--surface)] border border-[var(--line)] hover:bg-[var(--raised)] text-[var(--ink)] font-semibold rounded-lg cursor-pointer"
              >
                {locale === 'en' ? 'Preview →' : 'Предпросмотр →'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab('edit')}
                className="px-4 py-2 text-sm border border-[var(--line)] rounded-lg text-[var(--ink)] cursor-pointer"
              >
                {locale === 'en' ? '← Back to Edit' : '← Вернуться к правкам'}
              </button>
            )}
            <button
              type="button"
              onClick={validateAndSubmit}
              className="px-5 py-2 text-sm bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white font-semibold rounded-lg transition-colors cursor-pointer"
            >
              {locale === 'en' ? 'Publish' : 'Опубликовать'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
