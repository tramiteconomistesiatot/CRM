import { Construction } from 'lucide-react'

interface PlaceholderPageProps {
  title: string
  description: string
  phase: string
}

export function PlaceholderPage({ title, description, phase }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="p-4 rounded-full bg-tramit-blue-light dark:bg-blue-900/20 mb-4">
        <Construction className="h-8 w-8 text-tramit-blue" />
      </div>
      <h1 className="text-xl font-semibold text-foreground mb-2">{title}</h1>
      <p className="text-muted-foreground max-w-sm mb-4">{description}</p>
      <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-muted text-muted-foreground">
        {phase}
      </span>
    </div>
  )
}
