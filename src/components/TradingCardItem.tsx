import { CardComponent, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card-component"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface TradingCardItemProps {
  id: string
  name: string
  game: "yugioh" | "mtg"
  rarity: string
  currentPrice: number
  previousPrice: number
  imageUrl: string
  set: string
  condition: string
  owned?: number
}

export const TradingCardItem = ({ 
  name, 
  game, 
  rarity, 
  currentPrice, 
  previousPrice, 
  imageUrl, 
  set, 
  condition,
  owned = 0
}: TradingCardItemProps) => {
  const priceChange = currentPrice - previousPrice
  const priceChangePercent = ((priceChange / previousPrice) * 100).toFixed(1)
  
  const getTrendIcon = () => {
    if (priceChange > 0) return <TrendingUp className="h-4 w-4 text-green-400" />
    if (priceChange < 0) return <TrendingDown className="h-4 w-4 text-red-400" />
    return <Minus className="h-4 w-4 text-gray-400" />
  }
  
  const getPriceColor = () => {
    if (priceChange > 0) return "text-green-400"
    if (priceChange < 0) return "text-red-400"
    return "text-gray-400"
  }

  const getRarityColor = () => {
    const colors: Record<string, string> = {
      "Common": "bg-gray-500",
      "Rare": "bg-blue-500",
      "Super Rare": "bg-purple-500",
      "Ultra Rare": "bg-gaming-gold",
      "Secret Rare": "bg-gradient-primary"
    }
    return colors[rarity] || "bg-gray-500"
  }

  return (
    <CardComponent variant="collection" className="w-full max-w-sm group">
      <CardHeader className="pb-2">
        <div className="aspect-[2.5/3.5] overflow-hidden rounded-md bg-muted">
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <CardTitle className="text-lg leading-tight">{name}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {game.toUpperCase()}
            </Badge>
            <Badge className={cn("text-xs text-white", getRarityColor())}>
              {rarity}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{set} • {condition}</p>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-gaming-gold">
              €{currentPrice.toFixed(2)}
            </span>
            <div className={cn("flex items-center gap-1 text-sm", getPriceColor())}>
              {getTrendIcon()}
              <span>{priceChangePercent}%</span>
            </div>
          </div>
          
          {owned > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Possedute:</span>
              <span className="text-gaming-blue font-semibold">{owned}</span>
            </div>
          )}
        </div>
      </CardContent>
    </CardComponent>
  )
}

function cn(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}