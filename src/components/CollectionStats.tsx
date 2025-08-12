import { CardComponent, CardContent, CardHeader, CardTitle } from "@/components/ui/card-component"
import { TrendingUp, Package, DollarSign, Star } from "lucide-react"

interface CollectionStatsProps {
  totalCards: number
  totalValue: number
  topGainer: {
    name: string
    change: number
  }
  rarest: string
}

export const CollectionStats = ({ totalCards, totalValue, topGainer, rarest }: CollectionStatsProps) => {
  const stats = [
    {
      title: "Carte Totali",
      value: totalCards.toLocaleString(),
      icon: Package,
      color: "text-gaming-blue"
    },
    {
      title: "Valore Collezione",
      value: `€${totalValue.toLocaleString()}`,
      icon: DollarSign,
      color: "text-gaming-gold"
    },
    {
      title: "Miglior Performance",
      value: `+${topGainer.change}%`,
      subtitle: topGainer.name,
      icon: TrendingUp,
      color: "text-green-400"
    },
    {
      title: "Carta Più Rara",
      value: rarest,
      icon: Star,
      color: "text-gaming-purple"
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => (
        <CardComponent key={index} variant="gaming">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <stat.icon className={cn("h-4 w-4", stat.color)} />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", stat.color)}>
              {stat.value}
            </div>
            {stat.subtitle && (
              <p className="text-xs text-muted-foreground mt-1">
                {stat.subtitle}
              </p>
            )}
          </CardContent>
        </CardComponent>
      ))}
    </div>
  )
}

function cn(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}