import DatabaseModule from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const Database = (DatabaseModule as any).default || DatabaseModule;

// Ensure data directory exists for persistent SQLite database on disk
const defaultDataDir = path.resolve(process.cwd(), 'data');
const dbPath = process.env.DATABASE_PATH || path.join(defaultDataDir, 'mcp_rooms.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(dbPath);

// Enable WAL mode for high performance and concurrency
db.pragma('journal_mode = WAL');

// Enforce the foreign keys declared in the schema (messages -> rooms,
// listings -> listings, negotiations -> rooms). SQLite leaves them off by
// default, which used to let orphan rows in silently.
db.pragma('foreign_keys = ON');

// Initialize database schema
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      author_name TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      subcategory TEXT,
      kind TEXT NOT NULL, -- 'offer' or 'request'
      modes TEXT NOT NULL, -- JSON array of ['pickup', 'shipping', 'online']
      locality TEXT NOT NULL,
      region TEXT,
      country TEXT,
      price_minor INTEGER, -- null for negotiable, otherwise minor currency unit (e.g. kopecks)
      currency TEXT NOT NULL DEFAULT 'RUB',
      condition TEXT,
      status TEXT NOT NULL DEFAULT 'active', -- 'draft', 'active', 'paused', 'fulfilled', 'archived'
      visibility TEXT NOT NULL DEFAULT 'public',
      revision INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      photos_json TEXT NOT NULL DEFAULT '[]',
      responses_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      listing_id TEXT,
      listing_title TEXT,
      participants_json TEXT NOT NULL, -- JSON array of principal strings
      status TEXT NOT NULL DEFAULT 'active', -- 'active' or 'closed'
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(listing_id) REFERENCES listings(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      sender TEXT NOT NULL,
      role TEXT NOT NULL, -- 'human', 'agent', 'system'
      text TEXT NOT NULL,
      tool_call_json TEXT,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL, -- 'individual' or 'company'
      name TEXT NOT NULL,
      headline TEXT,
      bio TEXT,
      avatar_url TEXT,
      locality TEXT,
      verified INTEGER NOT NULL DEFAULT 0,
      reputation_score REAL NOT NULL DEFAULT 5.0,
      contact_protocols TEXT NOT NULL DEFAULT '["mcp_room"]',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS listing_embeddings (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL,
      kind TEXT NOT NULL, -- 'request' or 'offer'
      provider TEXT NOT NULL, -- 'google' or 'fallback'
      model TEXT NOT NULL,
      dimensions INTEGER NOT NULL,
      vector_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(listing_id) REFERENCES listings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      principal_id TEXT NOT NULL,
      name TEXT NOT NULL,
      digest TEXT NOT NULL UNIQUE, -- sha256 hex of the bearer token; the token itself is never stored
      scopes TEXT NOT NULL DEFAULT '*',
      created_at INTEGER NOT NULL,
      last_used_at INTEGER,
      revoked_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_api_keys_principal ON api_keys(principal_id);

    CREATE TABLE IF NOT EXISTS negotiations (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      listing_id TEXT,
      user_goal TEXT NOT NULL,
      initiator_agent TEXT NOT NULL,
      counterpart_agent TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'in_progress', -- 'in_progress', 'agreed', 'declined'
      rounds_json TEXT NOT NULL DEFAULT '[]',
      agreed_terms_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE
    );
    
    CREATE TABLE IF NOT EXISTS rate_limit_hits (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL,
      reset_at INTEGER NOT NULL
    );


    CREATE TABLE IF NOT EXISTS uploads (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      url TEXT NOT NULL,
      owner TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      resource_id TEXT,
      details_json TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_event ON audit_logs(event_type);

    CREATE TABLE IF NOT EXISTS room_events (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      seq INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_room_events_room_ts ON room_events(room_id, timestamp, seq);

  `);

  // Safe migration for existing listings table
  try {
    const listingColumns = db.prepare(`PRAGMA table_info(listings)`).all() as any[];
    const colNames = listingColumns.map((c) => c.name);
    if (!colNames.includes('profile_id')) {
      db.exec(`ALTER TABLE listings ADD COLUMN profile_id TEXT;`);
    }
    if (!colNames.includes('embedding_json')) {
      db.exec(`ALTER TABLE listings ADD COLUMN embedding_json TEXT;`);
    }
  } catch {
    // Column already exists or table freshly initialized
  }

  // Safe migration for api_keys table
  try {
    const keyColumns = db.prepare(`PRAGMA table_info(api_keys)`).all() as any[];
    const keyColNames = keyColumns.map((c) => c.name);
    if (!keyColNames.includes('scopes')) {
      db.exec(`ALTER TABLE api_keys ADD COLUMN scopes TEXT NOT NULL DEFAULT '*';`);
    }
  } catch {
    // Column already exists or table freshly initialized
  }

  if (demoSeedEnabled()) {
    seedProfilesIfEmpty();

    // Seed default data if database is empty
    const count = db.prepare('SELECT COUNT(*) as cnt FROM listings').get() as { cnt: number };
    if (count.cnt === 0) {
      seedInitialData();
    }
    // Real estate / communities were added later than the original seed set, so
    // they must be ensured on every init, not only when the table already has rows.
    ensureNewCategoriesSeeded();
  }
}

/**
 * F-11: the fictional catalogue and profiles are demo data. They must never
 * appear in a real database, so seeding is opt-in (`DEMO_SEED=1`, or
 * `npm run seed:demo`). A fresh deployment starts with an empty catalogue.
 */
export function demoSeedEnabled(): boolean {
  return process.env.DEMO_SEED === '1';
}

function ensureNewCategoriesSeeded() {
  try {
    const count = db.prepare(`SELECT COUNT(*) as cnt FROM listings WHERE category IN ('real_estate', 'communities')`).get() as { cnt: number };
    const realEstateCount = db.prepare(`SELECT COUNT(*) as cnt FROM listings WHERE category = 'real_estate'`).get() as { cnt: number };
    const communitiesCount = db.prepare(`SELECT COUNT(*) as cnt FROM listings WHERE category = 'communities'`).get() as { cnt: number };
    if (count.cnt === 0 || realEstateCount.cnt === 0 || communitiesCount.cnt === 0) {
      const insertListing = db.prepare(`
        INSERT OR IGNORE INTO listings (
          id, owner, author_name, title, description, category, subcategory,
          kind, modes, locality, region, country, price_minor, currency, condition,
          status, visibility, revision, created_at, updated_at, expires_at, photos_json, responses_count
        ) VALUES (
          @id, @owner, @author_name, @title, @description, @category, @subcategory,
          @kind, @modes, @locality, @region, @country, @price_minor, @currency, @condition,
          @status, @visibility, @revision, @created_at, @updated_at, @expires_at, @photos_json, @responses_count
        )
      `);

      const now = Date.now();
      const newItems = [
        {
          id: 'real-estate-office-kazan-01',
          owner: 'user:realty-manager',
          author_name: 'Центр Недвижимости «Баумана»',
          title: 'Аренда современного коворкинга / офиса для IT-команд в центре Казани',
          description:
            'Светлое пространство 120 м² в Вахитовском районе (ул. Профсоюзная). Опенспейс на 15–20 рабочих мест, изолированная переговорная комната, оптический интернет 500 Мбит/с, вентиляция и кондиционирование, зона отдыха и кофе-пойнт. Прямой договор с собственником, без скрытых агентских комиссий. Возможна аренда блоками.',
          category: 'real_estate',
          subcategory: 'Коммерческая недвижимость и офисы',
          kind: 'offer',
          modes: JSON.stringify(['pickup']),
          locality: 'Казань',
          region: 'Татарстан',
          country: 'Россия',
          price_minor: 9500000, // 95 000 ₽ / мес
          currency: 'RUB',
          condition: 'Полностью меблирован, готов к въезду',
          status: 'active',
          visibility: 'public',
          revision: 1,
          created_at: now - 3600000 * 20,
          updated_at: now - 3600000 * 2,
          expires_at: now + 3600000 * 24 * 60,
          photos_json: '[]',
          responses_count: 3,
        },
        {
          id: 'real-estate-roommate-kazan-02',
          owner: 'user:dev-renat',
          author_name: 'Ренат (Разработчик)',
          title: 'Ищу сожителя (roommate) в 3-комнатную квартиру у IT-парка Казани',
          description:
            'Сдам отдельную просторную комнату в 3-к квартире возле IT-парка им. Рамеева (ул. Петербургская). В квартире чистота, порядок, быстрый интернет, вся техника, посудомойка. Ищу адекватного соседа (без вечеринок и вредных привычек). Коммунальные поровну. Без комиссий риелторам.',
          category: 'real_estate',
          subcategory: 'Поиск сожителей и аренда комнат',
          kind: 'offer',
          modes: JSON.stringify(['pickup']),
          locality: 'Казань',
          region: 'Татарстан',
          country: 'Россия',
          price_minor: 1800000, // 18 000 ₽ / мес
          currency: 'RUB',
          condition: 'Изолированная комната, мебель, кровать King-size',
          status: 'active',
          visibility: 'public',
          revision: 1,
          created_at: now - 3600000 * 15,
          updated_at: now - 3600000 * 1,
          expires_at: now + 3600000 * 24 * 45,
          photos_json: '[]',
          responses_count: 2,
        },
        {
          id: 'communities-open-ai-kazan-01',
          owner: 'user:community-parliament',
          author_name: 'Парламент сообществ Казани',
          title: 'Парламент сообществ: формирование проектной команды открытого AI и агентных систем',
          description:
            'Инициатива по координации открытых проектов в сфере ИИ, MCP-агентов и децентрализованных систем. Собираем парламентскую коллегию представителей сообществ, инженеров, дизайнеров и исследователей. Еженедельные открытые координационные сессии, распределение грантов и задач на принципах меритократии и консенсуса.',
          category: 'communities',
          subcategory: 'Парламент сообществ и открытые команды',
          kind: 'offer',
          modes: JSON.stringify(['online', 'pickup']),
          locality: 'Казань',
          region: 'Татарстан',
          country: 'Россия',
          price_minor: null, // Открытое участие
          currency: 'RUB',
          condition: 'Горизонтальное самоуправление, открытый мандат',
          status: 'active',
          visibility: 'public',
          revision: 1,
          created_at: now - 3600000 * 25,
          updated_at: now - 3600000 * 3,
          expires_at: now + 3600000 * 24 * 90,
          photos_json: '[]',
          responses_count: 6,
        },
        {
          id: 'communities-eco-urban-02',
          owner: 'user:urban-initiative',
          author_name: 'Городской совет инициатив',
          title: 'Ищем единомышленников в команду проекта по развитию общественных пространств и набережных',
          description:
            'Формируем рабочую группу урбанистов, архитекторов и экологов. Цель — разработка концепций доступной городской среды, защита малых рек и взаимодействие с городским парламентом сообществ. Присоединяйтесь к рабочей группе!',
          category: 'communities',
          subcategory: 'Городские инициативы и рабочие группы',
          kind: 'request',
          modes: JSON.stringify(['online', 'pickup']),
          locality: 'Казань',
          region: 'Татарстан',
          country: 'Россия',
          price_minor: null,
          currency: 'RUB',
          condition: 'Совместная проектная деятельность',
          status: 'active',
          visibility: 'public',
          revision: 1,
          created_at: now - 3600000 * 18,
          updated_at: now - 3600000 * 2,
          expires_at: now + 3600000 * 24 * 60,
          photos_json: '[]',
          responses_count: 4,
        },
      ];

      for (const item of newItems) {
        insertListing.run(item);
      }
    }
  } catch (err) {
    console.error('Error ensuring new categories seeded:', err);
  }
}

function seedProfilesIfEmpty() {
  const profileCount = db.prepare('SELECT COUNT(*) as cnt FROM profiles').get() as { cnt: number };
  if (profileCount.cnt === 0) {
    const now = Date.now();
    const profiles = [
      {
        id: 'user:founder-alex',
        type: 'individual',
        name: 'Алексей Мельников',
        headline: 'AI Systems Architect & Фаундер',
        bio: '10 лет в IT, разрабатываю LLM-агентов и распределённые протоколы. Ищу коммерческого кофаундера для B2B платформы.',
        avatar_url: '',
        locality: 'Казань',
        verified: 1,
        reputation_score: 4.9,
        contact_protocols: JSON.stringify(['mcp_room', 'telegram']),
        created_at: now - 3600000 * 50,
      },
      {
        id: 'user:hr-lead-tech',
        type: 'company',
        name: 'TechFin Solutions',
        headline: 'Финтех-платформа нового поколения',
        bio: 'Создаем высоконагруженные финансовые решения. Стек: Node.js, TypeScript, Go, distributed microservices.',
        avatar_url: '',
        locality: 'Москва',
        verified: 1,
        reputation_score: 5.0,
        contact_protocols: JSON.stringify(['mcp_room']),
        created_at: now - 3600000 * 120,
      },
      {
        id: 'user:master-marat',
        type: 'individual',
        name: 'Марат Хабибуллин',
        headline: 'Мастер сантехники и комплексного ремонта',
        bio: 'Опыт более 12 лет. Профессиональный инструмент, договор, официальная гарантия 3 года. Бесплатный замер по Казани.',
        avatar_url: '',
        locality: 'Казань',
        verified: 1,
        reputation_score: 4.95,
        contact_protocols: JSON.stringify(['mcp_room']),
        created_at: now - 3600000 * 90,
      },
      {
        id: 'user:daria-nature',
        type: 'individual',
        name: 'Дарья Лебедева',
        headline: 'Организатор походов и веловыездов',
        bio: 'Люблю горы, Волгу и настольные игры. Безопасность и открытое общение. Организую велопрогулки и треккинг.',
        avatar_url: '',
        locality: 'Казань',
        verified: 1,
        reputation_score: 4.9,
        contact_protocols: JSON.stringify(['mcp_room']),
        created_at: now - 3600000 * 60,
      },
      {
        id: 'user:kazan-cyclist',
        type: 'individual',
        name: 'Ильдар Сафиуллин',
        headline: 'Велоэнтузиаст и триатлет',
        bio: 'Бережно отношусь к технике. Велосипед обслуживался перед каждым сезоном.',
        avatar_url: '',
        locality: 'Казань',
        verified: 1,
        reputation_score: 4.85,
        contact_protocols: JSON.stringify(['mcp_room']),
        created_at: now - 3600000 * 40,
      },
      {
        id: 'user:timur-driver',
        type: 'individual',
        name: 'Тимур Валиев',
        headline: 'Водитель с комфортным кроссовером',
        bio: 'Стаж вождения 9 лет, аккуратная езда, чистый салон, кондиционер.',
        avatar_url: '',
        locality: 'Казань',
        verified: 1,
        reputation_score: 4.9,
        contact_protocols: JSON.stringify(['mcp_room']),
        created_at: now - 3600000 * 25,
      },
      {
        id: 'user:courier-express',
        type: 'company',
        name: 'Экспресс Доставка Татарстан',
        headline: 'Срочная курьерская служба',
        bio: 'Быстрая доставка документов, посылок и малогабаритных грузов по Казани за 60-90 минут.',
        avatar_url: '',
        locality: 'Казань',
        verified: 1,
        reputation_score: 4.75,
        contact_protocols: JSON.stringify(['mcp_room']),
        created_at: now - 3600000 * 15,
      },
      {
        id: 'user:buyer-77',
        type: 'individual',
        name: 'Константин Смирнов',
        headline: 'Пользователь MCP ROOMS',
        bio: 'Поиск товаров, услуг и партнерств через персонального Агента-Ангела.',
        avatar_url: '',
        locality: 'Казань',
        verified: 0,
        reputation_score: 5.0,
        contact_protocols: JSON.stringify(['mcp_room']),
        created_at: now - 3600000 * 10,
      },
    ];

    const insertP = db.prepare(`
      INSERT INTO profiles (
        id, type, name, headline, bio, avatar_url, locality, verified, reputation_score, contact_protocols, created_at
      ) VALUES (
        @id, @type, @name, @headline, @bio, @avatar_url, @locality, @verified, @reputation_score, @contact_protocols, @created_at
      )
    `);

    for (const p of profiles) {
      insertP.run(p);
    }
  }
}

function seedInitialData() {
  const insertListing = db.prepare(`
    INSERT INTO listings (
      id, owner, author_name, title, description, category, subcategory,
      kind, modes, locality, region, country, price_minor, currency, condition,
      status, visibility, revision, created_at, updated_at, expires_at, photos_json, responses_count
    ) VALUES (
      @id, @owner, @author_name, @title, @description, @category, @subcategory,
      @kind, @modes, @locality, @region, @country, @price_minor, @currency, @condition,
      @status, @visibility, @revision, @created_at, @updated_at, @expires_at, @photos_json, @responses_count
    )
  `);

  const now = Date.now();

  const seedItems = [
    // 1. Business / Партнёрство
    {
      id: 'biz-partner-ai-01',
      owner: 'user:founder-alex',
      author_name: 'Алексей (Технический фаундер)',
      title: 'Ищу кофаундера / бизнес-партнёра в B2B AI-стартап (MCP & автоматизация)',
      description:
        'Разрабатываем платформу интеграции локальных LLM-агентов с CRM и складскими базами данных. Продукт на стадии работающего MVP с первыми 3 платными пилотами. Ищу сильного коммерческого партнёра (маркетинг, продажи B2B, привлечение pre-seed раунда). Доля в компании обсуждается на переговорах.',
      category: 'business',
      subcategory: 'Партнёрство и стартапы',
      kind: 'offer',
      modes: JSON.stringify(['online']),
      locality: 'Казань',
      region: 'Татарстан',
      country: 'Россия',
      price_minor: null, // Договорная (Equity)
      currency: 'RUB',
      condition: 'Стадия MVP с подтверждённым спросом',
      status: 'active',
      visibility: 'public',
      revision: 1,
      created_at: now - 3600000 * 48,
      updated_at: now - 3600000 * 10,
      expires_at: now + 3600000 * 24 * 90,
      photos_json: '[]',
      responses_count: 3,
    },
    // 2. Jobs / Вакансии
    {
      id: 'job-dev-senior-02',
      owner: 'user:hr-lead-tech',
      author_name: 'TechFin Solutions',
      title: 'Senior TypeScript / Node.js Backend Engineer (MCP & AI Agents)',
      description:
        'Ищем ведущего бэкенд-инженера для масштабирования высоконагруженного шлюза агентных протоколов. Стек: Node.js 22, TypeScript, SQLite/PostgreSQL, Docker, WebSocket. Удалённый формат работы или гибрид в Казани/Москве. Белая зарплата 280 000 – 350 000 ₽ на руки, ДМС и техника.',
      category: 'jobs',
      subcategory: 'IT и разработка',
      kind: 'offer',
      modes: JSON.stringify(['online', 'pickup']),
      locality: 'Казань',
      region: 'Татарстан',
      country: 'Россия',
      price_minor: 32000000, // 320 000 ₽
      currency: 'RUB',
      condition: 'Full-time, удалённо или офис',
      status: 'active',
      visibility: 'public',
      revision: 1,
      created_at: now - 3600000 * 30,
      updated_at: now - 3600000 * 4,
      expires_at: now + 3600000 * 24 * 60,
      photos_json: '[]',
      responses_count: 5,
    },
    // 3. Services / Ремонт и услуги
    {
      id: 'service-plumbing-bath-03',
      owner: 'user:master-marat',
      author_name: 'Марат (Мастер сантехники)',
      title: 'Комплексный ремонт санузлов, замена сантехники и труб под ключ',
      description:
        'Опыт работы 12 лет. Выполняю монтаж коллекторных разводок Rehau/Stout, установку инсталляций, ванн, душевых трапов и чистовой сантехники. Договор, гарантия 3 года. Смета фиксируется до начала работ. Выезд на замер по Казани бесплатный при согласовании заказа.',
      category: 'services',
      subcategory: 'Ремонт и отделка',
      kind: 'offer',
      modes: JSON.stringify(['pickup']),
      locality: 'Казань',
      region: 'Татарстан',
      country: 'Россия',
      price_minor: 3500000, // 35 000 ₽
      currency: 'RUB',
      condition: 'Профессиональное оборудование, договор и гарантия',
      status: 'active',
      visibility: 'public',
      revision: 1,
      created_at: now - 3600000 * 20,
      updated_at: now - 3600000 * 2,
      expires_at: now + 3600000 * 24 * 75,
      photos_json: '[]',
      responses_count: 2,
    },
    // 4. Dating / Знакомства и общение
    {
      id: 'dating-hike-kazan-04',
      owner: 'user:daria-nature',
      author_name: 'Дарья (26 лет)',
      title: 'Ищу компанию для походов в горы, велопрогулок по Волге и настольных игр',
      description:
        'Привет! Люблю активный отдых на природе, походы с палатками по Камскому Устью и Марий Эл, велозаезды по выходным и уютные вечера за настолками. Ищу близких по духу людей для совместных выездов и душевного общения. Не люблю пустые переписки — за реальные встречи и совместные активности!',
      category: 'dating',
      subcategory: 'Спорт и активный отдых',
      kind: 'offer',
      modes: JSON.stringify(['pickup', 'online']),
      locality: 'Казань',
      region: 'Татарстан',
      country: 'Россия',
      price_minor: null, // Бесплатно / совместные расходы
      currency: 'RUB',
      condition: 'Дружба, общение и совместные хобби',
      status: 'active',
      visibility: 'public',
      revision: 1,
      created_at: now - 3600000 * 18,
      updated_at: now - 3600000 * 1,
      expires_at: now + 3600000 * 24 * 40,
      photos_json: '[]',
      responses_count: 4,
    },
    // 5. Things / Товары
    {
      id: 'bike-kazan-demo-01',
      owner: 'user:kazan-cyclist',
      author_name: 'Будущий автор объявления',
      title: 'Городской велосипед, размер M',
      description:
        'Пример оформления объявления. Городской велосипед для повседневных поездок. Здесь продавец расскажет о состоянии, комплектации и причинах продажи. Рама алюминиевая, 7 скоростей Shimano Nexus, планетарная втулка, полноразмерные крылья и багажник.',
      category: 'things',
      subcategory: 'Велосипеды',
      kind: 'offer',
      modes: JSON.stringify(['pickup', 'shipping']),
      locality: 'Казань',
      region: 'Татарстан',
      country: 'Россия',
      price_minor: 2800000, // 28 000 ₽
      currency: 'RUB',
      condition: 'Хорошее, бережная эксплуатация',
      status: 'active',
      visibility: 'public',
      revision: 1,
      created_at: now - 3600000 * 24 * 2,
      updated_at: now - 3600000 * 2,
      expires_at: now + 3600000 * 24 * 88,
      photos_json: '[]',
      responses_count: 2,
    },
    // 6. Rides / Поездки
    {
      id: 'ride-kazan-chelny-05',
      owner: 'user:driver-artur',
      author_name: 'Артур К.',
      title: 'Поездка Казань → Набережные Челны (3 свободных места)',
      description:
        'Выезжаю в пятницу в 18:30 от метро Проспект Победы. Чистый салон, кондиционер, просторный багажник. Перевезу попутчиков или небольшие посылки.',
      category: 'rides',
      subcategory: 'Межгород',
      kind: 'offer',
      modes: JSON.stringify(['pickup']),
      locality: 'Казань',
      region: 'Татарстан',
      country: 'Россия',
      price_minor: 75000, // 750 ₽
      currency: 'RUB',
      condition: 'Комфорт-класс',
      status: 'active',
      visibility: 'public',
      revision: 1,
      created_at: now - 3600000 * 14,
      updated_at: now - 3600000 * 4,
      expires_at: now + 3600000 * 24 * 10,
      photos_json: '[]',
      responses_count: 2,
    },
    // 7. Delivery / Доставка
    {
      id: 'delivery-express-06',
      owner: 'user:fast-courier',
      author_name: 'Служба бережной доставки',
      title: 'Срочная доставка документов и малогабаритных грузов по городу',
      description:
        'Быстрая доставка от двери до двери. Фотоотчёт о вручении, аккуратное обращение с хрупкими вещами. Оплата по факту вручения адресату.',
      category: 'delivery',
      subcategory: 'Курьеры',
      kind: 'offer',
      modes: JSON.stringify(['pickup', 'shipping']),
      locality: 'Казань',
      region: 'Татарстан',
      country: 'Россия',
      price_minor: 50000, // 500 ₽
      currency: 'RUB',
      condition: 'Срочно в день заказа',
      status: 'active',
      visibility: 'public',
      revision: 1,
      created_at: now - 3600000 * 6,
      updated_at: now - 3600000 * 1,
      expires_at: now + 3600000 * 24 * 45,
      photos_json: '[]',
      responses_count: 1,
    },
  ];

  const insertMany = db.transaction((items: any[]) => {
    for (const item of items) insertListing.run(item);
  });
  insertMany(seedItems);

  // Seed sample rooms and messages
  const insertRoom = db.prepare(`
    INSERT INTO rooms (id, listing_id, listing_title, participants_json, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertRoom.run(
    'room-bike-negotiation-01',
    'bike-kazan-demo-01',
    'Городской велосипед, размер M',
    JSON.stringify(['user:buyer-77', 'user:kazan-cyclist', 'agent:mcp-angel']),
    'active',
    now - 3600000 * 5,
    now - 3600000 * 1
  );

  const insertMessage = db.prepare(`
    INSERT INTO messages (id, room_id, sender, role, text, tool_call_json, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertMessage.run(
    'msg-1',
    'room-bike-negotiation-01',
    'user:buyer-77',
    'human',
    'Здравствуйте! Подскажите, какой точный вес у велосипеда и проводилось ли ТО в этом сезоне?',
    null,
    now - 3600000 * 5
  );
  insertMessage.run(
    'msg-2',
    'room-bike-negotiation-01',
    'user:kazan-cyclist',
    'human',
    'Добрый день! Вес около 13.8 кг, в начале сезона смазали цепь и настроили планетарную втулку. Готов показать возле парка Горького.',
    null,
    now - 3600000 * 3
  );
  insertMessage.run(
    'msg-3',
    'room-bike-negotiation-01',
    'agent:mcp-angel',
    'agent',
    'Агент-Ангел: Проверил параметры объявления. Самовывоз в Казани подтверждён обеими сторонами. Напоминаю: безопасная встреча в публичном месте рекомендуется правилами площадки.',
    null,
    now - 3600000 * 2
  );
}

// Database helper functions
export function getListingsFromDb(filters: {
  category?: string;
  kind?: string;
  locality?: string;
  query?: string;
}) {
  let sql = "SELECT * FROM listings WHERE status = 'active'";
  const params: any[] = [];

  if (filters.category && filters.category !== 'all') {
    sql += ' AND category = ?';
    params.push(filters.category);
  }
  if (filters.kind && filters.kind !== 'all') {
    sql += ' AND kind = ?';
    params.push(filters.kind);
  }
  if (filters.locality && filters.locality !== 'all') {
    sql += ' AND LOWER(locality) LIKE ?';
    params.push(`%${filters.locality.toLowerCase()}%`);
  }
  if (filters.query && filters.query.trim()) {
    const q = `%${filters.query.toLowerCase().trim()}%`;
    sql += ' AND (LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(subcategory) LIKE ?)';
    params.push(q, q, q);
  }

  sql += ' ORDER BY created_at DESC';
  const rows = db.prepare(sql).all(...params) as any[];

  return rows.map(formatListingRow);
}

export function getListingByIdFromDb(id: string) {
  const row = db.prepare('SELECT * FROM listings WHERE id = ?').get(id) as any;
  return row ? formatListingRow(row) : null;
}

export function createListingInDb(listing: any) {
  const stmt = db.prepare(`
    INSERT INTO listings (
      id, owner, author_name, title, description, category, subcategory,
      kind, modes, locality, region, country, price_minor, currency, condition,
      status, visibility, revision, created_at, updated_at, expires_at, photos_json, responses_count
    ) VALUES (
      @id, @owner, @author_name, @title, @description, @category, @subcategory,
      @kind, @modes, @locality, @region, @country, @price_minor, @currency, @condition,
      @status, @visibility, @revision, @created_at, @updated_at, @expires_at, @photos_json, @responses_count
    )
  `);

  const modesStr = Array.isArray(listing.content.modes)
    ? JSON.stringify(listing.content.modes)
    : listing.content.modes;

  const photosStr = Array.isArray(listing.photos)
    ? JSON.stringify(listing.photos)
    : '[]';

  stmt.run({
    id: listing.id,
    owner: listing.owner,
    author_name: listing.author_name,
    title: listing.content.title,
    description: listing.content.description,
    category: listing.content.category,
    subcategory: listing.content.subcategory || null,
    kind: listing.content.kind,
    modes: modesStr,
    locality: listing.content.locality,
    region: listing.content.region || null,
    country: listing.content.country || null,
    price_minor: listing.content.price_minor,
    currency: listing.content.currency || 'RUB',
    condition: listing.content.condition || null,
    status: listing.status || 'draft',
    visibility: listing.visibility || 'private',
    revision: listing.revision || 1,
    created_at: listing.created_at || Date.now(),
    updated_at: listing.updated_at || Date.now(),
    expires_at: listing.expires_at || Date.now() + 3600000 * 24 * 90,
    photos_json: photosStr,
    responses_count: listing.responses_count || 0,
  });

  return getListingByIdFromDb(listing.id);
}

export function updateListingInDb(id: string, updates: any, owner: string) {
  const existing = getListingByIdFromDb(id);
  if (!existing) return null;
  if (existing.owner !== owner) return null;

  const now = Date.now();
  const title = updates.title || updates.content?.title || existing.content.title;
  const description = updates.description || updates.content?.description || existing.content.description;
  const category = updates.category || updates.content?.category || existing.content.category;
  const locality = updates.locality || updates.content?.locality || existing.content.locality;

  let price_minor = existing.content.price_minor;
  if (typeof updates.price_rubles === 'number') {
    price_minor = updates.price_rubles > 0 ? Math.floor(updates.price_rubles * 100) : null;
  } else if (typeof updates.content?.price_minor === 'number') {
    price_minor = updates.content.price_minor;
  }

  db.prepare(`
    UPDATE listings
    SET title = ?, description = ?, category = ?, locality = ?, price_minor = ?, revision = revision + 1, updated_at = ?
    WHERE id = ? AND owner = ?
  `).run(title, description, category, locality, price_minor, now, id, owner);

  return getListingByIdFromDb(id);
}

export function publishListingInDb(id: string, owner: string, expectedRevision: number) {
  const now = Date.now();
  const res = db.prepare(`
    UPDATE listings
    SET status = 'active', visibility = 'public', revision = revision + 1, updated_at = ?
    WHERE id = ? AND owner = ? AND revision = ?
  `).run(now, id, owner, expectedRevision);

  if (res.changes === 0) {
    const existing = getListingByIdFromDb(id);
    if (!existing) return { success: false, reason: 'not_found' };
    if (existing.owner !== owner) return { success: false, reason: 'forbidden' };
    if (existing.revision !== expectedRevision) return { success: false, reason: 'revision_mismatch', currentRevision: existing.revision };
    return { success: false, reason: 'unknown' };
  }

  return { success: true, listing: getListingByIdFromDb(id) };
}

export function withdrawListingInDb(id: string, owner: string) {
  const now = Date.now();
  const res = db.prepare(`
    UPDATE listings
    SET status = 'archived', visibility = 'private', revision = revision + 1, updated_at = ?
    WHERE id = ? AND owner = ?
  `).run(now, id, owner);

  if (res.changes === 0) {
    const existing = getListingByIdFromDb(id);
    if (!existing) return { success: false, reason: 'not_found' };
    if (existing.owner !== owner) return { success: false, reason: 'forbidden' };
    return { success: false, reason: 'unknown' };
  }

  return { success: true, listing: getListingByIdFromDb(id) };
}

export function getRoomsFromDb() {
  const rooms = db.prepare('SELECT * FROM rooms ORDER BY updated_at DESC').all() as any[];
  return rooms.map((r) => {
    const messages = db
      .prepare('SELECT * FROM messages WHERE room_id = ? ORDER BY timestamp ASC')
      .all(r.id) as any[];

    return {
      id: r.id,
      listingId: r.listing_id,
      listingTitle: r.listing_title,
      participants: JSON.parse(r.participants_json || '[]'),
      status: r.status,
      created_at: r.created_at,
      updated_at: r.updated_at,
      messages: messages.map((m) => ({
        id: m.id,
        roomId: m.room_id,
        sender: m.sender,
        role: m.role,
        text: m.text,
        toolCall: m.tool_call_json ? JSON.parse(m.tool_call_json) : undefined,
        timestamp: m.timestamp,
      })),
    };
  });
}

export function getRoomByIdFromDb(id: string) {
  const r = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id) as any;
  if (!r) return null;

  const messages = db
    .prepare('SELECT * FROM messages WHERE room_id = ? ORDER BY timestamp ASC')
    .all(r.id) as any[];

  return {
    id: r.id,
    listingId: r.listing_id,
    listingTitle: r.listing_title,
    participants: JSON.parse(r.participants_json || '[]'),
    status: r.status,
    created_at: r.created_at,
    updated_at: r.updated_at,
    messages: messages.map((m) => ({
      id: m.id,
      roomId: m.room_id,
      sender: m.sender,
      role: m.role,
      text: m.text,
      toolCall: m.tool_call_json ? JSON.parse(m.tool_call_json) : undefined,
      timestamp: m.timestamp,
    })),
  };
}

export function createRoomInDb(room: {
  id: string;
  listingId?: string;
  listingTitle?: string;
  participants: string[];
}) {
  const existing = getRoomByIdFromDb(room.id);
  if (existing) {
    return existing;
  }
  const now = Date.now();
  db.prepare(`
    INSERT INTO rooms (id, listing_id, listing_title, participants_json, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'active', ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      listing_id = COALESCE(excluded.listing_id, rooms.listing_id),
      listing_title = COALESCE(excluded.listing_title, rooms.listing_title),
      updated_at = excluded.updated_at
  `).run(
    room.id,
    room.listingId || null,
    room.listingTitle || null,
    JSON.stringify(room.participants),
    now,
    now
  );
  return getRoomByIdFromDb(room.id);
}

export type MessageInsertFailure = 'room_not_found' | 'duplicate_message_id';

/**
 * Maps a SQLite constraint error to a caller-facing reason. Anything else
 * returns null and must be surfaced as a real error, never swallowed.
 */
export function classifyMessageInsertError(err: unknown): MessageInsertFailure | null {
  const code = (err as { code?: string } | null)?.code;
  if (code === 'SQLITE_CONSTRAINT_FOREIGNKEY') return 'room_not_found';
  if (code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return 'duplicate_message_id';
  }
  return null;
}

/**
 * Inserts a message and bumps the room timestamp in one transaction.
 * Throws on a missing room or a duplicate message id — `INSERT OR IGNORE`
 * used to hide both, so a write into a non-existent room looked successful.
 */
export function addMessageToRoomInDb(message: {
  id: string;
  roomId: string;
  sender: string;
  role: string;
  text: string;
  toolCall?: any;
  timestamp?: number;
}) {
  const now = message.timestamp || Date.now();
  const write = db.transaction(() => {
    db.prepare(`
      INSERT INTO messages (id, room_id, sender, role, text, tool_call_json, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      message.id,
      message.roomId,
      message.sender,
      message.role,
      message.text,
      message.toolCall ? JSON.stringify(message.toolCall) : null,
      now
    );

    db.prepare('UPDATE rooms SET updated_at = ? WHERE id = ?').run(now, message.roomId);
  });

  write();
}

export function saveNegotiationInDb(negotiation: {
  id: string;
  roomId: string;
  listingId?: string;
  userGoal: string;
  initiatorAgent: string;
  counterpartAgent: string;
  status: string;
  rounds: any[];
  agreedTerms?: any;
}) {
  const now = Date.now();
  db.prepare(`
    INSERT OR REPLACE INTO negotiations (
      id, room_id, listing_id, user_goal, initiator_agent, counterpart_agent,
      status, rounds_json, agreed_terms_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    negotiation.id,
    negotiation.roomId,
    negotiation.listingId || null,
    negotiation.userGoal,
    negotiation.initiatorAgent,
    negotiation.counterpartAgent,
    negotiation.status,
    JSON.stringify(negotiation.rounds),
    negotiation.agreedTerms ? JSON.stringify(negotiation.agreedTerms) : null,
    now,
    now
  );
}

export function getNegotiationsFromDb() {
  const rows = db.prepare('SELECT * FROM negotiations ORDER BY updated_at DESC').all() as any[];
  return rows.map((r) => ({
    id: r.id,
    roomId: r.room_id,
    listingId: r.listing_id,
    userGoal: r.user_goal,
    initiatorAgent: r.initiator_agent,
    counterpartAgent: r.counterpart_agent,
    status: r.status,
    rounds: JSON.parse(r.rounds_json || '[]'),
    agreedTerms: r.agreed_terms_json ? JSON.parse(r.agreed_terms_json) : null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

export function getProfilesFromDb() {
  const rows = db.prepare('SELECT * FROM profiles ORDER BY reputation_score DESC, created_at DESC').all() as any[];
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    name: r.name,
    headline: r.headline || undefined,
    bio: r.bio || undefined,
    avatar_url: r.avatar_url || undefined,
    locality: r.locality || undefined,
    verified: Boolean(r.verified),
    reputation_score: r.reputation_score,
    contact_protocols: JSON.parse(r.contact_protocols || '["mcp_room"]'),
    created_at: r.created_at,
  }));
}

export function getProfileByIdFromDb(id: string) {
  if (!id) return null;
  const r = db.prepare('SELECT * FROM profiles WHERE id = ?').get(id) as any;
  if (!r) return null;
  return {
    id: r.id,
    type: r.type,
    name: r.name,
    headline: r.headline || undefined,
    bio: r.bio || undefined,
    avatar_url: r.avatar_url || undefined,
    locality: r.locality || undefined,
    verified: Boolean(r.verified),
    reputation_score: r.reputation_score,
    contact_protocols: JSON.parse(r.contact_protocols || '["mcp_room"]'),
    created_at: r.created_at,
  };
}

export function createProfileInDb(profile: {
  id: string;
  type: 'individual' | 'company';
  name: string;
  headline?: string;
  bio?: string;
  avatar_url?: string;
  locality?: string;
  verified?: boolean;
  reputation_score?: number;
  contact_protocols?: string[];
}) {
  const now = Date.now();
  db.prepare(`
    INSERT OR REPLACE INTO profiles (
      id, type, name, headline, bio, avatar_url, locality, verified, reputation_score, contact_protocols, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    profile.id,
    profile.type,
    profile.name,
    profile.headline || null,
    profile.bio || null,
    profile.avatar_url || null,
    profile.locality || null,
    profile.verified ? 1 : 0,
    profile.reputation_score ?? 5.0,
    JSON.stringify(profile.contact_protocols || ['mcp_room']),
    now
  );
  return getProfileByIdFromDb(profile.id);
}

export function saveListingEmbeddingInDb(data: {
  id: string;
  listing_id: string;
  kind: 'request' | 'offer';
  provider: string;
  model: string;
  dimensions: number;
  vector: number[];
}) {
  const now = Date.now();
  const vectorJson = JSON.stringify(data.vector);

  db.prepare(`
    INSERT OR REPLACE INTO listing_embeddings (
      id, listing_id, kind, provider, model, dimensions, vector_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.id,
    data.listing_id,
    data.kind,
    data.provider,
    data.model,
    data.dimensions,
    vectorJson,
    now
  );

  // Also cache directly in listings table for quick retrieval
  try {
    db.prepare('UPDATE listings SET embedding_json = ? WHERE id = ?').run(vectorJson, data.listing_id);
  } catch {
    // ignore
  }
}

export function getListingEmbeddingFromDb(listingId: string) {
  const row = db.prepare('SELECT * FROM listing_embeddings WHERE listing_id = ?').get(listingId) as any;
  if (!row) return null;
  return {
    id: row.id,
    listing_id: row.listing_id,
    kind: row.kind,
    provider: row.provider,
    model: row.model,
    dimensions: row.dimensions,
    vector: JSON.parse(row.vector_json || '[]'),
    updated_at: row.updated_at,
  };
}

export function getAllListingEmbeddingsFromDb() {
  const rows = db.prepare('SELECT * FROM listing_embeddings').all() as any[];
  return rows.map((r) => ({
    id: r.id,
    listing_id: r.listing_id,
    kind: r.kind,
    provider: r.provider,
    model: r.model,
    dimensions: r.dimensions,
    vector: JSON.parse(r.vector_json || '[]'),
    updated_at: r.updated_at,
  }));
}

function formatListingRow(row: any) {
  let modes: string[] = [];
  try {
    modes = JSON.parse(row.modes);
  } catch {
    modes = ['pickup'];
  }

  let photos: any[] = [];
  try {
    photos = JSON.parse(row.photos_json);
  } catch {
    photos = [];
  }

  const profile = row.profile_id ? getProfileByIdFromDb(row.profile_id) : getProfileByIdFromDb(row.owner);

  return {
    id: row.id,
    owner: row.owner,
    author_name: row.author_name,
    profile_id: row.profile_id || undefined,
    profile: profile || undefined,
    embedding_json: row.embedding_json || undefined,
    content: {
      title: row.title,
      description: row.description,
      category: row.category,
      subcategory: row.subcategory || undefined,
      kind: row.kind,
      modes,
      locality: row.locality,
      region: row.region || undefined,
      country: row.country || undefined,
      price_minor: row.price_minor,
      currency: row.currency,
      media_ids: photos.map((p: any) => p.id),
      condition: row.condition || undefined,
    },
    status: row.status,
    visibility: row.visibility,
    revision: row.revision,
    created_at: row.created_at,
    updated_at: row.updated_at,
    expires_at: row.expires_at,
    photos,
    responses_count: row.responses_count,
  };
}

// ---------------------------------------------------------------------------
// API keys (PR-3). Only the sha256 digest is persisted; the bearer token is
// printed once by scripts/issue-key.ts and never written to disk or logs.
// ---------------------------------------------------------------------------
export interface ApiKeyRecord {
  id: string;
  principalId: string;
  name: string;
  scopes: string;
  createdAt: number;
  lastUsedAt: number | null;
  revokedAt: number | null;
}

function mapApiKeyRow(row: any): ApiKeyRecord {
  return {
    id: row.id,
    principalId: row.principal_id,
    name: row.name,
    scopes: row.scopes || '*',
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at ?? null,
    revokedAt: row.revoked_at ?? null,
  };
}

export function createApiKeyInDb(record: {
  id: string;
  principalId: string;
  name: string;
  digest: string;
  scopes?: string;
  createdAt: number;
}) {
  db.prepare(
    `INSERT INTO api_keys (id, principal_id, name, digest, scopes, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(record.id, record.principalId, record.name, record.digest, record.scopes || '*', record.createdAt);
  return getApiKeyByIdInDb(record.id)!;
}

export function getApiKeyByIdInDb(id: string): ApiKeyRecord | null {
  const row = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id) as any;
  return row ? mapApiKeyRow(row) : null;
}

export function getApiKeyByDigestInDb(digest: string): ApiKeyRecord | null {
  const row = db.prepare('SELECT * FROM api_keys WHERE digest = ?').get(digest) as any;
  return row ? mapApiKeyRow(row) : null;
}

export function listApiKeysInDb(): ApiKeyRecord[] {
  const rows = db.prepare('SELECT * FROM api_keys ORDER BY created_at ASC').all() as any[];
  return rows.map(mapApiKeyRow);
}

/** Updates last_used_at only when it is stale, to keep reads cheap. */
export function touchApiKeyInDb(id: string, at: number, minIntervalMs = 60_000) {
  db.prepare(
    `UPDATE api_keys SET last_used_at = ?
     WHERE id = ? AND (last_used_at IS NULL OR last_used_at < ?)`
  ).run(at, id, at - minIntervalMs);
}

export function revokeApiKeyInDb(id: string, at: number): boolean {
  const result = db.prepare('UPDATE api_keys SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL').run(at, id);
  return result.changes > 0;
}

/**
 * Public projection of a listing: the storefront is readable without a key, so
 * it must not carry owner principal ids, the stored embedding vector or contact
 * channels. Author display data stays.
 */
export function toPublicListing(listing: any): any {
  if (!listing) return listing;
  const { owner, embedding_json, profile_id, profile, ...rest } = listing;
  const publicProfile = profile
    ? {
        id: profile.id,
        type: profile.type,
        name: profile.name,
        headline: profile.headline,
        bio: profile.bio,
        avatar_url: profile.avatar_url,
        locality: profile.locality,
        verified: profile.verified,
        reputation_score: profile.reputation_score,
      }
    : undefined;
  return { ...rest, profile: publicProfile };
}


export interface AuditLogEntry {
  id: string;
  eventType: string;
  actorId: string;
  resourceId?: string;
  details?: Record<string, any>;
  createdAt: number;
}

export function addAuditLog(eventType: string, actorId: string, resourceId?: string, details?: Record<string, any>): AuditLogEntry {
  const entry: AuditLogEntry = {
    id: 'audit-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    eventType,
    actorId,
    resourceId,
    details,
    createdAt: Date.now(),
  };

  db.prepare(`
    INSERT INTO audit_logs (id, event_type, actor_id, resource_id, details_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    entry.id,
    entry.eventType,
    entry.actorId,
    entry.resourceId || null,
    entry.details ? JSON.stringify(entry.details) : null,
    entry.createdAt
  );

  return entry;
}

export function getAuditLogs(filter: { actorId?: string; eventType?: string; limit?: number } = {}): AuditLogEntry[] {
  let query = 'SELECT * FROM audit_logs WHERE 1=1';
  const params: any[] = [];

  if (filter.actorId) {
    query += ' AND actor_id = ?';
    params.push(filter.actorId);
  }
  if (filter.eventType) {
    query += ' AND event_type = ?';
    params.push(filter.eventType);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(filter.limit || 50);

  const rows = db.prepare(query).all(...params) as any[];
  return rows.map((r) => ({
    id: r.id,
    eventType: r.event_type,
    actorId: r.actor_id,
    resourceId: r.resource_id || undefined,
    details: r.details_json ? JSON.parse(r.details_json) : undefined,
    createdAt: r.created_at,
  }));
}


export interface RateLimitStatus {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkAndConsumeRateLimit(key: string, limit: number, windowMs: number = 60000): RateLimitStatus {
  const now = Date.now();
  // Sweep expired hits
  db.prepare('DELETE FROM rate_limit_hits WHERE reset_at <= ?').run(now);

  const row = db.prepare('SELECT * FROM rate_limit_hits WHERE key = ?').get(key) as any;

  if (!row) {
    const resetAt = now + windowMs;
    db.prepare('INSERT INTO rate_limit_hits (key, count, reset_at) VALUES (?, 1, ?)').run(key, resetAt);
    return { allowed: true, limit, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (row.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((row.reset_at - now) / 1000));
    return { allowed: false, limit, remaining: 0, retryAfterSeconds: retryAfter };
  }

  const newCount = row.count + 1;
  db.prepare('UPDATE rate_limit_hits SET count = ? WHERE key = ?').run(newCount, key);
  return { allowed: true, limit, remaining: limit - newCount, retryAfterSeconds: 0 };
}

export function clearRateLimitHits() {
  db.prepare('DELETE FROM rate_limit_hits').run();
}


export interface UploadRecord {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  owner: string;
  createdAt: number;
}

export function saveUploadInDb(upload: UploadRecord): UploadRecord {
  db.prepare(`
    INSERT INTO uploads (id, filename, mime_type, size, url, owner, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    upload.id,
    upload.filename,
    upload.mimeType,
    upload.size,
    upload.url,
    upload.owner,
    upload.createdAt
  );

  return upload;
}

export function getUploadByIdFromDb(id: string): UploadRecord | null {
  const row = db.prepare('SELECT * FROM uploads WHERE id = ?').get(id) as any;
  if (!row) return null;
  return {
    id: row.id,
    filename: row.filename,
    mimeType: row.mime_type,
    size: row.size,
    url: row.url,
    owner: row.owner,
    createdAt: row.created_at,
  };
}

let roomEventSeq = 0;

export interface PersistentRoomEvent {
  id: string;
  roomId: string;
  eventType: string;
  payload: any;
  timestamp: number;
}

export function addRoomEventToDb(roomId: string, eventType: string, payload: any, eventId?: string): PersistentRoomEvent {
  const now = Date.now();
  roomEventSeq += 1;
  const id = eventId || `ev-${now}-${roomEventSeq}`;
  const payloadJson = JSON.stringify(payload || {});

  db.prepare(`
    INSERT OR REPLACE INTO room_events (id, room_id, event_type, payload_json, timestamp, seq)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, roomId, eventType, payloadJson, now, roomEventSeq);

  return { id, roomId, eventType, payload, timestamp: now };
}

export function getRoomEventsSinceInDb(roomId: string, lastEventId?: string): PersistentRoomEvent[] {
  if (!lastEventId) {
    const rows = db.prepare(`SELECT * FROM room_events WHERE room_id = ? ORDER BY timestamp ASC, seq ASC LIMIT 100`).all(roomId) as any[];
    return rows.map((r) => ({
      id: r.id,
      roomId: r.room_id,
      eventType: r.event_type,
      payload: JSON.parse(r.payload_json),
      timestamp: r.timestamp,
    }));
  }

  const lastRow = db.prepare(`SELECT timestamp, seq FROM room_events WHERE id = ?`).get(lastEventId) as { timestamp: number; seq: number } | undefined;

  if (lastRow) {
    const rows = db.prepare(`
      SELECT * FROM room_events 
      WHERE room_id = ? AND (timestamp > ? OR (timestamp = ? AND seq > ?))
      ORDER BY timestamp ASC, seq ASC LIMIT 100
    `).all(roomId, lastRow.timestamp, lastRow.timestamp, lastRow.seq) as any[];

    return rows.map((r) => ({
      id: r.id,
      roomId: r.room_id,
      eventType: r.event_type,
      payload: JSON.parse(r.payload_json),
      timestamp: r.timestamp,
    }));
  }

  const tsMatch = lastEventId.match(/(\d+)(?:-(\d+))?/);
  const ts = tsMatch ? Number(tsMatch[1]) : 0;
  const seq = tsMatch && tsMatch[2] ? Number(tsMatch[2]) : 0;

  const rows = db.prepare(`
    SELECT * FROM room_events 
    WHERE room_id = ? AND (timestamp > ? OR (timestamp = ? AND seq > ?)) 
    ORDER BY timestamp ASC, seq ASC LIMIT 100
  `).all(roomId, ts, ts, seq) as any[];

  return rows.map((r) => ({
    id: r.id,
    roomId: r.room_id,
    eventType: r.event_type,
    payload: JSON.parse(r.payload_json),
    timestamp: r.timestamp,
  }));
}
