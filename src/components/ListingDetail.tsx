import React, { useState } from 'react';
import { Listing, CATEGORY_LABELS, MODE_LABELS } from '../types';
import { formatPrice } from './ListingCard';

interface ListingDetailProps {
  listing: Listing;
  onBack: () => void;
  onContactSeller: (listing: Listing) => void;
  onAgentDiscuss: (listing: Listing) => void;
  onAddPhoto?: (listingId: string, photoDataUrl: string) => void;
}

export const ListingDetail: React.FC<ListingDetailProps> = ({
  listing,
  onBack,
  onContactSeller,
  onAgentDiscuss,
  onAddPhoto,
}) => {
  const { content, photos, author_name, revision } = listing;
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [showPhotoUploadModal, setShowPhotoUploadModal] = useState(false);

  const modesText = content.modes.map((m) => MODE_LABELS[m]).join(' / ');
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
      <nav aria-label="Хлебные крошки" className="text-sm text-[var(--muted)] mb-6 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="text-[var(--blue)] hover:underline cursor-pointer font-medium"
        >
          Все объявления
        </button>
        <span>/</span>
        <span>{CATEGORY_LABELS[content.category]}</span>
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
            <span className="text-xs font-semibold text-[var(--green)] bg-[var(--greenbg)] px-2.5 py-1 rounded inline-block">
              {content.kind === 'offer' ? 'Предлагаю · объявление' : 'Ищу · запрос'}
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl lg:text-[40px] font-black tracking-tight text-[var(--ink)] my-3 leading-tight">
            {content.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--muted)] mb-4">
            <span>{locationText || 'Локация: не указана'}</span>
            <span>·</span>
            <span>Ревизия #{revision}</span>
            <span>·</span>
            <span className="text-[var(--green)] font-medium">Статус: активно</span>
          </div>

          {/* Mobile Price View */}
          <div className="block lg:hidden my-4 p-4 border border-[var(--line)] rounded-xl bg-[var(--surface)]">
            <div className="text-3xl font-extrabold text-[var(--ink)]">
              {formatPrice(content.price_minor, content.currency)}
            </div>
            <div className="text-xs text-[var(--muted)] mt-1">
              {content.price_minor ? 'Цена указана автором' : 'Условия договорные'}
            </div>
          </div>

          {/* Gallery */}
          <div className="my-6 border border-[var(--line)] rounded-xl overflow-hidden bg-[var(--surface)] shadow-xs">
            {photos && photos.length > 0 ? (
              <div>
                <div className="relative aspect-4/3 bg-[var(--surface)] flex items-center justify-center overflow-hidden">
                  <img
                    src={photos[selectedPhotoIndex]?.dataUrl}
                    alt={`Фото ${selectedPhotoIndex + 1} объявления`}
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
                        ← Назад
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
                        Вперёд →
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
                        alt={`Миниатюра ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                  {photos.length < 8 && (
                    <button
                      type="button"
                      onClick={() => setShowPhotoUploadModal(true)}
                      className="w-16 h-16 rounded-md border border-dashed border-[var(--line)] hover:border-[var(--blue)] flex items-center justify-center text-xs text-[var(--muted)] shrink-0 hover:bg-[var(--surface)] transition-colors"
                      title="Добавить фото"
                    >
                      + Фото
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
                aria-label="Фотографии не загружены. Для реальной продажи нужны настоящие фото вещи."
              >
                <div>
                  <div className="text-xs md:text-sm tracking-widest text-[var(--blue)] font-bold mb-3 uppercase">
                    ВАША ВЕЩЬ В ГЛАВНОЙ РОЛИ
                  </div>
                  <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[var(--ink)] max-w-xs mx-auto mb-3 leading-snug">
                    Здесь будут настоящие фотографии
                  </h2>
                  <p className="max-w-sm text-xs md:text-sm text-[var(--muted)] mx-auto leading-relaxed">
                    Без картинок из интернета и AI-подмены. Покажите вещь, её детали и состояние.
                  </p>
                  <div className="mt-4 inline-flex items-center gap-1.5 text-xs text-[var(--blue)] font-semibold border border-[var(--line)] px-3 py-1.5 rounded-lg bg-[var(--canvas)] group-hover:bg-[var(--raised)] transition-colors">
                    <span>+ Прикрепить фото (до 8)</span>
                  </div>
                </div>
              </div>
            )}

            <div className="border-t border-[var(--line)] px-5 py-3.5 flex justify-between items-center text-xs md:text-sm text-[var(--muted)] bg-[var(--surface)]">
              <span>{photos?.length ? `Загружено ${photos.length} из 8 фото` : 'Фото не добавлены'}</span>
              <span>До 8 фотографий · план</span>
            </div>
          </div>

          {/* Description */}
          <section className="my-8">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--ink)] mb-3">
              О вещи / Описание
            </h2>
            <div className="text-[var(--ink)] text-base leading-relaxed whitespace-pre-wrap">
              {content.description}
            </div>
          </section>

          {/* Specs Details */}
          <section className="my-8">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--ink)] mb-4">
              Коротко о главном
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0 text-sm">
              <div className="py-3 border-b border-[var(--line)]">
                <dt className="text-[var(--muted)]">Тип объявления</dt>
                <dd className="font-semibold text-[var(--ink)] mt-0.5">
                  {content.kind === 'offer' ? 'Предлагаю' : 'Ищу / Запрос'}
                </dd>
              </div>
              <div className="py-3 border-b border-[var(--line)]">
                <dt className="text-[var(--muted)]">Категория</dt>
                <dd className="font-semibold text-[var(--ink)] mt-0.5">
                  {CATEGORY_LABELS[content.category]}
                  {content.subcategory ? ` → ${content.subcategory}` : ''}
                </dd>
              </div>
              <div className="py-3 border-b border-[var(--line)]">
                <dt className="text-[var(--muted)]">Состояние</dt>
                <dd className="font-semibold text-[var(--ink)] mt-0.5">
                  {content.condition || 'Укажет продавец'}
                </dd>
              </div>
              <div className="py-3 border-b border-[var(--line)]">
                <dt className="text-[var(--muted)]">Передача / получение</dt>
                <dd className="font-semibold text-[var(--ink)] mt-0.5">
                  {modesText || 'Самовывоз / доставка'}
                </dd>
              </div>
              <div className="py-3 border-b border-[var(--line)]">
                <dt className="text-[var(--muted)]">Местонахождение</dt>
                <dd className="font-semibold text-[var(--ink)] mt-0.5">
                  {locationText || 'Не указано'}
                </dd>
              </div>
              <div className="py-3 border-b border-[var(--line)]">
                <dt className="text-[var(--muted)]">Автор</dt>
                <dd className="font-semibold text-[var(--ink)] mt-0.5">
                  {author_name}
                </dd>
              </div>
            </dl>
          </section>
        </article>

        {/* Right Sidebar */}
        <aside aria-label="Цена и связь с продавцом" className="space-y-5">
          {/* Buy / Action Box */}
          <section className="border border-[var(--line)] rounded-xl p-6 bg-[var(--canvas)] shadow-xs">
            <div className="text-3xl lg:text-4xl font-extrabold text-[var(--ink)] tracking-tight">
              {formatPrice(content.price_minor, content.currency)}
            </div>
            <p className="text-sm text-[var(--muted)] mt-1 mb-5">
              {content.price_minor
                ? 'Цена указана продавцом, без скрытых сборов'
                : 'Демонстрационная цена, не предложение о продаже'}
            </p>

            <button
              type="button"
              onClick={() => onContactSeller(listing)}
              className="w-full h-11 mb-2.5 rounded-lg bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white font-semibold text-sm transition-colors cursor-pointer"
            >
              Написать продавцу
            </button>

            <button
              type="button"
              onClick={() => onAgentDiscuss(listing)}
              className="w-full h-11 mb-4 rounded-lg border border-blue-200 bg-[var(--soft)] hover:bg-blue-100 text-[var(--blue)] font-bold text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <span>👼 Поручить Агенту-Ангелу</span>
            </button>

            <div className="border-t border-[var(--line)] pt-4 space-y-3 text-sm">
              <div>
                <strong className="block text-[var(--ink)] font-semibold">
                  Самовывоз в {content.locality || 'городе'}
                </strong>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  Точный адрес не публикуется в открытом доступе. Его сообщают участники после взаимной договорённости в защищённой комнате.
                </p>
              </div>

              <div>
                <strong className="block text-[var(--ink)] font-semibold">
                  Доставка — по согласованию
                </strong>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  Местонахождение не ограничивает доступ покупателей к площадке.
                </p>
              </div>
            </div>

            <div className="text-xs text-[var(--muted)] p-3.5 bg-[var(--surface)] rounded-lg mt-4 border border-[var(--line)]">
              Не переводите деньги по просьбе незнакомца. Оплата и гарантии сделки в этот прототип не входят.
            </div>
          </section>

          {/* Seller / Profile Card */}
          <section className="border border-[var(--line)] rounded-xl p-5 bg-[var(--canvas)]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[var(--muted)] uppercase font-semibold tracking-wider">
                {listing.profile?.type === 'company' ? 'Компания / Организация' : 'Автор объявления'}
              </span>
              {listing.profile?.verified && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  ✓ Верифицирован
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
              <span>★ Репутация: <strong>{listing.profile?.reputation_score?.toFixed(1) || '5.0'}</strong></span>
              <span>·</span>
              <span>Протокол: MCP Room</span>
            </div>
          </section>

          {/* Agent Information Card */}
          <section className="bg-[var(--soft)] border border-blue-200/50 rounded-xl p-5">
            <h2 className="text-base font-bold text-[var(--ink)] mb-1">
              Человек или агент — решаете вы
            </h2>
            <p className="text-xs text-[var(--ink)]/80 leading-relaxed">
              План архитектуры: читать, публиковать и отвечать через веб или MCP-протокол. Одна карточка и одни условия для обоих способов взаимодействия.
            </p>
          </section>
        </aside>
      </div>

      {/* Principles Section */}
      <section className="border-t border-[var(--line)] pt-8 mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <strong className="block text-[var(--ink)] font-semibold mb-1">
            Открыта для всех
          </strong>
          <p className="text-xs text-[var(--muted)] leading-relaxed">
            Город — фильтр, не условие регистрации. Вещи, услуги, доставка и онлайн-предложения доступны для людей и MCP-агентов.
          </p>
        </div>
        <div>
          <strong className="block text-[var(--ink)] font-semibold mb-1">
            Публикуете осознанно
          </strong>
          <p className="text-xs text-[var(--muted)] leading-relaxed">
            Сначала черновик и предпросмотр. Публичность не распространяется на старую переписку и внутренние заметки.
          </p>
        </div>
        <div>
          <strong className="block text-[var(--ink)] font-semibold mb-1">
            Личные данные — не витрина
          </strong>
          <p className="text-xs text-[var(--muted)] leading-relaxed">
            Телефон и домашний адрес не появляются на странице автоматически. Только защищённый обмен контактами по обоюдному согласию.
          </p>
        </div>
      </section>

      {/* Simple Photo Upload Modal */}
      {showPhotoUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[var(--canvas)] border border-[var(--line)] rounded-xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-[var(--ink)] mb-2">
              Прикрепить фотографию
            </h3>
            <p className="text-xs text-[var(--muted)] mb-4">
              Выберите реальную фотографию вещи со своего устройства (JPEG, PNG). До 8 фото.
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
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
