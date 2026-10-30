import { Listing, McpRoom, McpMessage } from '../types';
import { Locale } from './translations';

export interface LocalizedListingData {
  title: string;
  description: string;
  author_name?: string;
  subcategory?: string;
  locality?: string;
  region?: string;
  country?: string;
  condition?: string;
}

export const LISTING_TRANSLATIONS_EN: Record<string, LocalizedListingData> = {
  // Fictional catalogue items (mockListings and server/db seed)
  'biz-partner-ai-01': {
    title: 'Looking for Co-founder / Business Partner for B2B AI Startup (MCP & Automation)',
    description:
      'Developing an integration platform for local LLM agents with CRM and warehouse databases. Working MVP with first 3 paid pilots. Seeking a strong commercial partner (marketing, B2B sales, pre-seed round fundraising). Equity share discussed during negotiations.',
    author_name: 'Alexey (Technical Founder)',
    subcategory: 'Partnership & Startups',
    locality: 'Kazan',
    region: 'Tatarstan',
    country: 'Russia',
    condition: 'MVP stage with validated demand',
  },
  'job-dev-senior-02': {
    title: 'Senior TypeScript / Node.js Backend Engineer (MCP & AI Agents)',
    description:
      'Seeking a lead backend engineer to scale a high-load agent protocol gateway. Stack: Node.js 22, TypeScript, SQLite/PostgreSQL, Docker, WebSocket. Remote format or hybrid in Kazan/Moscow. White salary 280,000 – 350,000 ₽ net, health insurance and hardware.',
    author_name: 'TechFin Solutions',
    subcategory: 'IT & Software Development',
    locality: 'Kazan',
    region: 'Tatarstan',
    country: 'Russia',
    condition: 'Full-time, remote or office',
  },
  'service-plumbing-bath-03': {
    title: 'Turnkey Bathroom Renovation, Plumbing & Pipe Replacement',
    description:
      '12 years of experience. Installation of Rehau/Stout manifold distribution, concealed cisterns, bathtubs, walk-in shower drains, and finishing plumbing fixtures. Written contract, 3-year warranty. Fixed estimate before work begins. Free on-site measurement in Kazan upon order confirmation.',
    author_name: 'Marat (Master Plumber)',
    subcategory: 'Renovation & Finishing',
    locality: 'Kazan',
    region: 'Tatarstan',
    country: 'Russia',
    condition: 'Professional tools, contract & warranty',
  },
  'dating-hike-kazan-04': {
    title: 'Looking for Company for Mountain Hikes, Volga Cycling & Board Games',
    description:
      'Hi! I love outdoor activities, tent camping in Kamskoye Ustye and Mari El, weekend bike rides, and cozy board game nights. Looking for like-minded people for trips and meaningful conversations. Prefer real meetups and shared activities over endless texting!',
    author_name: 'Daria (26 y.o.)',
    subcategory: 'Sports & Outdoors',
    locality: 'Kazan',
    region: 'Tatarstan',
    country: 'Russia',
    condition: 'Friendship, socializing & shared hobbies',
  },
  'bike-kazan-demo-01': {
    title: 'City Bicycle, Size M',
    description:
      'Example listing layout. Urban commuter bicycle for everyday riding. Here the seller describes condition, components, and reason for selling.\n\nAluminum frame, 7-speed Shimano Nexus internal gear hub, full fenders and rear rack. Gently used, well maintained.',
    author_name: 'Alexey (Kazan Cyclist)',
    subcategory: 'Bicycles',
    locality: 'Kazan',
    region: 'Tatarstan',
    country: 'Russia',
    condition: 'Good condition, gently used',
  },
  'ride-kazan-chelny-04': {
    title: 'Ride: Kazan → Naberezhnye Chelny (3 seats available)',
    description:
      'Leaving Friday at 18:30 from Prospekt Pobedy metro station. Clean interior, air conditioning, spacious trunk. Can take passengers or small packages.',
    author_name: 'Arthur K.',
    subcategory: 'Intercity Rides',
    locality: 'Kazan',
    region: 'Tatarstan',
    country: 'Russia',
    condition: 'Comfort class',
  },
  'ride-kazan-chelny-05': {
    title: 'Ride: Kazan → Naberezhnye Chelny (3 seats available)',
    description:
      'Leaving Friday at 18:30 from Prospekt Pobedy metro station. Clean interior, air conditioning, spacious trunk. Can take passengers or small packages.',
    author_name: 'Arthur K.',
    subcategory: 'Intercity Rides',
    locality: 'Kazan',
    region: 'Tatarstan',
    country: 'Russia',
    condition: 'Comfort class',
  },
  'courier-service-05': {
    title: 'Urgent Document & Package Courier Delivery Across City',
    description:
      'Fast door-to-door delivery. Photo confirmation of delivery, careful handling of fragile items. Payment upon completion of delivery to recipient.',
    author_name: 'Express Delivery Service',
    subcategory: 'Courier Services',
    locality: 'Kazan',
    region: 'Tatarstan',
    country: 'Russia',
    condition: 'Same-day urgent delivery',
  },
  'delivery-express-06': {
    title: 'Urgent Document & Package Courier Delivery Across City',
    description:
      'Fast door-to-door delivery. Photo confirmation of delivery, careful handling of fragile items. Payment upon delivery to recipient.',
    author_name: 'Express Delivery Service',
    subcategory: 'Courier Services',
    locality: 'Kazan',
    region: 'Tatarstan',
    country: 'Russia',
    condition: 'Same-day urgent delivery',
  },
  'mcp-agent-consult-02': {
    title: 'MCP Server Setup & Deployment for Local LLM Models',
    description:
      'Will help configure Model Context Protocol (MCP) gateway, SQLite integration, access permissions, and connecting autonomous agents (Claude Desktop, Qwen, Cursor). Room configurations, security audit, and session isolation.',
    author_name: 'Automation Engineer',
    subcategory: 'IT & Software Development',
    locality: 'Kazan',
    region: 'Tatarstan',
    country: 'Russia',
    condition: 'Remote consultation & support',
  },
  'vinyl-request-03': {
    title: 'Seeking Vintage Vinyl Turntable in Working Condition',
    description:
      'Looking to purchase a record player (Technics, Dual, Vega, or Elektronika). Main requirement is functional mechanics and intact pickup cartridge. Ready to discuss price depending on condition and restoration.',
    author_name: 'Vinyl Collector',
    subcategory: 'Audio Equipment',
    locality: 'Moscow',
    region: 'Moscow Region',
    country: 'Russia',
    condition: 'Working condition',
  },
  'real-estate-office-kazan-01': {
    title: 'Modern Coworking Space / Office for IT Teams in Central Kazan',
    description:
      'Bright 120 m² open workspace in Vakhitovsky district (Profsoyuznaya St). Open space for 15–20 desks, private meeting room, 500 Mbps fiber internet, ventilation and AC, lounge area and coffee point. Direct contract with property owner, no agency commissions.',
    author_name: 'Bauman Commercial Realty',
    subcategory: 'Commercial Real Estate & Offices',
    locality: 'Kazan',
    region: 'Tatarstan',
    country: 'Russia',
    condition: 'Fully furnished, ready to move in',
  },
  'real-estate-roommate-kazan-02': {
    title: 'Seeking Roommate for 3-Room Apartment Near IT Park Kazan',
    description:
      'Spacious private room for rent in a 3-bedroom apartment near Rameev IT Park (Peterburgskaya St). Clean, tidy, fast WiFi, all appliances, dishwasher. Looking for an adequate roommate (no parties or bad habits). Utilities split equally. No realtor fee.',
    author_name: 'Renat (Developer)',
    subcategory: 'Roommates & Room Rentals',
    locality: 'Kazan',
    region: 'Tatarstan',
    country: 'Russia',
    condition: 'Private room, furnished, King-size bed',
  },
  'communities-open-ai-kazan-01': {
    title: 'Community Parliament: Open AI & Autonomous Agent Systems Project Team',
    description:
      'Initiative to coordinate open-source projects in AI, MCP agents, and decentralized systems. Gathering a community council of developers, engineers, designers, and researchers. Weekly open coordination sessions, meritocracy and consensus-based task allocation.',
    author_name: 'Kazan Community Parliament',
    subcategory: 'Community Parliament & Open Teams',
    locality: 'Kazan',
    region: 'Tatarstan',
    country: 'Russia',
    condition: 'Horizontal governance, open mandate',
  },
  'communities-eco-urban-02': {
    title: 'Seeking Teammates for Public Spaces & Embankments Development Project',
    description:
      'Forming a working group of urban planners, architects, and ecologists. Goal: developing concepts for accessible urban environments, protecting local waterways, and collaborating with the city community parliament. Join the team!',
    author_name: 'City Initiative Council',
    subcategory: 'Urban Initiatives & Working Groups',
    locality: 'Kazan',
    region: 'Tatarstan',
    country: 'Russia',
    condition: 'Collaborative project work',
  },
};

