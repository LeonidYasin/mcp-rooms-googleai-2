import { ListingCategory } from '../types';

export type FaceId =
  | 'general'
  | 'ai_dev'
  | 'invest'
  | 'dating'
  | 'taxi'
  | 'services'
  | 'logistics'
  | 'real_estate'
  | 'equipment'
  | 'procurement'
  | 'mentoring'
  | 'barter'
  | 'm2m_agents';

export type SpecialFeatureType =
  | 'standard'
  | 'compute'
  | 'venture'
  | 'dating'
  | 'rides'
  | 'equipment'
  | 'procurement'
  | 'mentoring'
  | 'barter'
  | 'm2m_agents';

export interface QuickChip {
  labelRu: string;
  labelEn: string;
  query: string;
  category?: ListingCategory;
}

export interface PublishPreset {
  defaultCategory: ListingCategory;
  titleHintRu: string;
  titleHintEn: string;
  descHintRu: string;
  descHintEn: string;
}

export interface SpecialFeature {
  type: SpecialFeatureType;
  labelRu: string;
  labelEn: string;
  infoRu: string;
  infoEn: string;
}

export interface FaceConfig {
  id: FaceId;
  nameRu: string;
  nameEn: string;
  emoji: string;
  badgeRu: string;
  badgeEn: string;
  taglineRu: string;
  taglineEn: string;
  descriptionRu: string;
  descriptionEn: string;
  accentColor: string;
  borderAccent: string;
  bgTint: string;
  primaryCategories: ListingCategory[];
  quickChips: QuickChip[];
  publishPreset: PublishPreset;
  specialFeature: SpecialFeature;
}

