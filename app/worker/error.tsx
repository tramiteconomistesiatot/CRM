'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function WorkerError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
      <div className="p-4 rounded-full bg-red-50 dark:bg-red-900/20">
        <AlertTriangle className="h-8 w-8 text-red-500" />
      </div>
      <h2 className="text-xl font-semibold">S&apos;ha produït un error</h2>
      <p className="text-muted-foreground max-w-sm text-sm">
        No s&apos;ha pogut carregar aquesta pàgina. Torna-ho a intentar.
      </p>
      <Button onClick={reset} variant="tramit" className="flex items-center gap-2">
        <RefreshCw className="h-4 w-4" />
        Tornar a intentar
      </Button>
    </div>
  )
}