export const COMMON_LOCALITIES_EN: Record<string, string> = {
  'Казань': 'Kazan',
  'Москва': 'Moscow',
  'Санкт-Петербург': 'Saint Petersburg',
  'Татарстан': 'Tatarstan',
  'Россия': 'Russia',
  'Московская обл.': 'Moscow Region',
  'Набережные Челны': 'Naberezhnye Chelny',
  'Иннополис': 'Innopolis',
  'Любой регион': 'Any region',
};

export const COMMON_SUBCATEGORIES_EN: Record<string, string> = {
  'Велосипеды': 'Bicycles',
  'IT и разработка': 'IT & Software Development',
  'Аудиотехника': 'Audio Equipment',
  'Межгород': 'Intercity Rides',
  'Курьеры': 'Courier Services',
  'Коммерческая недвижимость и офисы': 'Commercial Real Estate & Offices',
  'Поиск сожителей и аренда комнат': 'Roommates & Room Rentals',
  'Парламент сообществ и открытые команды': 'Community Parliament & Open Teams',
  'Городские инициативы и рабочие группы': 'Urban Initiatives & Working Groups',
  'Партнёрство и стартапы': 'Partnership & Startups',
  'Ремонт и отделка': 'Renovation & Finishing',
  'Спорт и активный отдых': 'Sports & Outdoors',
};

