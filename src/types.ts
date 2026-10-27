export type ListingCategory =
  | 'real_estate'
  | 'communities'
  | 'business'
  | 'jobs'
  | 'services'
  | 'things'
  | 'dating'
  | 'rides'
  | 'delivery'
  | 'other';

export const CATEGORY_LABELS: Record<ListingCategory, string> = {
  real_estate: 'Недвижимость',
  communities: 'Сообщества и команды',
  business: 'Бизнес и стартапы',
  jobs: 'Работа и вакансии',
  services: 'Услуги и мастера',
  things: 'Вещи и товары',
  dating: 'Знакомства и хобби',
  rides: 'Поездки',
  delivery: 'Доставка',
  other: 'Другое',
};

export type ListingKind = 'offer' | 'request';

export const KIND_LABELS: Record<ListingKind, string> = {
  offer: 'Предлагаю',
  request: 'Хочу (Ищу)',
};

export type FulfilmentMode = 'pickup' | 'shipping' | 'online';

export const MODE_LABELS: Record<FulfilmentMode, string> = {
  pickup: 'Самовывоз',
  shipping: 'Доставка',
  online: 'Онлайн',
};

export type ListingStatus = 'draft' | 'active' | 'paused' | 'fulfilled' | 'archived';

export interface ListingPhoto {
  id: string;
  name?: string;
  dataUrl: string;
  caption?: string;
}

export interface ListingContent {
  title: string;
  description: string;
  category: ListingCategory;
  subcategory?: string;
  kind: ListingKind;
  modes: FulfilmentMode[];
  locality: string;
  region?: string;
  country?: string;
  price_minor: number | null; // in cents/kopecks (null = by agreement)
  currency: string;
  media_ids: string[];
  condition?: string;
}

export interface Profile {
  id: string;
  type: 'individual' | 'company';
  name: string;
  headline?: string;
  bio?: string;
  avatar_url?: string;
  locality?: string;
  verified: boolean;
  reputation_score: number;
  contact_protocols: string[];
  created_at: number;
}

export interface Listing {
  id: string;
  owner: string;
  author_name: string;
  profile_id?: string;
  profile?: Profile;
  embedding_json?: string;
  similarity_score?: number;
  match_method?: 'semantic_embedding' | 'lexical_fallback';
  content: ListingContent;
  status: ListingStatus;
  visibility: 'public' | 'private';
  revision: number;
  created_at: number;
  updated_at: number;
  expires_at: number;
  photos: ListingPhoto[];
  responses_count: number;
  responses_summary?: {
    opened: number;
    answered: number;
    agreed: number;
    declined: number;
  };
}

export interface McpMessage {
  id: string;
  roomId: string;
  sender: string;
  role: 'human' | 'agent' | 'system';
  text: string;
  timestamp: number;
  toolCall?: {
    tool: string;
    params: any;
    result?: any;
  };
}

export interface McpRoom {
  id: string;
  title: string;
  listingId?: string;
  listingTitle?: string;
  participants: string[];
  messages: McpMessage[];
  status: 'active' | 'closed';
  created_at?: number;
  updated_at?: number;
}

export interface NegotiationStep {
  type: 'search' | 'room_created' | 'agent_round' | 'agreement_recorded';
  title: string;
  detail: string;
  status: 'completed' | 'in_progress';
  timestamp: number;
}

export interface NegotiationDialogueTurn {
  sender: string;
  role: 'agent' | 'human' | 'system';
  agentName: string;
  avatar: string;
  text: string;
  timestamp: number;
}

export interface NegotiationResult {
  negotiationId: string;
  status: 'agreed' | 'in_progress' | 'listing_created';
  targetListing: Listing;
  roomId: string;
  roomTitle: string;
  steps: NegotiationStep[];
  dialogue: NegotiationDialogueTurn[];
  summary: string;
  similarityScore?: number;
  matchMethod?: 'semantic_embedding' | 'lexical_fallback';
  matchReason?: string;
  agreedTerms?: {
    topic: string;
    price?: string;
    schedule?: string;
    locationProtocol: string;
    safetyConfirmed: boolean;
  };
}

export interface EmbeddingProviderStatus {
  provider: 'google' | 'disabled' | 'fallback';
  model: string;
  isAvailable: boolean;
  reason?: string;
}

