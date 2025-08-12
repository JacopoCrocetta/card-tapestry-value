import { Button } from "@/components/ui/enhanced-button"
import { TradingCardItem } from "@/components/TradingCardItem"
import { CollectionStats } from "@/components/CollectionStats"
import { Input } from "@/components/ui/input"
import { Search, Plus, Eye } from "lucide-react"
import heroImage from "@/assets/hero-cards.jpg"
import yugihohCard from "@/assets/yugioh-card.jpg"
import mtgCard from "@/assets/mtg-card.jpg"

const Index = () => {
  // Mock data per le carte
  const mockCards = [
    {
      id: "1",
      name: "Dark Magician",
      game: "yugioh" as const,
      rarity: "Ultra Rare",
      currentPrice: 45.99,
      previousPrice: 42.50,
      imageUrl: yugihohCard,
      set: "Legend of Blue Eyes",
      condition: "Near Mint",
      owned: 2
    },
    {
      id: "2", 
      name: "Black Lotus",
      game: "mtg" as const,
      rarity: "Rare",
      currentPrice: 8500.00,
      previousPrice: 8200.00,
      imageUrl: mtgCard,
      set: "Alpha",
      condition: "Light Play",
      owned: 1
    }
  ]

  const mockStats = {
    totalCards: 1247,
    totalValue: 15420,
    topGainer: {
      name: "Dark Magician",
      change: 8.2
    },
    rarest: "Black Lotus Alpha"
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative h-[70vh] flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="absolute inset-0 bg-black/60" />
        </div>
        
        <div className="relative z-10 text-center max-w-4xl mx-auto px-6">
          <h1 className="text-5xl md:text-7xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-6">
            CardVault Pro
          </h1>
          <p className="text-xl md:text-2xl text-gray-200 mb-8 max-w-2xl mx-auto">
            Gestisci la tua collezione di carte Yu-Gi-Oh! e Magic: The Gathering con valutazioni in tempo reale
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="hero" size="hero">
              <Plus className="mr-2 h-5 w-5" />
              Inizia Collezione
            </Button>
            <Button variant="gaming" size="hero">
              <Eye className="mr-2 h-5 w-5" />
              Esplora Carte
            </Button>
          </div>
        </div>
      </section>

      {/* Search Section */}
      <section className="py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input 
              placeholder="Cerca carte nella tua collezione..."
              className="pl-10 bg-card border-gaming-purple/20 focus:border-gaming-purple"
            />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8 bg-gradient-gold bg-clip-text text-transparent">
            Panoramica Collezione
          </h2>
          <CollectionStats {...mockStats} />
        </div>
      </section>

      {/* Featured Cards Section */}
      <section className="py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold">Carte in Evidenza</h2>
            <Button variant="outline">Vedi Tutte</Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {mockCards.map((card) => (
              <TradingCardItem key={card.id} {...card} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-card">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">Pronto a Valorizzare la Tua Collezione?</h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Monitora i prezzi in tempo reale, gestisci il tuo inventario e scopri il vero valore delle tue carte
          </p>
          <Button variant="gold" size="hero">
            Registrati Gratis
          </Button>
        </div>
      </section>
    </div>
  )
}

export default Index