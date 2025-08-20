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
}

interface UserCollection {
  id: string;
  user_id: string;
  card_id: string;
  condition: 'mint' | 'near_mint' | 'light_play' | 'moderate_play' | 'heavy_play' | 'damaged';
  quantity: number;
  purchase_price?: number;
  purchase_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface CollectionWithCard extends UserCollection {
  cards: Card;
}

// Repository Layer
class CollectionRepository {
  constructor(private supabase: any) {}

  async getUserCollections(userId: string): Promise<CollectionWithCard[]> {
    const { data, error } = await this.supabase
      .from('user_collections')
      .select(`
        *,
        cards (*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async addToCollection(userId: string, collectionData: Partial<UserCollection>): Promise<UserCollection> {
    const { data, error } = await this.supabase
      .from('user_collections')
      .insert({
        ...collectionData,
        user_id: userId
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateCollection(userId: string, collectionId: string, updates: Partial<UserCollection>): Promise<UserCollection> {
    const { data, error } = await this.supabase
      .from('user_collections')
      .update(updates)
      .eq('id', collectionId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async removeFromCollection(userId: string, collectionId: string): Promise<void> {
    const { error } = await this.supabase
      .from('user_collections')
      .delete()
      .eq('id', collectionId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  async getCollectionStats(userId: string) {
    // Get total cards count
    const { count: totalCards } = await this.supabase
      .from('user_collections')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Get collections with latest prices
    const { data: collections } = await this.supabase
      .from('user_collections')
      .select(`
        *,
        cards!inner (*),
        card_prices!inner (price, recorded_at)
      `)
      .eq('user_id', userId)
      .order('recorded_at', { ascending: false, referencedTable: 'card_prices' });

    let totalValue = 0;
    let rarestCard = '';
    
    if (collections && collections.length > 0) {
      // Calculate total value using latest prices
      const cardPriceMap = new Map();
      collections.forEach((item: any) => {
        const cardKey = `${item.card_id}-${item.condition}`;
        if (!cardPriceMap.has(cardKey) || 
            new Date(item.card_prices.recorded_at) > new Date(cardPriceMap.get(cardKey).recorded_at)) {
          cardPriceMap.set(cardKey, item.card_prices);
        }
      });

      collections.forEach((item: any) => {
        const cardKey = `${item.card_id}-${item.condition}`;
        const latestPrice = cardPriceMap.get(cardKey);
        if (latestPrice) {
          totalValue += latestPrice.price * item.quantity;
        }
      });

      // Find rarest card (assuming rarer = higher price)
      const sortedByPrice = collections.sort((a: any, b: any) => {
        const priceA = cardPriceMap.get(`${a.card_id}-${a.condition}`)?.price || 0;
        const priceB = cardPriceMap.get(`${b.card_id}-${b.condition}`)?.price || 0;
        return priceB - priceA;
      });
      
      if (sortedByPrice.length > 0) {
        rarestCard = `${sortedByPrice[0].cards.name} (${sortedByPrice[0].cards.set_name})`;
      }
    }

    return {
      totalCards: totalCards || 0,
      totalValue: totalValue,
      topGainer: { name: "Dark Magician", change: 8.2 }, // Placeholder for now
      rarest: rarestCard || "No cards"
    };
  }
}

// Service Layer (Business Logic)
class CollectionService {
  constructor(private repository: CollectionRepository) {}

  async getUserCollections(userId: string): Promise<CollectionWithCard[]> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    return await this.repository.getUserCollections(userId);
  }

  async addCardToCollection(
    userId: string, 
    cardId: string, 
    condition: string, 
    quantity: number,
    purchasePrice?: number,
    notes?: string
  ): Promise<UserCollection> {
    // Validation
    if (!userId || !cardId) {
      throw new Error('User ID and Card ID are required');
    }

    if (quantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }

    const validConditions = ['mint', 'near_mint', 'light_play', 'moderate_play', 'heavy_play', 'damaged'];
    if (!validConditions.includes(condition)) {
      throw new Error('Invalid card condition');
    }

    return await this.repository.addToCollection(userId, {
      card_id: cardId,
      condition: condition as any,
      quantity,
      purchase_price: purchasePrice,
      notes
    });
  }

  async updateCollectionItem(
    userId: string, 
    collectionId: string, 
    updates: Partial<UserCollection>
  ): Promise<UserCollection> {
    if (!userId || !collectionId) {
      throw new Error('User ID and Collection ID are required');
    }

    return await this.repository.updateCollection(userId, collectionId, updates);
  }

  async removeFromCollection(userId: string, collectionId: string): Promise<void> {
    if (!userId || !collectionId) {
      throw new Error('User ID and Collection ID are required');
    }

    await this.repository.removeFromCollection(userId, collectionId);
  }

  async getCollectionStats(userId: string) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    return await this.repository.getCollectionStats(userId);
  }
}

// Controller Layer
class CollectionController {
  constructor(private service: CollectionService) {}

  async handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const method = req.method;
    const pathSegments = url.pathname.split('/').filter(Boolean);

    // Extract user from JWT
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      "https://vjctsmdmwzvrnklvnony.supabase.co",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqY3RzbWRtd3p2cm5rbHZub255Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2Njk4NjcsImV4cCI6MjA3MTI0NTg2N30.o2Z1PJmWLnyWr1rM7nUx36RayJfxPqDjGo9UIuFd4CI",
      {
        global: { headers: { Authorization: authHeader } }
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      switch (method) {
        case 'GET':
          if (pathSegments.includes('stats')) {
            const stats = await this.service.getCollectionStats(user.id);
            return new Response(JSON.stringify(stats), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          } else {
            const collections = await this.service.getUserCollections(user.id);
            return new Response(JSON.stringify(collections), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

        case 'POST':
          const addData = await req.json();
          const newItem = await this.service.addCardToCollection(
            user.id,
            addData.card_id,
            addData.condition,
            addData.quantity,
            addData.purchase_price,
            addData.notes
          );
          return new Response(JSON.stringify(newItem), {
            status: 201,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });

        case 'PUT':
          const collectionId = pathSegments[pathSegments.length - 1];
          const updateData = await req.json();
          const updatedItem = await this.service.updateCollectionItem(user.id, collectionId, updateData);
          return new Response(JSON.stringify(updatedItem), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });

        case 'DELETE':
          const deleteId = pathSegments[pathSegments.length - 1];
          await this.service.removeFromCollection(user.id, deleteId);
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
      console.error('Collection API Error:', error);
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
  
  const repository = new CollectionRepository(supabase);
  const service = new CollectionService(repository);
  const controller = new CollectionController(service);

  return await controller.handleRequest(req);
});