// API Types for Backend Communication
export type GameType = 'yugioh' | 'mtg' | 'pokemon';
export type CardCondition = 'mint' | 'near_mint' | 'light_play' | 'moderate_play' | 'heavy_play' | 'damaged';

// Card Models
export interface Card {
  id: string;
  name: string;
  game: GameType;
  set_name?: string;
  rarity?: string;
  card_number?: string;
  image_url?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface CardWithPrice extends Card {
  latest_price?: {
    price: number;
    condition: CardCondition;
    currency: string;
    recorded_at: string;
  };
}

// Collection Models
export interface UserCollection {
  id: string;
  user_id: string;
  card_id: string;
  condition: CardCondition;
  quantity: number;
  purchase_price?: number;
  purchase_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CollectionWithCard extends UserCollection {
  cards: Card;
}

export interface CollectionStats {
  totalCards: number;
  totalValue: number;
  topGainer: {
    name: string;
    change: number;
  };
  rarest: string;
}

// Price Models
export interface CardPrice {
  id: string;
  card_id: string;
  condition: CardCondition;
  price: number;
  currency: string;
  source?: string;
  recorded_at: string;
}

export interface CardPriceWithCard extends CardPrice {
  cards: {
    id: string;
    name: string;
    game: GameType;
    set_name?: string;
    rarity?: string;
  };
}

export interface PriceHistory {
  card_id: string;
  condition: CardCondition;
  prices: Array<{
    price: number;
    currency: string;
    source?: string;
    recorded_at: string;
  }>;
}

// API Request/Response Types
export interface CreateCardRequest {
  name: string;
  game: GameType;
  set_name?: string;
  rarity?: string;
  card_number?: string;
  image_url?: string;
  description?: string;
}

export interface AddToCollectionRequest {
  card_id: string;
  condition: CardCondition;
  quantity: number;
  purchase_price?: number;
  notes?: string;
}

export interface UpdateCollectionRequest {
  condition?: CardCondition;
  quantity?: number;
  purchase_price?: number;
  notes?: string;
}

export interface AddPriceRequest {
  card_id: string;
  condition: CardCondition;
  price: number;
  currency?: string;
  source?: string;
}

// API Query Parameters
export interface CardsQueryParams {
  game?: GameType;
  search?: string;
  include_prices?: boolean;
  limit?: number;
  offset?: number;
  set?: string;
}

export interface PriceHistoryParams {
  card_id: string;
  condition: CardCondition;
  days?: number;
}

export interface TopGainersParams {
  game?: GameType;
  limit?: number;
}

// API Response wrapper
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// User Profile
export interface UserProfile {
  id: string;
  user_id: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}