import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Types (Domain Models)
interface Card {
  id: string;
  name: string;
  game: 'yugioh' | 'mtg' | 'pokemon';
  set_name?: string;
  rarity?: string;
  card_number?: string;
  image_url?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

interface CardWithLatestPrice extends Card {
  latest_price?: {
    price: number;
    condition: string;
    currency: string;
    recorded_at: string;
  };
}

// Repository Layer
class CardRepository {
  constructor(private supabase: any) {}

  async getAllCards(game?: string, searchTerm?: string, limit = 50, offset = 0): Promise<Card[]> {
    let query = this.supabase
      .from('cards')
      .select('*')
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (game) {
      query = query.eq('game', game);
    }

    if (searchTerm) {
      query = query.ilike('name', `%${searchTerm}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async getCardById(cardId: string): Promise<Card | null> {
    const { data, error } = await this.supabase
      .from('cards')
      .select('*')
      .eq('id', cardId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data;
  }

  async getCardsWithLatestPrices(game?: string, searchTerm?: string, limit = 50): Promise<CardWithLatestPrice[]> {
    let query = this.supabase
      .from('cards')
      .select(`
        *,
        card_prices!inner (
          price,
          condition,
          currency,
          recorded_at
        )
      `)
      .order('name', { ascending: true })
      .order('recorded_at', { ascending: false, referencedTable: 'card_prices' })
      .limit(limit);

    if (game) {
      query = query.eq('game', game);
    }

    if (searchTerm) {
      query = query.ilike('name', `%${searchTerm}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Process to get only the latest price for each card
    const cardMap = new Map<string, CardWithLatestPrice>();
    
    if (data) {
      data.forEach((item: any) => {
        const cardId = item.id;
        const existingCard = cardMap.get(cardId);
        
        if (!existingCard || 
            new Date(item.card_prices.recorded_at) > new Date(existingCard.latest_price!.recorded_at)) {
          cardMap.set(cardId, {
            ...item,
            latest_price: {
              price: item.card_prices.price,
              condition: item.card_prices.condition,
              currency: item.card_prices.currency,
              recorded_at: item.card_prices.recorded_at
            },
            card_prices: undefined
          });
        }
      });
    }

    return Array.from(cardMap.values());
  }

  async createCard(cardData: Omit<Card, 'id' | 'created_at' | 'updated_at'>): Promise<Card> {
    const { data, error } = await this.supabase
      .from('cards')
      .insert(cardData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateCard(cardId: string, updates: Partial<Card>): Promise<Card> {
    const { data, error } = await this.supabase
      .from('cards')
      .update(updates)
      .eq('id', cardId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteCard(cardId: string): Promise<void> {
    const { error } = await this.supabase
      .from('cards')
      .delete()
      .eq('id', cardId);

    if (error) throw error;
  }

  async searchCardsBySet(setName: string, game?: string): Promise<Card[]> {
    let query = this.supabase
      .from('cards')
      .select('*')
      .ilike('set_name', `%${setName}%`)
      .order('card_number', { ascending: true });

    if (game) {
      query = query.eq('game', game);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }
}

// Service Layer (Business Logic)
class CardService {
  constructor(private repository: CardRepository) {}

  async getCards(
    game?: string, 
    searchTerm?: string, 
    includePrices = false,
    limit = 50, 
    offset = 0
  ): Promise<Card[] | CardWithLatestPrice[]> {
    // Validation
    const validGames = ['yugioh', 'mtg', 'pokemon'];
    if (game && !validGames.includes(game)) {
      throw new Error('Invalid game type. Must be one of: yugioh, mtg, pokemon');
    }

    if (limit > 100) {
      throw new Error('Limit cannot exceed 100 cards');
    }

    if (includePrices) {
      return await this.repository.getCardsWithLatestPrices(game, searchTerm, limit);
    } else {
      return await this.repository.getAllCards(game, searchTerm, limit, offset);
    }
  }

  async getCardById(cardId: string): Promise<Card> {
    if (!cardId) {
      throw new Error('Card ID is required');
    }

    const card = await this.repository.getCardById(cardId);
    if (!card) {
      throw new Error('Card not found');
    }

    return card;
  }

  async searchCardsBySet(setName: string, game?: string): Promise<Card[]> {
    if (!setName || setName.trim().length < 2) {
      throw new Error('Set name must be at least 2 characters long');
    }

    return await this.repository.searchCardsBySet(setName.trim(), game);
  }

  async createCard(cardData: {
    name: string;
    game: string;
    set_name?: string;
    rarity?: string;
    card_number?: string;
    image_url?: string;
    description?: string;
  }): Promise<Card> {
    // Validation
    if (!cardData.name || cardData.name.trim().length === 0) {
      throw new Error('Card name is required');
    }

    const validGames = ['yugioh', 'mtg', 'pokemon'];
    if (!validGames.includes(cardData.game)) {
      throw new Error('Invalid game type');
    }

    return await this.repository.createCard({
      ...cardData,
      name: cardData.name.trim(),
      game: cardData.game as any
    });
  }

  async updateCard(cardId: string, updates: Partial<Card>): Promise<Card> {
    if (!cardId) {
      throw new Error('Card ID is required');
    }

    // Check if card exists
    await this.getCardById(cardId);

    return await this.repository.updateCard(cardId, updates);
  }

  async deleteCard(cardId: string): Promise<void> {
    if (!cardId) {
      throw new Error('Card ID is required');
    }

    // Check if card exists
    await this.getCardById(cardId);

    await this.repository.deleteCard(cardId);
  }
}

// Controller Layer
class CardController {
  constructor(private service: CardService) {}

  async handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const method = req.method;
    const pathSegments = url.pathname.split('/').filter(Boolean);

    try {
      switch (method) {
        case 'GET':
          if (pathSegments.length > 1) {
            // Get specific card by ID
            const cardId = pathSegments[pathSegments.length - 1];
            const card = await this.service.getCardById(cardId);
            return new Response(JSON.stringify(card), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          } else {
            // Get cards with query parameters
            const game = url.searchParams.get('game') || undefined;
            const search = url.searchParams.get('search') || undefined;
            const includePrices = url.searchParams.get('include_prices') === 'true';
            const limit = parseInt(url.searchParams.get('limit') || '50');
            const offset = parseInt(url.searchParams.get('offset') || '0');
            const set = url.searchParams.get('set');

            if (set) {
              const cards = await this.service.searchCardsBySet(set, game);
              return new Response(JSON.stringify(cards), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            } else {
              const cards = await this.service.getCards(game, search, includePrices, limit, offset);
              return new Response(JSON.stringify(cards), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
          }

        case 'POST':
          const createData = await req.json();
          const newCard = await this.service.createCard(createData);
          return new Response(JSON.stringify(newCard), {
            status: 201,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });

        case 'PUT':
          const cardId = pathSegments[pathSegments.length - 1];
          const updateData = await req.json();
          const updatedCard = await this.service.updateCard(cardId, updateData);
          return new Response(JSON.stringify(updatedCard), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });

        case 'DELETE':
          const deleteId = pathSegments[pathSegments.length - 1];
          await this.service.deleteCard(deleteId);
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
      console.error('Cards API Error:', error);
      
      const status = error.message === 'Card not found' ? 404 : 500;
      return new Response(
        JSON.stringify({ error: error.message || 'Internal server error' }),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
  
  const repository = new CardRepository(supabase);
  const service = new CardService(repository);
  const controller = new CardController(service);

  return await controller.handleRequest(req);
});