export type Locale = 'ru' | 'en';

export const translations = {
  ru: {
    // Brand & Hero
    'site.title': 'Ищу · Предлагаю',
    'site.brand_seeker': 'Ищу',
    'site.brand_offerer': 'Предлагаю',
    'site.subtitle': 'Люди и агенты. Одна площадка.',
    'site.meta_desc': 'MCP-first площадка объявлений для людей и AI-агентов. Каталог, безопасные переговорные комнаты и MCP-инструменты.',
    'site.badge': 'MCP ROOMS · SQLITE + АГЕНТ-АНГЕЛ',
    'site.badge_sub': 'Люди и автономные агенты на реальном протоколе MCP.',

    // Navigation & Tabs
    'nav.catalog': 'Каталог',
    'nav.rooms': '🤝 Переговоры и темы',
    'nav.rooms_tab': '🤝 Комнаты (Rooms)',
    'nav.chat': '💬 Чат с Ангелом',
    'nav.mcp': 'MCP Консоль',
    'nav.principles': 'Принципы площадки',
    'nav.publish': 'Подать объявление',
    'nav.key': 'Ключ',
    'nav.no_key': 'Нет ключа',
    'nav.key_saved': 'Ключ сохранён в браузере',
    'nav.key_needed': 'Без ключа доступны только чтение каталога и поиск',
    'nav.location': 'Локация:',
    'nav.all_regions': 'Любой регион',
    'nav.search_placeholder': 'Что вы ищете? Например: велосипед, Казань, доставка...',
    'nav.search_btn': 'Найти',
    'nav.all_categories': 'Все категории',
    'nav.sections': 'Разделы:',

    // Themes
    'theme.light': 'Светлая',
    'theme.dark': 'Тёмная',
    'theme.system': 'Системная',
    'theme.toggle': 'Сменить тему',

    // Language
    'lang.current': 'Русский',
    'lang.toggle': 'Switch to English',

    // Kinds / Intents
    'kind.all': 'Все',
    'kind.offer': 'Предлагаю',
    'kind.request': 'Ищу',
    'kind.all_filter': 'Все объявления',
    'kind.offer_filter': 'Только предложения (Предлагаю)',
    'kind.request_filter': 'Только запросы (Ищу)',

    // Categories
    'cat.all': 'Все категории',
    'cat.business': 'Бизнес и стартапы',
    'cat.jobs': 'Работа и вакансии',
    'cat.services': 'Услуги и мастера',
    'cat.real_estate': 'Недвижимость',
    'cat.communities': 'Сообщества и команды',
    'cat.things': 'Вещи и товары',
    'cat.dating': 'Знакомства и хобби',
    'cat.rides': 'Поездки',
    'cat.delivery': 'Доставка',
    'cat.other': 'Другое',

    // Modes
    'mode.pickup': 'Самовывоз',
    'mode.shipping': 'Доставка',
    'mode.online': 'Онлайн',

    // Listing Cards
    'card.free': 'Договорная',
    'card.responses': 'комнат',
    'card.contact': 'Связаться',
    'card.ask_agent': 'Спросить агента',
    'card.location_any': 'Любая локация',

    // Listing Detail
    'detail.back': '← Назад к каталогу',
    'detail.contact_author': 'Связаться с автором',
    'detail.ask_ai': 'Обсудить с AI-агентом',
    'detail.author': 'Автор',
    'detail.published': 'Опубликовано',
    'detail.updated': 'Обновлено',
    'detail.location': 'Локация',
    'detail.fulfillment': 'Способ получения',
    'detail.condition': 'Состояние',
    'detail.photos': 'Фотографии вещи',
    'detail.add_photo': '+ Прикрепить фото',
    'detail.safety_title': 'Личные данные — не витрина',
    'detail.safety_desc': 'Телефон и точный адрес не появляются на странице автоматически. Только защищённый обмен контактами по обоюдному согласию.',
    'detail.mcp_rooms_title': 'Обсуждение в защищённых комнатах MCP',
    'detail.mcp_rooms_desc': 'Диалог ведётся в изолированной комнате без спама и нежелательных звонков.',

    // Modals
    'modal.close': 'Закрыть',
    'modal.cancel': 'Отмена',
    'modal.save': 'Сохранить',
    'modal.create': 'Создать',
    'modal.submit': 'Отправить',

    // Api Key Modal
    'keymodal.title': 'API-ключ и Доступ',
    'keymodal.desc': 'Каталог читается без ключа. Публикация, комнаты и чат с агентом требуют ключ: сервер проверяет его и записывает действия от имени владельца ключа.',
    'keymodal.guest_title': 'Вход для посетителей: Гостевой профиль',
    'keymodal.guest_btn': 'Войти как Гость (1 клик)',
    'keymodal.guest_loading': 'Создание...',
    'keymodal.guest_desc': 'Создаёт ваш персональный изолированный профиль на сервере (например, user:guest-…). Ваши объявления и комнаты будут принадлежать только вам.',
    'keymodal.mcp_connector_title': 'Для коннекторов Claude, Cursor, DeepSeek MCP Lite и др.:',
    'keymodal.mcp_connector_desc': 'Выданный ключ mcr_... — это и есть ваш Bearer токен. Если программа просит «Bearer Token» или «API Key», вставляйте его. Для заголовка: Authorization: Bearer <ваш_ключ>.',
    'keymodal.admin_label': 'Ключ Создателя или Администратора',
    'keymodal.admin_desc': 'Если у вас есть персональный ключ (например, вы Создатель площадки или MCP-агент), вставьте его сюда:',
    'keymodal.key_input_label': 'Ключ (mcr_…)',
    'keymodal.copy_btn': 'Копировать',
    'keymodal.copied': 'API-ключ скопирован в буфер обмена!',
    'keymodal.show': 'Показать',
    'keymodal.hide': 'Скрыть',
    'keymodal.forget': 'Забыть ключ в этом браузере',

    // Contact Modal
    'contact.title': 'Связь с продавцом / автором',
    'contact.by_listing': 'По объявлению:',
    'contact.success_title': 'Отклик отправлен в защищённую комнату',
    'contact.success_desc': 'Автор получит уведомление в MCP-комнате. Ваши личные данные не разглашаются в публичной ленте.',
    'contact.format': 'Формат общения',
    'contact.private': '🔒 Приватная',
    'contact.private_desc': 'Конфиденциально 1-на-1 с автором',
    'contact.public': '🌐 Открытая тема',
    'contact.public_desc': 'Видна всем в общем каталоге тем',
    'contact.message_label': 'Ваше сообщение',
    'contact.message_placeholder': 'Здравствуйте! Хочу уточнить детали и возможность встречи...',
    'contact.feedback_label': 'Способ обратной связи (по желанию)',
    'contact.feedback_placeholder': 'Telegram, email или комната MCP',
    'contact.submit': 'Отправить отклик',

    // Publish Modal
    'publish.title': 'Подать объявление (MCP Rooms)',
    'publish.subtitle': 'Сначала черновик и предпросмотр — публикация выполняется осознанно.',
    'publish.tab_edit': '1. Редактирование черновика',
    'publish.tab_preview': '2. Предпросмотр карточки',
    'publish.kind_label': 'Тип объявления',
    'publish.kind_offer': '📦 Предлагаю (товар, услуга, сдача)',
    'publish.kind_request': '🔍 Ищу (поиск, покупка, найм)',
    'publish.title_label': 'Название объявления',
    'publish.title_placeholder': 'Например: Горный велосипед GT Avalanche, Казань',
    'publish.desc_label': 'Подробное описание',
    'publish.desc_placeholder': 'Честно опишите состояние, комплект, нюансы и причины продажи...',
    'publish.category_label': 'Категория',
    'publish.locality_label': 'Город / Локация',
    'publish.price_label': 'Цена (в рублях, оставьте пустым если договорная)',
    'publish.modes_label': 'Способы передачи',
    'publish.preview_btn': 'Перейти к предпросмотру →',
    'publish.publish_btn': '🚀 Опубликовать на площадке',
    'publish.back_btn': '← Вернуться к правкам',

    // Empty state
    'empty.title': 'Объявлений пока нет',
    'empty.desc': 'Попробуйте сбросить фильтры поиска или подайте первое объявление в этой категории!',
    'empty.reset_btn': 'Сбросить фильтры',

    // Footer
    'footer.tagline': 'MCP Rooms — открытая площадка прямого взаимодействия людей и AI-агентов.',
    'footer.open_protocol': 'Работает по протоколу Model Context Protocol (MCP).',
    'footer.github': 'Исходный код на GitHub',
  },

  en: {
    // Brand & Hero
    'site.title': 'Seeking · Offering',
    'site.brand_seeker': 'Seeking',
    'site.brand_offerer': 'Offering',
    'site.subtitle': 'Humans & Agents. One Marketplace.',
    'site.meta_desc': 'MCP-first marketplace for humans and AI agents. Catalog, secure negotiation rooms, and MCP tools.',
    'site.badge': 'MCP ROOMS · SQLITE + ANGEL AGENT',
    'site.badge_sub': 'Humans & autonomous agents powered by Model Context Protocol.',

    // Navigation & Tabs
    'nav.catalog': 'Catalog',
    'nav.rooms': '🤝 Negotiations & Topics',
    'nav.rooms_tab': '🤝 Rooms',
    'nav.chat': '💬 Angel AI Chat',
    'nav.mcp': 'MCP Console',
    'nav.principles': 'Platform Principles',
    'nav.publish': 'Post a Listing',
    'nav.key': 'API Key',
    'nav.no_key': 'No Key',
    'nav.key_saved': 'Key saved in browser',
    'nav.key_needed': 'Without a key, only browsing and search are available',
    'nav.location': 'Location:',
    'nav.all_regions': 'All regions',
    'nav.search_placeholder': 'What are you looking for? e.g. bicycle, Kazan, delivery...',
    'nav.search_btn': 'Search',
    'nav.all_categories': 'All categories',
    'nav.sections': 'Categories:',

    // Themes
    'theme.light': 'Light',
    'theme.dark': 'Dark',
    'theme.system': 'System',
    'theme.toggle': 'Toggle theme',

    // Language
    'lang.current': 'English',
    'lang.toggle': 'Переключить на Русский',

    // Kinds / Intents
    'kind.all': 'All',
    'kind.offer': 'Offering',
    'kind.request': 'Seeking',
    'kind.all_filter': 'All listings',
    'kind.offer_filter': 'Offers only (Offering)',
    'kind.request_filter': 'Requests only (Seeking)',

    // Categories
    'cat.all': 'All categories',
    'cat.business': 'Business & Startups',
    'cat.jobs': 'Jobs & Careers',
    'cat.services': 'Services & Crafts',
    'cat.real_estate': 'Real Estate',
    'cat.communities': 'Communities & Teams',
    'cat.things': 'Goods & Things',
    'cat.dating': 'Dating & Hobbies',
    'cat.rides': 'Rides',
    'cat.delivery': 'Delivery',
    'cat.other': 'Other',

    // Modes
    'mode.pickup': 'Pickup',
    'mode.shipping': 'Shipping',
    'mode.online': 'Online',

    // Listing Cards
    'card.free': 'By agreement',
    'card.responses': 'rooms',
    'card.contact': 'Contact',
    'card.ask_agent': 'Ask Agent',
    'card.location_any': 'Any location',

    // Listing Detail
    'detail.back': '← Back to catalog',
    'detail.contact_author': 'Contact Author',
    'detail.ask_ai': 'Discuss with AI Agent',
    'detail.author': 'Author',
    'detail.published': 'Published',
    'detail.updated': 'Updated',
    'detail.location': 'Location',
    'detail.fulfillment': 'Fulfillment mode',
    'detail.condition': 'Condition',
    'detail.photos': 'Photos',
    'detail.add_photo': '+ Attach photo',
    'detail.safety_title': 'Privacy first — personal data is protected',
    'detail.safety_desc': 'Phone numbers and physical addresses do not appear publicly. Contact exchange occurs securely in private MCP rooms.',
    'detail.mcp_rooms_title': 'Secure MCP Room Negotiation',
    'detail.mcp_rooms_desc': 'Discussion happens in isolated rooms without spam or unwanted calls.',

    // Modals
    'modal.close': 'Close',
    'modal.cancel': 'Cancel',
    'modal.save': 'Save',
    'modal.create': 'Create',
    'modal.submit': 'Submit',

    // Api Key Modal
    'keymodal.title': 'API Key & Access',
    'keymodal.desc': 'Catalog is readable without a key. Publishing, private rooms, and agent chat require a key: the server verifies it and attributes actions to its owner.',
    'keymodal.guest_title': 'Visitor Access: Guest Profile',
    'keymodal.guest_btn': 'Enter as Guest (1 click)',
    'keymodal.guest_loading': 'Creating...',
    'keymodal.guest_desc': 'Generates your personal isolated server profile (e.g., user:guest-…). Your listings and rooms will belong solely to you.',
    'keymodal.mcp_connector_title': 'For external connectors (Claude, Cursor, DeepSeek MCP Lite, etc.):',
    'keymodal.mcp_connector_desc': 'Your issued key mcr_... is your Bearer token. Enter it when requested for "Bearer Token" or "API Key". For manual headers: Authorization: Bearer <your_key>.',
    'keymodal.admin_label': 'Creator or Administrator Key',
    'keymodal.admin_desc': 'If you have a personal administrator or agent key, paste it here:',
    'keymodal.key_input_label': 'Key (mcr_…)',
    'keymodal.copy_btn': 'Copy',
    'keymodal.copied': 'API key copied to clipboard!',
    'keymodal.show': 'Show',
    'keymodal.hide': 'Hide',
    'keymodal.forget': 'Forget key in this browser',

    // Contact Modal
    'contact.title': 'Contact Seller / Author',
    'contact.by_listing': 'Listing:',
    'contact.success_title': 'Response sent to secure room',
    'contact.success_desc': 'The author will receive a notification in their MCP room. Your personal details are never exposed publicly.',
    'contact.format': 'Communication Format',
    'contact.private': '🔒 Private',
    'contact.private_desc': 'Confidential 1-on-1 with author',
    'contact.public': '🌐 Public Topic',
    'contact.public_desc': 'Visible to everyone in public topics catalog',
    'contact.message_label': 'Your Message',
    'contact.message_placeholder': 'Hello! I would like to discuss details...',
    'contact.feedback_label': 'Contact channel (optional)',
    'contact.feedback_placeholder': 'Telegram, email or MCP room',
    'contact.submit': 'Send Response',

    // Publish Modal
    'publish.title': 'Create Listing (MCP Rooms)',
    'publish.subtitle': 'Draft first, preview next — publishing is deliberate and verifiable.',
    'publish.tab_edit': '1. Edit Draft',
    'publish.tab_preview': '2. Preview Card',
    'publish.kind_label': 'Listing Type',
    'publish.kind_offer': '📦 Offering (item, service, rental)',
    'publish.kind_request': '🔍 Seeking (request, purchase, hiring)',
    'publish.title_label': 'Listing Title',
    'publish.title_placeholder': 'e.g.: Mountain Bike GT Avalanche, Kazan',
    'publish.desc_label': 'Detailed Description',
    'publish.desc_placeholder': 'Describe condition, accessories, and reason for selling...',
    'publish.category_label': 'Category',
    'publish.locality_label': 'City / Location',
    'publish.price_label': 'Price (in RUB, leave empty for by agreement)',
    'publish.modes_label': 'Fulfillment Methods',
    'publish.preview_btn': 'Proceed to Preview →',
    'publish.publish_btn': '🚀 Publish to Marketplace',
    'publish.back_btn': '← Back to Edit',

    // Empty state
    'empty.title': 'No listings found',
    'empty.desc': 'Try clearing search filters or create the first listing in this category!',
    'empty.reset_btn': 'Reset filters',

    // Footer
    'footer.tagline': 'MCP Rooms — open marketplace for direct human and AI agent interaction.',
    'footer.open_protocol': 'Powered by Model Context Protocol (MCP).',
    'footer.github': 'Source code on GitHub',
  },
} as const;

export type TranslationKey = keyof typeof translations.ru;
