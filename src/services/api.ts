// Base API Service with Clean Architecture principles
import { supabase } from "@/integrations/supabase/client";
import type {
  Card,
  CardWithPrice,
  UserCollection,
  CollectionWithCard,
  CollectionStats,
  CardPrice,
  CardPriceWithCard,
  PriceHistory,
  CreateCardRequest,
  AddToCollectionRequest,
  UpdateCollectionRequest,
  AddPriceRequest,
  CardsQueryParams,
  PriceHistoryParams,
  TopGainersParams,
  ApiResponse
} from "@/types/api";

// Base API Client
class ApiClient {
  private baseUrl = "https://vjctsmdmwzvrnklvnony.supabase.co/functions/v1";

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      console.error(`API Error for ${endpoint}:`, error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  async get<T>(endpoint: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    const url = params ? `${endpoint}?${new URLSearchParams(params)}` : endpoint;
    return this.makeRequest<T>(url);
  }

  async post<T>(endpoint: string, data: any): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put<T>(endpoint: string, data: any): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'DELETE',
    });
  }
}

// Collections Service
export class CollectionService {
  constructor(private apiClient: ApiClient) {}

  async getUserCollections(): Promise<ApiResponse<CollectionWithCard[]>> {
    return this.apiClient.get<CollectionWithCard[]>('/collections');
  }

  async getCollectionStats(): Promise<ApiResponse<CollectionStats>> {
    return this.apiClient.get<CollectionStats>('/collections/stats');
  }

  async addToCollection(request: AddToCollectionRequest): Promise<ApiResponse<UserCollection>> {
    return this.apiClient.post<UserCollection>('/collections', request);
  }

  async updateCollection(collectionId: string, request: UpdateCollectionRequest): Promise<ApiResponse<UserCollection>> {
    return this.apiClient.put<UserCollection>(`/collections/${collectionId}`, request);
  }

  async removeFromCollection(collectionId: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.apiClient.delete<{ success: boolean }>(`/collections/${collectionId}`);
  }
}

// Cards Service
export class CardsService {
  constructor(private apiClient: ApiClient) {}

  async getCards(params: CardsQueryParams = {}): Promise<ApiResponse<Card[] | CardWithPrice[]>> {
    const queryParams: Record<string, string> = {};
    
    if (params.game) queryParams.game = params.game;
    if (params.search) queryParams.search = params.search;
    if (params.include_prices) queryParams.include_prices = params.include_prices.toString();
    if (params.limit) queryParams.limit = params.limit.toString();
    if (params.offset) queryParams.offset = params.offset.toString();
    if (params.set) queryParams.set = params.set;

    return this.apiClient.get<Card[] | CardWithPrice[]>('/cards', queryParams);
  }

  async getCardById(cardId: string): Promise<ApiResponse<Card>> {
    return this.apiClient.get<Card>(`/cards/${cardId}`);
  }

  async searchCardsBySet(setName: string, game?: string): Promise<ApiResponse<Card[]>> {
    const params: Record<string, string> = { set: setName };
    if (game) params.game = game;
    
    return this.apiClient.get<Card[]>('/cards', params);
  }

  async createCard(request: CreateCardRequest): Promise<ApiResponse<Card>> {
    return this.apiClient.post<Card>('/cards', request);
  }

  async updateCard(cardId: string, updates: Partial<CreateCardRequest>): Promise<ApiResponse<Card>> {
    return this.apiClient.put<Card>(`/cards/${cardId}`, updates);
  }

  async deleteCard(cardId: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.apiClient.delete<{ success: boolean }>(`/cards/${cardId}`);
  }
}

// Prices Service
export class PricesService {
  constructor(private apiClient: ApiClient) {}

  async getCardPrices(cardId: string): Promise<ApiResponse<CardPrice[]>> {
    return this.apiClient.get<CardPrice[]>('/prices', { card_id: cardId });
  }

  async getPriceHistory(params: PriceHistoryParams): Promise<ApiResponse<PriceHistory>> {
    const queryParams: Record<string, string> = {
      card_id: params.card_id,
      condition: params.condition,
    };
    
    if (params.days) queryParams.days = params.days.toString();

    return this.apiClient.get<PriceHistory>('/prices/history', queryParams);
  }

  async getTopGainers(params: TopGainersParams = {}): Promise<ApiResponse<CardPriceWithCard[]>> {
    const queryParams: Record<string, string> = {};
    
    if (params.game) queryParams.game = params.game;
    if (params.limit) queryParams.limit = params.limit.toString();

    return this.apiClient.get<CardPriceWithCard[]>('/prices/top-gainers', queryParams);
  }

  async addPrice(request: AddPriceRequest): Promise<ApiResponse<CardPrice>> {
    return this.apiClient.post<CardPrice>('/prices', request);
  }

  async updatePrice(priceId: string, updates: Partial<AddPriceRequest>): Promise<ApiResponse<CardPrice>> {
    return this.apiClient.put<CardPrice>(`/prices/${priceId}`, updates);
  }

  async deletePrice(priceId: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.apiClient.delete<{ success: boolean }>(`/prices/${priceId}`);
  }
}

// Service Factory (Dependency Injection)
class ServiceFactory {
  private apiClient: ApiClient;
  public collections: CollectionService;
  public cards: CardsService;
  public prices: PricesService;

  constructor() {
    this.apiClient = new ApiClient();
    this.collections = new CollectionService(this.apiClient);
    this.cards = new CardsService(this.apiClient);
    this.prices = new PricesService(this.apiClient);
  }
}

// Export singleton instance
export const apiServices = new ServiceFactory();