export const COMMON_CONDITIONS_EN: Record<string, string> = {
  'Хорошее, бережная эксплуатация': 'Good condition, gently used',
  'Удалённая консультация и сопровождение': 'Remote consultation & support',
  'Рабочее состояние': 'Working condition',
  'Комфорт-класс': 'Comfort class',
  'Срочно в день заказа': 'Same-day urgent delivery',
  'Полностью меблирован, готов к въезду': 'Fully furnished, ready to move in',
  'Изолированная комната, мебель, кровать King-size': 'Private room, furnished, King-size bed',
  'Горизонтальное самоуправление, открытый мандат': 'Horizontal governance, open mandate',
  'Совместная проектная деятельность': 'Collaborative project work',
  'Стадия MVP с подтверждённым спросом': 'MVP stage with validated demand',
  'Full-time, удалённо или офис': 'Full-time, remote or office',
  'Профессиональное оборудование, договор и гарантия': 'Professional tools, contract & warranty',
  'Дружба, общение и совместные хобби': 'Friendship, socializing & shared hobbies',
  'Отличное состояние': 'Excellent condition',
  'Новое': 'Brand new',
  'Б/У': 'Used',
};

/**
 * Returns localized version of a Listing based on current locale.
 */
export function getLocalizedListing(listing: Listing, locale: Locale): Listing {
  if (locale === 'ru') {
    return listing;
  }

  const enTranslation = LISTING_TRANSLATIONS_EN[listing.id];

  const subcategory =
    enTranslation?.subcategory ||
    (listing.content.subcategory ? COMMON_SUBCATEGORIES_EN[listing.content.subcategory] || listing.content.subcategory : undefined);

  const locality =
    enTranslation?.locality ||
    COMMON_LOCALITIES_EN[listing.content.locality] ||
    listing.content.locality;

  const region =
    enTranslation?.region ||
    (listing.content.region ? COMMON_LOCALITIES_EN[listing.content.region] || listing.content.region : undefined);

  const country =
    enTranslation?.country ||
    (listing.content.country ? COMMON_LOCALITIES_EN[listing.content.country] || listing.content.country : undefined);

  const condition =
    enTranslation?.condition ||
    (listing.content.condition ? COMMON_CONDITIONS_EN[listing.content.condition] || listing.content.condition : undefined);

  return {
    ...listing,
    author_name: enTranslation?.author_name || listing.author_name,
    content: {
      ...listing.content,
      title: enTranslation?.title || listing.content.title,
      description: enTranslation?.description || listing.content.description,
      subcategory,
      locality,
      region,
      country,
      condition,
    },
  };
}

export const ROOM_MESSAGES_TRANSLATIONS_EN: Record<string, string> = {
  'msg-1': 'Hello! Could you tell me the exact weight of the bicycle and whether maintenance was done this season?',
  'msg-2': 'Good afternoon! Weight is around 13.8 kg, chain was lubricated and internal gear hub adjusted at the season start. Ready to show near Gorky Park.',
  'msg-3': 'MCP Agent: Verified listing parameters. Pickup in Kazan confirmed by both parties. Reminder: meeting in a public place is strongly recommended by platform safety rules.',
};

export const ROOM_TITLES_TRANSLATIONS_EN: Record<string, string> = {
  'room-bike-negotiation-01': 'Discussion: City Bicycle (Kazan)',
};

/**
 * Returns localized version of a Room based on current locale.
 */
export function getLocalizedRoom(room: McpRoom, locale: Locale): McpRoom {
  if (locale === 'ru') return room;

  const listingTitle = room.listingId && LISTING_TRANSLATIONS_EN[room.listingId]
    ? LISTING_TRANSLATIONS_EN[room.listingId].title
    : room.listingTitle;

  const title = ROOM_TITLES_TRANSLATIONS_EN[room.id] || room.title;

  const messages: McpMessage[] = (room.messages || []).map((m) => ({
    ...m,
    text: ROOM_MESSAGES_TRANSLATIONS_EN[m.id] || m.text,
  }));

  return {
    ...room,
    title,
    listingTitle,
    messages,
  };
}
