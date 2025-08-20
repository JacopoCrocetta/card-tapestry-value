import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Types (Domain Models)
interface CardPrice {
  id: string;
  card_id: string;
  condition: 'mint' | 'near_mint' | 'light_play' | 'moderate_play' | 'heavy_play' | 'damaged';
  price: number;
  currency: string;
  source?: string;
  recorded_at: string;
}

interface CardPriceWithCard extends CardPrice {
  cards: {
    id: string;
    name: string;
    game: string;
    set_name?: string;
    rarity?: string;
  };
}

interface PriceHistory {
  card_id: string;
  condition: string;
  prices: Array<{
    price: number;
    currency: string;
    source?: string;
    recorded_at: string;
  }>;
}

// Repository Layer
class PriceRepository {
  constructor(private supabase: any) {}

  async getLatestPricesForCard(cardId: string): Promise<CardPrice[]> {
    const { data, error } = await this.supabase
      .from('card_prices')
      .select('*')
      .eq('card_id', cardId)
      .order('recorded_at', { ascending: false });

    if (error) throw error;

    // Group by condition and get latest price for each
    const latestPrices = new Map<string, CardPrice>();
    
    if (data) {
      data.forEach((price: CardPrice) => {
        if (!latestPrices.has(price.condition) ||
            new Date(price.recorded_at) > new Date(latestPrices.get(price.condition)!.recorded_at)) {
          latestPrices.set(price.condition, price);
        }
      });
    }

    return Array.from(latestPrices.values());
  }

  async getPriceHistory(cardId: string, condition: string, days = 30): Promise<CardPrice[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data, error } = await this.supabase
      .from('card_prices')
      .select('*')
      .eq('card_id', cardId)
      .eq('condition', condition)
      .gte('recorded_at', cutoffDate.toISOString())
      .order('recorded_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getTopGainers(game?: string, limit = 10): Promise<CardPriceWithCard[]> {
    // Get prices from last 7 days and 14 days ago to calculate change
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    let query = this.supabase
      .from('card_prices')
      .select(`
        *,
        cards!inner (*)
      `)
      .gte('recorded_at', fourteenDaysAgo.toISOString())
      .order('recorded_at', { ascending: false });

    if (game) {
      query = query.eq('cards.game', game);
    }

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) return [];

    // Calculate price changes
    const cardPriceChanges = new Map<string, {
      card: any;
      currentPrice: number;
      previousPrice: number;
      change: number;
      changePercent: number;
    }>();

    data.forEach((priceRecord: any) => {
      const key = `${priceRecord.card_id}-${priceRecord.condition}`;
      const recordDate = new Date(priceRecord.recorded_at);
      
      if (!cardPriceChanges.has(key)) {
        cardPriceChanges.set(key, {
          card: priceRecord.cards,
          currentPrice: 0,
          previousPrice: 0,
          change: 0,
          changePercent: 0
        });
      }

      const existing = cardPriceChanges.get(key)!;
      
      if (recordDate >= sevenDaysAgo && existing.currentPrice === 0) {
        existing.currentPrice = priceRecord.price;
      } else if (recordDate < sevenDaysAgo && recordDate >= fourteenDaysAgo && existing.previousPrice === 0) {
        existing.previousPrice = priceRecord.price;
      }
    });

