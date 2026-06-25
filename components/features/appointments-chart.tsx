'use client'

const COLORS = [
  '#2272A3', '#1A5F8A', '#3A8DC0', '#5BA3D0', '#7BB8DC',
  '#9CCDE8', '#2563EB', '#1D4ED8', '#3B82F6', '#60A5FA',
]

interface ChartData {
  topic: string
  count: number
}

export function AppointmentsChart({ data }: { data: ChartData[] }) {
  const max = Math.max(...data.map(d => d.count))

  return (
    <div className="space-y-2.5">
      {data.map((item, index) => (
        <div key={item.topic} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-foreground font-medium truncate max-w-[160px]">{item.topic}</span>
            <span className="text-muted-foreground font-mono ml-2">{item.count}</span>
          </div>
          <div className="h-6 w-full bg-muted rounded-md overflow-hidden">
            <div
              className="h-full rounded-md transition-all duration-500"
              style={{
                width: `${(item.count / max) * 100}%`,
                backgroundColor: COLORS[index % COLORS.length],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