export const FACES_REGISTRY: Record<FaceId, FaceConfig> = {
  general: {
    id: 'general',
    nameRu: 'Все темы (Универсальная)',
    nameEn: 'All Themes (Universal)',
    emoji: '🌐',
    badgeRu: 'УНИВЕРСАЛЬНЫЙ РЕЕСТР · MCP ROOMS',
    badgeEn: 'UNIVERSAL REGISTRY · MCP ROOMS',
    taglineRu: 'Люди и автономные AI-агенты. Одна площадка.',
    taglineEn: 'Humans and autonomous AI agents. One marketplace.',
    descriptionRu: 'Полный каталог всех сфер: товары, услуги, разработка, логистика и партнерства.',
    descriptionEn: 'Complete catalogue across all domains: goods, services, development, logistics, and partnerships.',
    accentColor: '#1868b3',
    borderAccent: 'border-blue-500/30',
    bgTint: 'bg-blue-500/5',
    primaryCategories: [
      'real_estate',
      'communities',
      'business',
      'jobs',
      'services',
      'things',
      'dating',
      'rides',
      'delivery',
      'other',
    ],
    quickChips: [
      { labelRu: '🔥 Все объявления', labelEn: '🔥 All listings', query: '' },
      { labelRu: '📦 Предлагаю', labelEn: '📦 Offers', query: 'предлагаю' },
      { labelRu: '🔍 Ищу', labelEn: '🔍 Requests', query: 'ищу' },
      { labelRu: '💻 IT и код', labelEn: '💻 Tech & Code', query: 'разработка' },
      { labelRu: '📍 Казань', labelEn: '📍 Kazan', query: 'Казань' },
    ],
    publishPreset: {
      defaultCategory: 'services',
      titleHintRu: 'Например: Горный велосипед GT Avalanche или Услуги сантехника',
      titleHintEn: 'e.g.: Mountain Bike GT Avalanche or Plumbing Services',
      descHintRu: 'Честно опишите состояние, условия, таймслоты и детали...',
      descHintEn: 'Describe condition, availability, timeline, and details honestly...',
    },
    specialFeature: {
      type: 'standard',
      labelRu: 'Универсальное ядро',
      labelEn: 'Universal Kernel',
      infoRu: 'Поддержка всех типов контрактов и 13 нативных инструментов MCP.',
      infoEn: 'Supports all contract types and 13 native MCP tools.',
    },
  },

  ai_dev: {
    id: 'ai_dev',
    nameRu: 'AI & Dev Hub',
    nameEn: 'AI & Dev Hub',
    emoji: '⚡',
    badgeRu: 'AI-ВЫЧИСЛЕНИЯ & MCP-СЕРВЕРЫ',
    badgeEn: 'AI COMPUTE & MCP SERVERS',
    taglineRu: 'Биржа мощностей GPU, MCP-инструментов и заказной разработки агентов.',
    taglineEn: 'Exchange of GPU compute, MCP tools, and custom AI agent development.',
    descriptionRu: 'Аренда серверов с GPU (H100, RTX 4090), написание MCP-серверов, файн-тюнинг и разметка датасетов.',
    descriptionEn: 'GPU cluster rental (H100, RTX 4090), custom MCP server authoring, model fine-tuning, and dataset annotation.',
    accentColor: '#10b981',
    borderAccent: 'border-emerald-500/40',
    bgTint: 'bg-emerald-500/5',
    primaryCategories: ['business', 'jobs', 'services'],
    quickChips: [
      { labelRu: '🚀 8x H100 / A100 GPU', labelEn: '🚀 8x H100 / A100 GPU', query: 'H100' },
      { labelRu: '🛠️ Разработка MCP', labelEn: '🛠️ Custom MCP Server', query: 'MCP' },
      { labelRu: '🤖 AI-Агенты под ключ', labelEn: '🤖 AI Agents', query: 'агент' },
      { labelRu: '📊 Разметка данных', labelEn: '📊 Data Annotation', query: 'датасет' },
      { labelRu: '⚡ vLLM & Ollama хостинг', labelEn: '⚡ vLLM & Ollama', query: 'vLLM' },
    ],
    publishPreset: {
      defaultCategory: 'business',
      titleHintRu: 'Например: Аренда ноды 4x RTX 4090 24GB под inference vLLM или Разработка MCP-сервера',
      titleHintEn: 'e.g.: Node 4x RTX 4090 24GB rental for vLLM or Custom MCP Server Development',
      descHintRu: 'Укажите спецификацию (VRAM, CUDA, CPU/RAM, пропускная способность сети, доступ по SSH/API)...',
      descHintEn: 'Specify hardware (VRAM, CUDA, CPU/RAM, network bandwidth, SSH/API access terms)...',
    },
    specialFeature: {
      type: 'compute',
      labelRu: 'Аппаратный Term Sheet',
      labelEn: 'Hardware Term Sheet',
      infoRu: 'Фиксация модели GPU, VRAM, SSH-доступа и SLA по аптайму в переговорной комнате.',
      infoEn: 'Binding GPU model, VRAM specs, SSH credentials, and uptime SLA in negotiation room.',
    },
  },

  invest: {
    id: 'invest',
    nameRu: 'Стартапы & Инвесторы',
    nameEn: 'Startups & Investors',
    emoji: '💼',
    badgeRu: 'VENTURE DEAL FLOW & ANGELS',
    badgeEn: 'VENTURE DEAL FLOW & ANGELS',
    taglineRu: 'Питчи, синдикаты, кофаундеры и инвестиционные соглашения в защищённых комнатах.',
    taglineEn: 'Pitches, syndicates, co-founders, and venture deal agreements in private rooms.',
    descriptionRu: 'Встречи бизнес-ангелов и фаундеров: привлечение pre-seed/seed раундов, поиск кофаундеров, SAFE и гранты.',
    descriptionEn: 'Meeting place for business angels and founders: pre-seed/seed funding, co-founder search, SAFE, and grants.',
    accentColor: '#8b5cf6',
    borderAccent: 'border-violet-500/40',
    bgTint: 'bg-violet-500/5',
    primaryCategories: ['business', 'jobs', 'communities'],
    quickChips: [
      { labelRu: '🦄 Ищу инвестиции (Pitch)', labelEn: '🦄 Seeking Investment', query: 'инвестиции' },
      { labelRu: '💰 Бизнес-ангел (Smart Money)', labelEn: '💰 Business Angel', query: 'инвестор' },
      { labelRu: '🤝 Ищу Co-founder', labelEn: '🤝 Co-founder Search', query: 'кофаундер' },
      { labelRu: '📜 SAFE / Pre-Seed', labelEn: '📜 SAFE / Pre-Seed', query: 'SAFE' },
      { labelRu: '📊 AI SaaS / B2B', labelEn: '📊 AI SaaS / B2B', query: 'SaaS' },
    ],
    publishPreset: {
      defaultCategory: 'business',
      titleHintRu: 'Например: Ищем Pre-Seed ангела $75k за 6% SAFE (Agentic AI B2B, $12k MRR) или Инвестор Smart Money',
      titleHintEn: 'e.g.: Seeking Pre-Seed angel $75k for 6% SAFE (B2B Agentic AI, $12k MRR) or Smart Money Angel',
      descHintRu: 'Опишите проблему, рынок, трекшн, стадию, оценку проекта и условия раунда...',
      descHintEn: 'Describe problem, market size, traction, stage, valuation, and round terms...',
    },
    specialFeature: {
      type: 'venture',
      labelRu: 'Инвестиционный Term Sheet',
      labelEn: 'Investment Term Sheet',
      infoRu: 'Согласование чека, оценки (Valuation), долей (Equity) и траншей прямо в переговорной комнате.',
      infoEn: 'Negotiate ticket size, valuation, equity shares, and milestones inside the private room.',
    },
  },

  dating: {
    id: 'dating',
    nameRu: 'Знакомства & Дейтинг',
    nameEn: 'Agentic Dating',
    emoji: '❤️',
    badgeRu: 'AGENTIC DATING · БЕЗ СВАЙПОВ',
    badgeEn: 'AGENTIC DATING · NO SWIPES',
    taglineRu: 'Поиск пары и единомышленников через персональных агентов по глубинным ценностям.',
    taglineEn: 'Find matches and soulmates through personal AI agents matching shared values.',
    descriptionRu: 'Интеллектуальный мэтчинг по хобби, взглядам и целям без бесконечных свайпов. Общение в защищённой комнате.',
    descriptionEn: 'Intelligent matchmaking by hobbies, life goals, and values without superficial swiping. Safe room chat.',
    accentColor: '#ec4899',
    borderAccent: 'border-pink-500/40',
    bgTint: 'bg-pink-500/5',
    primaryCategories: ['dating', 'communities'],
    quickChips: [
      { labelRu: '☕ Свидание за кофе', labelEn: '☕ Coffee Date', query: 'кофе' },
      { labelRu: '🚴 Спорт и пробежки', labelEn: '🚴 Sport & Outdoor', query: 'велопрогулок' },
      { labelRu: '🎨 Выставки и искусство', labelEn: '🎨 Art & Museums', query: 'искусство' },
      { labelRu: '🏔️ Путешествия и горы', labelEn: '🏔️ Travel & Hiking', query: 'путешествия' },
      { labelRu: '🎲 Настольные игры', labelEn: '🎲 Board Games', query: 'настолки' },
    ],
    publishPreset: {
      defaultCategory: 'dating',
      titleHintRu: 'Например: Ищу спутницу для велопрогулок и поездок на природу или Собеседника для походов на выставки',
      titleHintEn: 'e.g.: Seeking a companion for cycling and outdoor trips or cultural art discussions',
      descHintRu: 'Расскажите о себе, своих увлечениях, любимых книгах, фильмах и идеальном сценарии первой встречи...',
      descHintEn: 'Tell about your passions, hobbies, favorite books/films, and your ideal first meetup scenario...',
    },
    specialFeature: {
      type: 'dating',
      labelRu: 'Safe Date Planning',
      labelEn: 'Safe Date Planning',
      infoRu: 'Защита личных контактов: телефон не светится, место и таймслот согласовывают агенты.',
      infoEn: 'Zero-knowledge contacts: phone numbers stay private; venue and time agreed via rooms.',
    },
  },

  taxi: {
    id: 'taxi',
    nameRu: 'Такси & Поездки',
    nameEn: 'Taxi & Rides On-Demand',
    emoji: '🚕',
    badgeRu: 'ON-DEMAND TAXI · ДИНАМИЧЕСКИЙ ТОРГ',
    badgeEn: 'ON-DEMAND TAXI · DYNAMIC BIDDING',
    taglineRu: 'Срочные поездки, трансферы и междугородний попутный транспорт с торгом за 60 секунд.',
    taglineEn: 'Instant rides, airport transfers, and intercity carpooling with 60-second live bidding.',
    descriptionRu: 'Прямой контакт пассажиров и водителей без 30% комиссии агрегаторов. Моментальное согласование цены в комнате.',
    descriptionEn: 'Direct connection between riders and drivers without 30% platform fees. Instant price consensus in room.',
    accentColor: '#eab308',
    borderAccent: 'border-amber-500/40',
    bgTint: 'bg-amber-500/5',
    primaryCategories: ['rides'],
    quickChips: [
      { labelRu: '✈️ Трансфер в аэропорт', labelEn: '✈️ Airport Transfer', query: 'аэропорт' },
      { labelRu: '🏙️ Поездка по городу', labelEn: '🏙️ City Ride', query: 'Казань' },
      { labelRu: '🛣️ Межгород / Попутчик', labelEn: '🛣️ Intercity Travel', query: 'Иннополис' },
      { labelRu: '🚗 Комфорт+ класс', labelEn: '🚗 Comfort+ Class', query: 'комфорт' },
      { labelRu: '⏱️ Срочно за 15 мин', labelEn: '⏱️ Urgent in 15m', query: 'срочно' },
    ],
    publishPreset: {
      defaultCategory: 'rides',
      titleHintRu: 'Например: Срочно такси Центр → Аэропорт (2 чемодана) или Поездки Казань — Иннополис на кроссовере',
      titleHintEn: 'e.g.: Urgent ride City Center → Airport or Kazan — Innopolis daily commute',
      descHintRu: 'Укажите маршрут (откуда, куда), время выезда, класс машины, количество пассажиров и багаж...',
      descHintEn: 'Specify route (origin, destination), departure time, car class, passenger count, and luggage...',
    },
    specialFeature: {
      type: 'rides',
      labelRu: 'Dynamic Ride Bidding',
      labelEn: 'Dynamic Ride Bidding',
      infoRu: 'Динамический торг за 60 секунд с фиксацией точек маршрута и класса авто в переговорной комнате.',
      infoEn: '60-second real-time bidding with fixed route waypoints and vehicle tier in the room.',
    },
  },

  services: {
    id: 'services',
    nameRu: 'Мастера & Услуги',
    nameEn: 'Local Pros & Services',
    emoji: '🛠️',
    badgeRu: 'ПРОВЕРЕННЫЕ МАСТЕРА · БЕЗ ПОСРЕДНИКОВ',
    badgeEn: 'VERIFIED PROS · DIRECT CONTRACT',
    taglineRu: 'Ремонт, сантехника, электрика, отделка и бытовые услуги с гарантией по договору.',
    taglineEn: 'Home repairs, plumbing, electrical works, finishing, and professional services.',
    descriptionRu: 'Прямой заказ проверенных мастеров с согласованием сметы, этапов и гарантий в переговорной комнате.',
    descriptionEn: 'Direct booking of verified specialists with agreed estimates, milestones, and warranties.',
    accentColor: '#f97316',
    borderAccent: 'border-orange-500/40',
    bgTint: 'bg-orange-500/5',
    primaryCategories: ['services', 'jobs'],
    quickChips: [
      { labelRu: '🔧 Сантехника & Отопление', labelEn: '🔧 Plumbing & Heating', query: 'сантехник' },
      { labelRu: '⚡ Электрика & Проводка', labelEn: '⚡ Electrical Work', query: 'электрик' },
      { labelRu: '🏠 Комплексный ремонт', labelEn: '🏠 Full Renovation', query: 'ремонт' },
      { labelRu: '🧹 Клининг & Уборка', labelEn: '🧹 Professional Cleaning', query: 'клининг' },
      { labelRu: '⚖️ Юристы & Консалтинг', labelEn: '⚖️ Legal & Consulting', query: 'юрист' },
    ],
    publishPreset: {
      defaultCategory: 'services',
      titleHintRu: 'Например: Комплексный ремонт квартир под ключ с гарантией или Замена радиатора отопления',
      titleHintEn: 'e.g.: Turnkey apartment renovation with warranty or Heating radiator replacement',
      descHintRu: 'Опишите фронт работ, наличие материала, удобные даты и требования к квалификации...',
      descHintEn: 'Detail work scope, materials available, preferred schedule, and qualification requirements...',
    },
    specialFeature: {
      type: 'standard',
      labelRu: 'Смета и гарантия',
      labelEn: 'Estimate & Warranty',
      infoRu: 'Фиксация сметы, сроков выполнения и гарантийных обязательств мастера в Term Sheet.',
      infoEn: 'Fixing itemized estimate, delivery milestones, and warranty period in the Term Sheet.',
    },
  },

  logistics: {
    id: 'logistics',
    nameRu: 'Курьеры & Грузы',
    nameEn: 'Couriers & Cargo',
    emoji: '🚚',
    badgeRu: 'ЭКСПРЕСС-ЛОГИСТИКА · ON-DEMAND',
    badgeEn: 'EXPRESS LOGISTICS · ON-DEMAND',
    taglineRu: 'Срочная доставка документов, посылок и грузоперевозки от 30 минут.',
    taglineEn: 'Urgent document delivery, parcel dispatch, and freight transport from 30 minutes.',
    descriptionRu: 'Пешие и автокурьеры, грузовые газели и попутные фуры с прямым трекингом и договором в комнате.',
    descriptionEn: 'Foot/car couriers, cargo vans, and freight freight with live negotiation in private rooms.',
    accentColor: '#0ea5e9',
    borderAccent: 'border-sky-500/40',
    bgTint: 'bg-sky-500/5',
    primaryCategories: ['delivery'],
    quickChips: [
      { labelRu: '🏃 Пеший курьер (до 3 кг)', labelEn: '🏃 Foot Courier (<3kg)', query: 'пеший' },
      { labelRu: '📦 Срочная доставка (60 мин)', labelEn: '📦 Express in 60m', query: 'срочная' },
      { labelRu: '🚛 Грузовая Газель', labelEn: '🚛 Cargo Van', query: 'грузо' },
      { labelRu: '📦 Попутный сборный груз', labelEn: '📦 Shared Freight', query: 'попутный' },
      { labelRu: '📄 Доставка документов', labelEn: '📄 Document Courier', query: 'документы' },
    ],
    publishPreset: {
      defaultCategory: 'delivery',
      titleHintRu: 'Например: Срочно доставить документы из офиса в суд за 60 минут или Услуги курьера на авто',
      titleHintEn: 'e.g.: Express document delivery to courthouse in 60m or Courier services by car',
      descHintRu: 'Укажите вес, габариты груза, точные адреса забора/вручения и интервал времени...',
      descHintEn: 'Specify package weight, dimensions, pickup and dropoff addresses, and time window...',
    },
    specialFeature: {
      type: 'rides',
      labelRu: 'Proof of Delivery',
      labelEn: 'Proof of Delivery',
      infoRu: 'Протокол подтверждения передачи отправления и одноразовый код вручения в комнате.',
      infoEn: 'Proof-of-delivery protocol and single-use handover confirmation code in the room.',
    },
  },

  real_estate: {
    id: 'real_estate',
    nameRu: 'Недвижимость & Локации',
    nameEn: 'Real Estate & Spaces',
    emoji: '🏢',
    badgeRu: 'ПРЯМАЯ АРЕНДА · БЕЗ КОМИССИЙ',
    badgeEn: 'DIRECT RENTAL · NO COMMISSIONS',
    taglineRu: 'Квартиры, коворкинги, склады, офисы и фотостудии напрямую от собственников.',
    taglineEn: 'Apartments, coworking desks, warehouses, offices, and photo studios direct from owners.',
    descriptionRu: 'Прямые сделки по аренде без риелторов: согласование правил проживания, депозита и дат в комнате.',
    descriptionEn: 'Direct rental agreements without broker markups: terms, deposits, and dates agreed in rooms.',
    accentColor: '#0d9488',
    borderAccent: 'border-teal-500/40',
    bgTint: 'bg-teal-500/5',
    primaryCategories: ['real_estate'],
    quickChips: [
      { labelRu: '🏙️ Аренда квартир (долгосрок)', labelEn: '🏙️ Long-term Apartments', query: 'квартир' },
      { labelRu: '💻 Место в коворкинге', labelEn: '💻 Coworking Desk', query: 'коворкинг' },
      { labelRu: '🏢 Офисы и переговорные', labelEn: '🏢 Office & Meeting Room', query: 'офис' },
      { labelRu: '📦 Тёплый склад / Бокс', labelEn: '📦 Warm Warehouse / Storage', query: 'склад' },
      { labelRu: '📸 Фотостудия с циклорамой', labelEn: '📸 Photo Studio', query: 'студия' },
    ],
    publishPreset: {
      defaultCategory: 'real_estate',
      titleHintRu: 'Например: Рабочее место в IT-коворкинге в центре или Сдается евро-двушка от собственника',
      titleHintEn: 'e.g.: Coworking desk in downtown IT hub or 1-Bedroom apartment from owner',
      descHintRu: 'Укажите метраж, этаж, коммунальные платежи, размер залога, мебель, интернет и правила...',
      descHintEn: 'Detail square meters, floor, utilities, deposit amount, furniture, WiFi, and house rules...',
    },
    specialFeature: {
      type: 'standard',
      labelRu: 'Опись и залог',
      labelEn: 'Deposit & Inventory',
      infoRu: 'Фиксация обеспечительного платежа, описи имущества и акта возврата в переговорной комнате.',
      infoEn: 'Fixing security deposit, furniture inventory, and handover protocol in the private room.',
    },
  },

  equipment: {
    id: 'equipment',
    nameRu: 'Спецоборудование & Аренда',
    nameEn: 'Equipment & Tool Sharing',
    emoji: '🚜',
    badgeRu: 'ШЕРИНГ ОБОРУДОВАНИЯ · БЕЗ ПРОСТОЕВ',
    badgeEn: 'EQUIPMENT SHARING · ZERO DOWNTIME',
    taglineRu: 'Аренда строительного инструмента, съёмочной техники, дронов и генераторов.',
    taglineEn: 'Rental of heavy machinery, cinema/lighting gear, drones, and power tools.',
    descriptionRu: 'Шеринг дорогостоящего оборудования между профессионалами с фиксацией залога и моточасов в комнате.',
    descriptionEn: 'Sharing high-value equipment between professionals with locked deposit and hour meter in room.',
    accentColor: '#d97706',
    borderAccent: 'border-amber-600/40',
    bgTint: 'bg-amber-600/5',
    primaryCategories: ['things', 'services'],
    quickChips: [
      { labelRu: '🔨 Виброплиты & Отбойники', labelEn: '🔨 Power Tools', query: 'виброплита' },
      { labelRu: '🎥 Кинокамеры & Свет', labelEn: '🎥 Cinema Cameras', query: 'камера' },
      { labelRu: '⚡ Генераторы 5-10 кВт', labelEn: '⚡ Power Generators', query: 'генератор' },
      { labelRu: '🖨️ 3D-печать (нейлон/карбон)', labelEn: '🖨️ 3D Printing', query: '3D-печать' },
      { labelRu: '🌡️ Тепловизоры Flir', labelEn: '🌡️ Thermal Cameras', query: 'тепловизор' },
    ],
    publishPreset: {
      defaultCategory: 'things',
      titleHintRu: 'Например: Аренда кинокамеры RED Komodo с оптикой или Виброплита 90 кг на выходные',
      titleHintEn: 'e.g.: RED Komodo camera package rental or 90kg Compactor for weekend',
      descHintRu: 'Укажите комплектацию, суточный тариф, размер залога, место выдачи и техническое состояние...',
      descHintEn: 'Specify accessories, daily rate, deposit amount, pickup location, and operational specs...',
    },
    specialFeature: {
      type: 'equipment',
      labelRu: 'Залог и моточасы',
      labelEn: 'Deposit & Operating Hours',
      infoRu: 'Фиксация залогового депозита, комплектности и максимальной наработки моточасов в комнате.',
      infoEn: 'Binding security deposit, equipment checklist, and operating hour allowance in room.',
    },
  },

  procurement: {
    id: 'procurement',
    nameRu: 'B2B Закупки & Аукционы',
    nameEn: 'B2B Procurement & Auctions',
    emoji: '📦',
    badgeRu: 'РЕВЕРСИВНЫЕ АУКЦИОНЫ · B2B ОПТ',
    badgeEn: 'REVERSE AUCTIONS · B2B WHOLESALE',
    taglineRu: 'Прямые поставки сырья, оптовые партии и реверсивные аукционы на понижение цены.',
    taglineEn: 'Direct raw material sourcing, bulk wholesale lots, and reverse downward bidding auctions.',
    descriptionRu: 'Заказчики публикуют спецификацию (Request), а поставщики торгуются в переговорной комнате за объём.',
    descriptionEn: 'Buyers publish RFP specs (Request), and qualified suppliers bid downward in private rooms.',
    accentColor: '#1d4ed8',
    borderAccent: 'border-blue-700/40',
    bgTint: 'bg-blue-700/5',
    primaryCategories: ['business', 'things', 'services'],
    quickChips: [
      { labelRu: '🏗️ Кабель ВВГнг-LS (ГОСТ)', labelEn: '🏗️ Industrial Cables', query: 'кабель' },
      { labelRu: '📦 Гофротара Т-24 оптом', labelEn: '📦 Bulk Packaging', query: 'гофротара' },
      { labelRu: '🔩 Металлопрокат со склада', labelEn: '🔩 Steel & Metals', query: 'металлопрокат' },
      { labelRu: '🧪 Промышленная химия', labelEn: '🧪 Industrial Chem', query: 'сырье' },
      { labelRu: '📑 Тендеры с отсрочкой 14д', labelEn: '📑 14d Deferred Bids', query: 'отсрочка' },
    ],
    publishPreset: {
      defaultCategory: 'business',
      titleHintRu: 'Например: Закупка кабеля ВВГнг-LS 3x2.5 — 5000 м (ГОСТ) или Оптовая партия гофрокоробов',
      titleHintEn: 'e.g.: Procurement of VVGng-LS 3x2.5 cable — 5000m (GOST) or Bulk cardboard boxes',
      descHintRu: 'Опишите требуемый объем партии, ГОСТ/ТУ, требования к сертификатам, базис поставки и условия оплаты...',
      descHintEn: 'Specify lot volume, technical certifications, delivery basis (Incoterms), and payment terms...',
    },
    specialFeature: {
      type: 'procurement',
      labelRu: 'Реверсивный торг',
      labelEn: 'Reverse Bidding',
      infoRu: 'Протокол реверсивного торга агентов поставщиков с фиксацией объёма партии и сертификатов.',
      infoEn: 'Supplier agent reverse bidding protocol with verified lot volume and compliance certs.',
    },
  },

  mentoring: {
    id: 'mentoring',
    nameRu: 'Эксперты & Консалтинг',
    nameEn: 'Experts & Mentoring',
    emoji: '🎓',
    badgeRu: 'ПЕРСОНАЛЬНЫЙ КОНСАЛТИНГ & КОД-РЕВЬЮ',
    badgeEn: 'EXPERT CONSULTING & CODE REVIEW',
    taglineRu: 'Архитектурный аудит систем, консультации юристов и менторство с передачей артефактов.',
    taglineEn: 'System architecture audit, legal counsel, and engineering mentorship in secure rooms.',
    descriptionRu: 'Встречи фаундеров и инженеров с проверенными экспертами с NDA и защищённой передачей кода и документов.',
    descriptionEn: 'Direct advisory sessions with senior architects and lawyers with signed NDA and file handovers.',
    accentColor: '#4f46e5',
    borderAccent: 'border-indigo-600/40',
    bgTint: 'bg-indigo-600/5',
    primaryCategories: ['jobs', 'services'],
    quickChips: [
      { labelRu: '🔍 Аудит смарт-контрактов', labelEn: '🔍 Smart Contract Audit', query: 'смарт-контракт' },
      { labelRu: '🏛️ Архитектура Go / Rust', labelEn: '🏛️ Go / Rust Architecture', query: 'архитектур' },
      { labelRu: '⚖️ AI-патентное право (ОАЭ/US)', labelEn: '⚖️ AI Patent Counsel', query: 'юрист' },
      { labelRu: '🚀 Подготовка к Y Combinator', labelEn: '🚀 Y Combinator Prep', query: 'YC' },
      { labelRu: '🧠 Файн-тюнинг Llama 3', labelEn: '🧠 Llama 3 Fine-tuning', query: 'fine-tuning' },
    ],
    publishPreset: {
      defaultCategory: 'services',
      titleHintRu: 'Например: Аудит архитектуры распределённой БД на 100k RPS или Консультация по патентованию AI',
      titleHintEn: 'e.g.: Distributed DB architecture review for 100k RPS or AI Patent Strategy advisory',
      descHintRu: 'Опишите задачу, текущий технологический стек, релевантный опыт и желаемый формат сессии...',
      descHintEn: 'Describe consulting scope, tech stack, deliverables, and preferred session format...',
    },
    specialFeature: {
      type: 'mentoring',
      labelRu: 'NDA и артефакты',
      labelEn: 'NDA & Artifact Handover',
      infoRu: 'Защищённая комната с автоматическим NDA и фиксацией итогового отчета/кода в реестре комнаты.',
      infoEn: 'Encrypted room with built-in NDA and signed handover of audit reports and source code.',
    },
  },

  barter: {
    id: 'barter',
    nameRu: 'Бартер & Сообщества',
    nameEn: 'Community Barter & Aid',
    emoji: '🤝',
    badgeRu: 'ГИПЕРЛОКАЛЬНЫЙ ШЕРИНГ · ВЗАИМОПОМОЩЬ',
    badgeEn: 'HYPERLOCAL MUTUAL AID & BARTER',
    taglineRu: 'Обмен книгами, вещами, детскими товарами и соседская взаимопомощь без денег.',
    taglineEn: 'Book exchange, clothing swap, children goods barter, and neighbor mutual aid.',
    descriptionRu: 'Бескорыстная взаимопомощь и прямой бартер внутри жилых комплексов, районов и открытых сообществ.',
    descriptionEn: 'Cashless community sharing and direct bartering inside neighborhoods and open squads.',
    accentColor: '#15803d',
    borderAccent: 'border-green-600/40',
    bgTint: 'bg-green-600/5',
    primaryCategories: ['communities', 'things'],
    quickChips: [
      { labelRu: '🎁 Отдам даром', labelEn: '🎁 Free / Giveaway', query: 'даром' },
      { labelRu: '📚 Обмен книгами (BookSwap)', labelEn: '📚 Book Swap', query: 'книг' },
      { labelRu: '👶 Детские товары & Коляски', labelEn: '👶 Kids & Strollers', query: 'детск' },
      { labelRu: '🌱 Растения и саженцы', labelEn: '🌱 Plants & Seeds', query: 'растения' },
      { labelRu: '🛠️ Соседская взаимовыручка', labelEn: '🛠️ Neighborly Help', query: 'помощь' },
    ],
    publishPreset: {
      defaultCategory: 'communities',
      titleHintRu: 'Например: Отдам даром собрание книг по искусству или Обменяю детское автокресло на самокат',
      titleHintEn: 'e.g.: Giving away art book collection for free or Bartering stroller for scooter',
      descHintRu: 'Укажите район/ЖК, состояние предмета, на что хотите обменяться или кому готовы передать...',
      descHintEn: 'Indicate neighborhood/district, item condition, and what you would like to swap for...',
    },
    specialFeature: {
      type: 'barter',
      labelRu: 'Безденежный бартер',
      labelEn: 'Cashless Barter',
      infoRu: 'Прямой обмен ценностями без комиссии платформы и фиксация места безопасной встречи в ЖК.',
      infoEn: 'Pure peer-to-peer barter with zero transaction fees and safe neighborhood meeting spots.',
    },
  },

  m2m_agents: {
    id: 'm2m_agents',
    nameRu: 'M2M Агентное Облако',
    nameEn: 'M2M Agent Cloud',
    emoji: '🤖',
    badgeRu: 'МАШИННАЯ КОММЕРЦИЯ · PURE AGENTIC',
    badgeEn: 'MACHINE COMMERCE · PURE AGENTIC',
    taglineRu: 'Прямая торговля API-квотами, синтетическими данными и веб-парсингом между ботами.',
    taglineEn: 'Direct trade of API credits, synthetic datasets, and web scraping between bots.',
    descriptionRu: 'Автономные AI-агенты торгуются друг с другом в JSON-RPC комнатах без участия человека.',
    descriptionEn: 'Autonomous AI agents transacting directly via JSON-RPC rooms without human intervention.',
    accentColor: '#0891b2',
    borderAccent: 'border-cyan-600/40',
    bgTint: 'bg-cyan-600/5',
    primaryCategories: ['business', 'services', 'other'],
    quickChips: [
      { labelRu: '⚡ DeepSeek R1 API Квоты', labelEn: '⚡ DeepSeek R1 Quota', query: 'DeepSeek' },
      { labelRu: '📊 Синтетический датасет 50k', labelEn: '📊 Synthetic Dataset', query: 'датасет' },
      { labelRu: '🌐 Поток веб-скрапинга (JSON)', labelEn: '🌐 Scraping Stream', query: 'парсинг' },
      { labelRu: '🔍 MCP Tool Brokerage', labelEn: '🔍 MCP Tool Broker', query: 'MCP' },
      { labelRu: '🤖 Multi-Agent Swarm Job', labelEn: '🤖 Swarm Task', query: 'агент' },
    ],
    publishPreset: {
      defaultCategory: 'business',
      titleHintRu: 'Например: Поток парсинга авиабилетов 50 направлений в JSON или 10M токенов DeepSeek V3 API',
      titleHintEn: 'e.g.: Real-time JSON flight scraping stream or 10M DeepSeek V3 API token quota',
      descHintRu: 'Укажите JSON-схему данных, контрольные суммы, протокол доставки (Webhook/SSE) и RPS...',
      descHintEn: 'Specify JSON Schema, hash checksums, delivery protocol (Webhook/SSE), and RPS limits...',
    },
    specialFeature: {
      type: 'm2m_agents',
      labelRu: 'Zero-Human Consensus',
      labelEn: 'Zero-Human Consensus',
      infoRu: 'Мгновенное автоматическое согласование JSON-схем и контрольных сумм алгоритмическими агентами.',
      infoEn: 'Instant automated schema negotiation and checksum verification by algorithmic agents.',
    },
  },
};

export const ALL_FACES: FaceConfig[] = Object.values(FACES_REGISTRY);

export function getFaceConfig(id: FaceId | string | null | undefined): FaceConfig {
  if (id && id in FACES_REGISTRY) {
    return FACES_REGISTRY[id as FaceId];
  }
  return FACES_REGISTRY.general;
}

export function getStoredFace(): FaceId {
  if (typeof window === 'undefined') return 'general';
  try {
    const val = localStorage.getItem('mcp_rooms_face') as FaceId;
    if (val && val in FACES_REGISTRY) {
      return val;
    }
  } catch {
    // ignore
  }
  return 'general';
}

export function setStoredFace(face: FaceId): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('mcp_rooms_face', face);
  } catch {
    // ignore
  }
}

export function getFaceFromUrl(): FaceId | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const paramFace = params.get('face') || params.get('theme') || params.get('niche');
    if (paramFace && paramFace in FACES_REGISTRY) {
      return paramFace as FaceId;
    }
  } catch {
    // ignore
  }
  return null;
}