    // Calculate changes and filter out items without both prices
    const gainers = Array.from(cardPriceChanges.values())
      .filter(item => item.currentPrice > 0 && item.previousPrice > 0)
      .map(item => {
        item.change = item.currentPrice - item.previousPrice;
        item.changePercent = (item.change / item.previousPrice) * 100;
        return item;
      })
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, limit);

    return gainers.map(item => ({
      id: '',
      card_id: item.card.id,
      condition: 'near_mint' as any,
      price: item.currentPrice,
      currency: 'EUR',
      recorded_at: new Date().toISOString(),
      cards: item.card
    }));
  }

  async addPrice(priceData: Omit<CardPrice, 'id' | 'recorded_at'>): Promise<CardPrice> {
    const { data, error } = await this.supabase
      .from('card_prices')
      .insert(priceData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updatePrice(priceId: string, updates: Partial<CardPrice>): Promise<CardPrice> {
    const { data, error } = await this.supabase
      .from('card_prices')
      .update(updates)
      .eq('id', priceId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deletePrice(priceId: string): Promise<void> {
    const { error } = await this.supabase
      .from('card_prices')
      .delete()
      .eq('id', priceId);

    if (error) throw error;
  }
}

// Service Layer (Business Logic)
class PriceService {
  constructor(private repository: PriceRepository) {}

  async getCardPrices(cardId: string): Promise<CardPrice[]> {
    if (!cardId) {
      throw new Error('Card ID is required');
    }

    return await this.repository.getLatestPricesForCard(cardId);
  }

  async getPriceHistory(cardId: string, condition: string, days = 30): Promise<PriceHistory> {
    if (!cardId || !condition) {
      throw new Error('Card ID and condition are required');
    }

    if (days > 365) {
      throw new Error('Cannot fetch price history for more than 365 days');
    }

    const validConditions = ['mint', 'near_mint', 'light_play', 'moderate_play', 'heavy_play', 'damaged'];
    if (!validConditions.includes(condition)) {
      throw new Error('Invalid card condition');
    }

    const prices = await this.repository.getPriceHistory(cardId, condition, days);
    
    return {
      card_id: cardId,
      condition,
      prices: prices.map(p => ({
        price: p.price,
        currency: p.currency,
        source: p.source,
        recorded_at: p.recorded_at
      }))
    };
  }

  async getTopGainers(game?: string, limit = 10): Promise<CardPriceWithCard[]> {
    const validGames = ['yugioh', 'mtg', 'pokemon'];
    if (game && !validGames.includes(game)) {
      throw new Error('Invalid game type');
    }

    if (limit > 50) {
      throw new Error('Limit cannot exceed 50');
    }

    return await this.repository.getTopGainers(game, limit);
  }

  async addPrice(
    cardId: string,
    condition: string,
    price: number,
    currency = 'EUR',
    source?: string
  ): Promise<CardPrice> {
    // Validation
    if (!cardId || !condition) {
      throw new Error('Card ID and condition are required');
    }

    if (price <= 0) {
      throw new Error('Price must be greater than 0');
    }

    const validConditions = ['mint', 'near_mint', 'light_play', 'moderate_play', 'heavy_play', 'damaged'];
    if (!validConditions.includes(condition)) {
      throw new Error('Invalid card condition');
    }

    const validCurrencies = ['EUR', 'USD', 'GBP', 'JPY'];
    if (!validCurrencies.includes(currency)) {
      throw new Error('Invalid currency');
    }

    return await this.repository.addPrice({
      card_id: cardId,
      condition: condition as any,
      price,
      currency,
      source
    });
  }

  async updatePrice(priceId: string, updates: Partial<CardPrice>): Promise<CardPrice> {
    if (!priceId) {
      throw new Error('Price ID is required');
    }

    // Validate updates if provided
    if (updates.price !== undefined && updates.price <= 0) {
      throw new Error('Price must be greater than 0');
    }

    return await this.repository.updatePrice(priceId, updates);
  }

  async deletePrice(priceId: string): Promise<void> {
    if (!priceId) {
      throw new Error('Price ID is required');
    }

    await this.repository.deletePrice(priceId);
  }
}

// Controller Layer
class PriceController {
  constructor(private service: PriceService) {}

  async handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const method = req.method;
    const pathSegments = url.pathname.split('/').filter(Boolean);

    try {
      switch (method) {
        case 'GET':
          if (pathSegments.includes('top-gainers')) {
            const game = url.searchParams.get('game') || undefined;
            const limit = parseInt(url.searchParams.get('limit') || '10');
            const gainers = await this.service.getTopGainers(game, limit);
            return new Response(JSON.stringify(gainers), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          } else if (pathSegments.includes('history')) {
            const cardId = url.searchParams.get('card_id');
            const condition = url.searchParams.get('condition');
            const days = parseInt(url.searchParams.get('days') || '30');
            
            if (!cardId || !condition) {
              return new Response(
                JSON.stringify({ error: 'card_id and condition are required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }

            const history = await this.service.getPriceHistory(cardId, condition, days);
            return new Response(JSON.stringify(history), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          } else {
            // Get current prices for a card
            const cardId = url.searchParams.get('card_id');
            if (!cardId) {
              return new Response(
                JSON.stringify({ error: 'card_id is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }

            const prices = await this.service.getCardPrices(cardId);
            return new Response(JSON.stringify(prices), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

        case 'POST':
          const priceData = await req.json();
          const newPrice = await this.service.addPrice(
            priceData.card_id,
            priceData.condition,
            priceData.price,
            priceData.currency,
            priceData.source
          );
          return new Response(JSON.stringify(newPrice), {
            status: 201,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });

        case 'PUT':
          const priceId = pathSegments[pathSegments.length - 1];
          const updateData = await req.json();
          const updatedPrice = await this.service.updatePrice(priceId, updateData);
          return new Response(JSON.stringify(updatedPrice), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });

        case 'DELETE':
          const deleteId = pathSegments[pathSegments.length - 1];
          await this.service.deletePrice(deleteId);
          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });

        default:
          return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
      }
    } catch (error) {
      console.error('Prices API Error:', error);
      return new Response(
        JSON.stringify({ error: error.message || 'Internal server error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }
}

// Main handler
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Dependency injection
  const supabase = createClient(
    "https://vjctsmdmwzvrnklvnony.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqY3RzbWRtd3p2cm5rbHZub255Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2Njk4NjcsImV4cCI6MjA3MTI0NTg2N30.o2Z1PJmWLnyWr1rM7nUx36RayJfxPqDjGo9UIuFd4CI"
  );
  
  const repository = new PriceRepository(supabase);
  const service = new PriceService(repository);
  const controller = new PriceController(service);

  return await controller.handleRequest(req);
});