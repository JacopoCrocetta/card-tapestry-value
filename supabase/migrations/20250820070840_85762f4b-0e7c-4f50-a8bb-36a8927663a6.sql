-- Create profiles table for user management
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Profiles are viewable by everyone" 
ON public.profiles 
FOR SELECT 
USING (true);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create function to handle user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, display_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'display_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create games enum
CREATE TYPE public.game_type AS ENUM ('yugioh', 'mtg', 'pokemon');

-- Create condition enum  
CREATE TYPE public.card_condition AS ENUM ('mint', 'near_mint', 'light_play', 'moderate_play', 'heavy_play', 'damaged');

-- Create cards table (master card database)
CREATE TABLE public.cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  game game_type NOT NULL,
  set_name TEXT,
  rarity TEXT,
  card_number TEXT,
  image_url TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(name, game, set_name, card_number)
);

-- Enable RLS for cards
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

-- Cards are publicly readable but only admins can modify
CREATE POLICY "Cards are viewable by everyone" 
ON public.cards 
FOR SELECT 
USING (true);

-- Create user collections table
CREATE TABLE public.user_collections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  condition card_condition NOT NULL DEFAULT 'near_mint',
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  purchase_price DECIMAL(10,2),
  purchase_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, card_id, condition)
);

-- Enable RLS for user collections
ALTER TABLE public.user_collections ENABLE ROW LEVEL SECURITY;

-- Collection policies
CREATE POLICY "Users can view their own collection" 
ON public.user_collections 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert into their own collection" 
ON public.user_collections 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own collection" 
ON public.user_collections 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete from their own collection" 
ON public.user_collections 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create card prices table for price tracking
CREATE TABLE public.card_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  condition card_condition NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  source TEXT,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  INDEX (card_id, condition, recorded_at DESC)
);

-- Enable RLS for card prices
ALTER TABLE public.card_prices ENABLE ROW LEVEL SECURITY;

-- Prices are publicly readable
CREATE POLICY "Card prices are viewable by everyone" 
ON public.card_prices 
FOR SELECT 
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cards_updated_at
  BEFORE UPDATE ON public.cards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_collections_updated_at
  BEFORE UPDATE ON public.user_collections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some initial card data
INSERT INTO public.cards (name, game, set_name, rarity, card_number, image_url) VALUES
('Dark Magician', 'yugioh', 'Legend of Blue Eyes', 'Ultra Rare', 'LOB-005', '/assets/yugioh-card.jpg'),
('Black Lotus', 'mtg', 'Alpha', 'Rare', '232', '/assets/mtg-card.jpg'),
('Blue-Eyes White Dragon', 'yugioh', 'Legend of Blue Eyes', 'Ultra Rare', 'LOB-001', '/assets/yugioh-card.jpg');

-- Insert some price data
INSERT INTO public.card_prices (card_id, condition, price, source) 
SELECT id, 'near_mint', 45.99, 'tcgplayer' FROM public.cards WHERE name = 'Dark Magician';

INSERT INTO public.card_prices (card_id, condition, price, source) 
SELECT id, 'light_play', 8500.00, 'tcgplayer' FROM public.cards WHERE name = 'Black Lotus';