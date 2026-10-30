import React, { useState } from 'react';
import { Listing, McpRoom, CATEGORY_LABELS } from '../types';
import { formatPrice } from './ListingCard';
import { useI18n, TranslationKey } from '../i18n';

interface ListingDetailProps {
  listing: Listing;
  rooms?: McpRoom[];
  onBack: () => void;
  onContactSeller: (listing: Listing) => void;
  onAgentDiscuss: (listing: Listing) => void;
  onOpenRoom?: (roomId: string) => void;
  onAddPhoto?: (listingId: string, photoDataUrl: string) => void;
}

export const ListingDetail: React.FC<ListingDetailProps> = ({
  listing,
  rooms = [],
  onBack,
  onContactSeller,
  onAgentDiscuss,
  onOpenRoom,
  onAddPhoto,
}) => {
  const { t, locale } = useI18n();
  const { content, photos, author_name, revision } = listing;
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [showPhotoUploadModal, setShowPhotoUploadModal] = useState(false);

  const modesText = content.modes
    .map((m) => t(`mode.${m}` as TranslationKey))
    .join(' / ');
  const locationText = [content.locality, content.region, content.country]
    .filter(Boolean)
    .join(' · ');

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onAddPhoto) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onAddPhoto(listing.id, reader.result);
          setShowPhotoUploadModal(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="max-w-[1120px] mx-auto px-4 md:px-8 py-6">
      {/* Breadcrumb Navigation */}
      <nav aria-label={locale === 'en' ? 'Breadcrumbs' : 'Хлебные крошки'} className="text-sm text-[var(--muted)] mb-6 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="text-[var(--blue)] hover:underline cursor-pointer font-medium"
        >
          {t('nav.catalog')}
        </button>
        <span>/</span>
        <span>{t(`cat.${content.category}` as TranslationKey)}</span>
        {content.subcategory && (
          <>
            <span>/</span>
            <span>{content.subcategory}</span>
          </>
        )}
      </nav>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,1fr)] gap-8 lg:gap-12 items-start">
        {/* Left Article */}
        <article className="min-w-0">
          <div className="mb-2">
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full inline-block ${
                content.kind === 'offer'
                  ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800'
                  : 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800'
              }`}
            >
              {content.kind === 'offer' ? `📦 ${t('kind.offer')}` : `🔍 ${t('kind.request')}`}
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl lg:text-[40px] font-black tracking-tight text-[var(--ink)] my-3 leading-tight">
            {content.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--muted)] mb-4">
            <span>{locationText || (locale === 'en' ? 'Location: not specified' : 'Локация: не указана')}</span>
            <span>·</span>
            <span>{locale === 'en' ? 'Revision' : 'Ревизия'} #{revision}</span>
            <span>·</span>
            <span className="text-[var(--green)] font-medium">
              {locale === 'en' ? 'Status: Active' : 'Статус: активно'}
            </span>
          </div>

          {/* Mobile Price View */}
          <div className="block lg:hidden my-4 p-4 border border-[var(--line)] rounded-xl bg-[var(--surface)]">
            <div className="text-3xl font-extrabold text-[var(--ink)]">
              {formatPrice(content.price_minor, content.currency, t('card.free'))}
            </div>
            <div className="text-xs text-[var(--muted)] mt-1">
              {content.price_minor
                ? (locale === 'en' ? 'Price specified by author' : 'Цена указана автором')
                : (locale === 'en' ? 'Terms negotiable' : 'Условия договорные')}
            </div>
          </div>

          {/* Gallery */}
          <div className="my-6 border border-[var(--line)] rounded-xl overflow-hidden bg-[var(--surface)] shadow-xs">
            {photos && photos.length > 0 ? (
              <div>
                <div className="relative aspect-4/3 bg-[var(--surface)] flex items-center justify-center overflow-hidden">
                  <img
                    src={photos[selectedPhotoIndex]?.dataUrl}
                    alt={locale === 'en' ? `Photo ${selectedPhotoIndex + 1} of listing` : `Фото ${selectedPhotoIndex + 1} объявления`}
                    className="max-h-full max-w-full object-contain"
                  />
                  {photos.length > 1 && (
                    <div className="absolute inset-x-2 bottom-3 flex justify-between">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedPhotoIndex((prev) =>
                            prev === 0 ? photos.length - 1 : prev - 1
                          )
                        }
                        className="bg-black/60 hover:bg-black/80 text-white rounded-full p-2 text-xs backdrop-blur-xs"
                      >
                        {locale === 'en' ? '← Prev' : '← Назад'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedPhotoIndex((prev) =>
                            prev === photos.length - 1 ? 0 : prev + 1
                          )
                        }
                        className="bg-black/60 hover:bg-black/80 text-white rounded-full p-2 text-xs backdrop-blur-xs"
                      >
                        {locale === 'en' ? 'Next →' : 'Вперёд →'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Thumbnails */}
                <div className="p-3 border-t border-[var(--line)] flex gap-2 overflow-x-auto bg-[var(--canvas)]">
                  {photos.map((p, idx) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPhotoIndex(idx)}
                      className={`relative w-16 h-16 rounded-md overflow-hidden border-2 shrink-0 transition-all ${
                        selectedPhotoIndex === idx
                          ? 'border-[var(--blue)] ring-2 ring-[var(--soft)]'
                          : 'border-[var(--line)] opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={p.dataUrl}
                        alt={locale === 'en' ? `Thumbnail ${idx + 1}` : `Миниатюра ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                  {photos.length < 8 && (
                    <button
                      type="button"
                      onClick={() => setShowPhotoUploadModal(true)}
                      className="w-16 h-16 rounded-md border border-dashed border-[var(--line)] hover:border-[var(--blue)] flex items-center justify-center text-xs text-[var(--muted)] shrink-0 hover:bg-[var(--surface)] transition-colors"
                      title={locale === 'en' ? 'Add photo' : 'Добавить фото'}
                    >
                      {locale === 'en' ? '+ Photo' : '+ Фото'}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* Authentic Prototype Empty State */
              <div
                className="aspect-4/3 flex items-center justify-center text-center p-8 cursor-pointer group"
                onClick={() => setShowPhotoUploadModal(true)}
                role="img"
                aria-label={
                  locale === 'en'
                    ? 'No photos uploaded. Real sales require genuine photos of the item.'
                    : 'Фотографии не загружены. Для реальной продажи нужны настоящие фото вещи.'
                }
              >
                <div>
                  <div className="text-xs md:text-sm tracking-widest text-[var(--blue)] font-bold mb-3 uppercase">
                    {locale === 'en' ? 'YOUR ITEM IN THE SPOTLIGHT' : 'ВАША ВЕЩЬ В ГЛАВНОЙ РОЛИ'}
                  </div>
                  <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[var(--ink)] max-w-xs mx-auto mb-3 leading-snug">
                    {locale === 'en' ? 'Real photos will be here' : 'Здесь будут настоящие фотографии'}
                  </h2>
                  <p className="max-w-sm text-xs md:text-sm text-[var(--muted)] mx-auto leading-relaxed">
                    {locale === 'en'
                      ? 'No stock images or AI fakes. Show the real item, its details and condition.'
                      : 'Без картинок из интернета и AI-подмены. Покажите вещь, её детали и состояние.'}
                  </p>
                  <div className="mt-4 inline-flex items-center gap-1.5 text-xs text-[var(--blue)] font-semibold border border-[var(--line)] px-3 py-1.5 rounded-lg bg-[var(--canvas)] group-hover:bg-[var(--raised)] transition-colors">
                    <span>{locale === 'en' ? '+ Attach photos (up to 8)' : '+ Прикрепить фото (до 8)'}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="border-t border-[var(--line)] px-5 py-3.5 flex justify-between items-center text-xs md:text-sm text-[var(--muted)] bg-[var(--surface)]">
              <span>
                {photos?.length
                  ? (locale === 'en' ? `Uploaded ${photos.length} of 8 photos` : `Загружено ${photos.length} из 8 фото`)
                  : (locale === 'en' ? 'No photos added' : 'Фото не добавлены')}
              </span>
              <span>{locale === 'en' ? 'Up to 8 photos · plan' : 'До 8 фотографий · план'}</span>
            </div>
          </div>

          {/* Description */}
          <section className="my-8">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--ink)] mb-3">
              {locale === 'en' ? 'About Item / Description' : 'О вещи / Описание'}
            </h2>
            <div className="text-[var(--ink)] text-base leading-relaxed whitespace-pre-wrap">
              {content.description}
            </div>
          </section>

          {/* Specs Details */}
          <section className="my-8">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--ink)] mb-4">
              {locale === 'en' ? 'Key Details' : 'Коротко о главном'}
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0 text-sm">
              <div className="py-3 border-b border-[var(--line)]">
                <dt className="text-[var(--muted)]">{locale === 'en' ? 'Listing Type' : 'Тип объявления'}</dt>
                <dd className="font-semibold text-[var(--ink)] mt-0.5">
                  {content.kind === 'offer'
                    ? (locale === 'en' ? 'Offering' : 'Предлагаю')
                    : (locale === 'en' ? 'Seeking / Request' : 'Ищу / Запрос')}
                </dd>
              </div>
              <div className="py-3 border-b border-[var(--line)]">
                <dt className="text-[var(--muted)]">{locale === 'en' ? 'Category' : 'Категория'}</dt>
                <dd className="font-semibold text-[var(--ink)] mt-0.5">
                  {t(`cat.${content.category}` as TranslationKey)}
                  {content.subcategory ? ` → ${content.subcategory}` : ''}
                </dd>
              </div>
              <div className="py-3 border-b border-[var(--line)]">
                <dt className="text-[var(--muted)]">{locale === 'en' ? 'Condition' : 'Состояние'}</dt>
                <dd className="font-semibold text-[var(--ink)] mt-0.5">
                  {content.condition || (locale === 'en' ? 'To be specified by seller' : 'Укажет продавец')}
                </dd>
              </div>
              <div className="py-3 border-b border-[var(--line)]">
                <dt className="text-[var(--muted)]">{locale === 'en' ? 'Delivery / Fulfilment' : 'Передача / получение'}</dt>
                <dd className="font-semibold text-[var(--ink)] mt-0.5">
                  {modesText || (locale === 'en' ? 'Pickup / delivery' : 'Самовывоз / доставка')}
                </dd>
              </div>
              <div className="py-3 border-b border-[var(--line)]">
                <dt className="text-[var(--muted)]">{locale === 'en' ? 'Location' : 'Местонахождение'}</dt>
                <dd className="font-semibold text-[var(--ink)] mt-0.5">
                  {locationText || (locale === 'en' ? 'Not specified' : 'Не указано')}
                </dd>
              </div>
              <div className="py-3 border-b border-[var(--line)]">
                <dt className="text-[var(--muted)]">{locale === 'en' ? 'Author' : 'Автор'}</dt>
                <dd className="font-semibold text-[var(--ink)] mt-0.5">
                  {author_name}
                </dd>
              </div>
            </dl>
          </section>
        </article>

        {/* Right Sidebar */}
        <aside aria-label={locale === 'en' ? 'Price and contact seller' : 'Цена и связь с продавцом'} className="space-y-5">
          {/* Buy / Action Box */}
          <section className="border border-[var(--line)] rounded-xl p-6 bg-[var(--canvas)] shadow-xs">
            <div className="text-3xl lg:text-4xl font-extrabold text-[var(--ink)] tracking-tight">
              {formatPrice(content.price_minor, content.currency, t('card.free'))}
            </div>
            <p className="text-sm text-[var(--muted)] mt-1 mb-5">
              {content.price_minor
                ? (locale === 'en' ? 'Price specified by seller, no hidden fees' : 'Цена указана продавцом, без скрытых сборов')
                : (locale === 'en' ? 'Demo price, not a sales offer' : 'Демонстрационная цена, не предложение о продаже')}
            </p>

            <button
              type="button"
              onClick={() => onContactSeller(listing)}
              className="w-full h-11 mb-2.5 rounded-lg bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white font-semibold text-sm transition-colors cursor-pointer"
            >
              {locale === 'en' ? 'Contact Author' : 'Написать продавцу'}
            </button>

            <button
              type="button"
              onClick={() => onAgentDiscuss(listing)}
              className="w-full h-11 mb-4 rounded-lg border border-blue-200 dark:border-blue-900 bg-[var(--soft)] hover:bg-blue-100 dark:hover:bg-blue-950/40 text-[var(--blue)] font-bold text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <span>👼 {locale === 'en' ? 'Discuss with Angel Agent' : 'Поручить Агенту-Ангелу'}</span>
            </button>

            {/* Attached Rooms Section */}
            {(() => {
              const relatedRooms = rooms.filter((r) => r.listingId === listing.id);
              return (
                <div className="border-t border-[var(--line)] pt-3.5 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider">
                      💬 {locale === 'en' ? 'Rooms & Topics' : 'Комнаты и темы'} ({relatedRooms.length})
                    </span>
                    {onOpenRoom && (
                      <button
                        type="button"
                        onClick={() => onContactSeller(listing)}
                        className="text-xs text-[var(--blue)] hover:underline font-semibold cursor-pointer"
                      >
                        {locale === 'en' ? '+ Open topic' : '+ Открыть тему'}
                      </button>
                    )}
                  </div>

                  {relatedRooms.length > 0 ? (
                    <div className="space-y-2 mt-2">
                      {relatedRooms.map((r) => (
                        <div
                          key={r.id}
                          onClick={() => onOpenRoom && onOpenRoom(r.id)}
                          className="p-2.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] hover:bg-blue-50/50 dark:hover:bg-blue-950/20 flex items-center justify-between gap-2 text-xs cursor-pointer transition-colors"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 font-semibold text-[var(--ink)] truncate">
                              <span>{r.visibility === 'public' ? '🌐' : '🔒'}</span>
                              <span className="truncate">{r.listingTitle || (locale === 'en' ? 'Discussion' : 'Обсуждение')}</span>
                            </div>
                            <span className="text-[11px] text-[var(--muted)]">
                              💬 {r.messages.length} {locale === 'en' ? 'msgs' : 'сообщ.'} · {r.participants.length} {locale === 'en' ? 'participants' : 'участн.'}
                            </span>
                          </div>
                          <span className="text-[var(--blue)] font-bold text-xs shrink-0">{locale === 'en' ? 'Enter ↗' : 'Войти ↗'}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--muted)] mt-1">
                      {locale === 'en'
                        ? 'No active discussions yet. Click "Contact Author" to start a public dialog or private negotiation.'
                        : 'Открытых обсуждений пока нет. Нажмите «Написать продавцу», чтобы начать публичный диалог или приватные переговоры.'}
                    </p>
                  )}
                </div>
              );
            })()}

            <div className="border-t border-[var(--line)] pt-4 space-y-3 text-sm">
              <div>
                <strong className="block text-[var(--ink)] font-semibold">
                  {locale === 'en'
                    ? `Pickup in ${content.locality || 'city'}`
                    : `Самовывоз в ${content.locality || 'городе'}`}
                </strong>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  {locale === 'en'
                    ? 'Exact address is not published openly. Shared after mutual agreement inside a secure negotiation room.'
                    : 'Точный адрес не публикуется в открытом доступе. Его сообщают участники после взаимной договорённости в защищённой комнате.'}
                </p>
              </div>

              <div>
                <strong className="block text-[var(--ink)] font-semibold">
                  {locale === 'en' ? 'Delivery by arrangement' : 'Доставка — по согласованию'}
                </strong>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  {locale === 'en'
                    ? 'Location does not restrict buyer access to the platform.'
                    : 'Местонахождение не ограничивает доступ покупателей к площадке.'}
                </p>
              </div>
            </div>

            <div className="text-xs text-[var(--muted)] p-3.5 bg-[var(--surface)] rounded-lg mt-4 border border-[var(--line)]">
              {locale === 'en'
                ? 'Do not transfer money at the request of strangers. Escrow and payment guarantees are not part of this prototype.'
                : 'Не переводите деньги по просьбе незнакомца. Оплата и гарантии сделки в этот прототип не входят.'}
            </div>
          </section>

          {/* Seller / Profile Card */}
          <section className="border border-[var(--line)] rounded-xl p-5 bg-[var(--canvas)]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[var(--muted)] uppercase font-semibold tracking-wider">
                {listing.profile?.type === 'company'
                  ? (locale === 'en' ? 'Company / Organization' : 'Компания / Организация')
                  : (locale === 'en' ? 'Listing Author' : 'Автор объявления')}
              </span>
              {listing.profile?.verified && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  ✓ {locale === 'en' ? 'Verified' : 'Верифицирован'}
                </span>
              )}
            </div>

            <h2 className="text-lg font-bold text-[var(--ink)] my-1">
              {listing.profile?.name || author_name}
            </h2>

            {listing.profile?.headline && (
              <p className="text-xs text-[var(--blue)] font-medium mb-1.5">
                {listing.profile.headline}
              </p>
            )}

            {listing.profile?.bio && (
              <p className="text-xs text-[var(--ink)]/80 mb-3 leading-relaxed">
                {listing.profile.bio}
              </p>
            )}

            <div className="flex items-center gap-3 text-xs text-[var(--muted)] border-t border-[var(--line)] pt-2.5">
              <span>★ {locale === 'en' ? 'Reputation:' : 'Репутация:'} <strong>{listing.profile?.reputation_score?.toFixed(1) || '5.0'}</strong></span>
              <span>·</span>
              <span>{locale === 'en' ? 'Protocol: MCP Room' : 'Протокол: MCP Room'}</span>
            </div>
          </section>

          {/* Agent Information Card */}
          <section className="bg-[var(--soft)] border border-blue-200/50 rounded-xl p-5">
            <h2 className="text-base font-bold text-[var(--ink)] mb-1">
              {locale === 'en' ? 'Human or Agent — Your Choice' : 'Человек или агент — решаете вы'}
            </h2>
            <p className="text-xs text-[var(--ink)]/80 leading-relaxed">
              {locale === 'en'
                ? 'Architectural blueprint: read, publish, and negotiate via Web UI or Model Context Protocol (MCP). Identical cards and conditions for both interaction modes.'
                : 'План архитектуры: читать, публиковать и отвечать через веб или MCP-протокол. Одна карточка и одни условия для обоих способов взаимодействия.'}
            </p>
          </section>
        </aside>
      </div>

      {/* Principles Section */}
      <section className="border-t border-[var(--line)] pt-8 mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <strong className="block text-[var(--ink)] font-semibold mb-1">
            {locale === 'en' ? 'Open to Everyone' : 'Открыта для всех'}
          </strong>
          <p className="text-xs text-[var(--muted)] leading-relaxed">
            {locale === 'en'
              ? 'City is a filter, not a registration barrier. Items, services, rides, and online proposals are equally accessible to humans and autonomous MCP agents.'
              : 'Город — фильтр, не условие регистрации. Вещи, услуги, доставка и онлайн-предложения доступны для людей и MCP-агентов.'}
          </p>
        </div>
        <div>
          <strong className="block text-[var(--ink)] font-semibold mb-1">
            {locale === 'en' ? 'Mindful Publishing' : 'Публикуете осознанно'}
          </strong>
          <p className="text-xs text-[var(--muted)] leading-relaxed">
            {locale === 'en'
              ? 'Draft and preview first. Public catalog exposure does not expose previous correspondence or private notes.'
              : 'Сначала черновик и предпросмотр. Публичность не распространяется на старую переписку и внутренние заметки.'}
          </p>
        </div>
        <div>
          <strong className="block text-[var(--ink)] font-semibold mb-1">
            {locale === 'en' ? 'Personal Data Stays Private' : 'Личные данные — не витрина'}
          </strong>
          <p className="text-xs text-[var(--muted)] leading-relaxed">
            {locale === 'en'
              ? 'Phone numbers and private addresses never appear automatically. Only protected exchange of contact information upon mutual agreement in a room.'
              : 'Телефон и домашний адрес не появляются на странице автоматически. Только защищённый обмен контактами по обоюдному согласию.'}
          </p>
        </div>
      </section>

      {/* Simple Photo Upload Modal */}
      {showPhotoUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-[var(--canvas)] border border-[var(--line)] rounded-xl max-w-md w-full p-6 shadow-xl my-auto max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-[var(--ink)] mb-2">
              {locale === 'en' ? 'Attach Photo' : 'Прикрепить фотографию'}
            </h3>
            <p className="text-xs text-[var(--muted)] mb-4">
              {locale === 'en'
                ? 'Choose a real photo of the item from your device (JPEG, PNG). Up to 8 photos.'
                : 'Выберите реальную фотографию вещи со своего устройства (JPEG, PNG). До 8 фото.'}
            </p>
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="w-full text-sm text-[var(--muted)] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[var(--blue)] file:text-white hover:file:bg-[var(--blue-hover)] cursor-pointer"
            />
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPhotoUploadModal(false)}
                className="px-4 py-2 text-sm border border-[var(--line)] rounded-lg hover:bg-[var(--surface)] text-[var(--ink)]"
              >
                {t('modal.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
