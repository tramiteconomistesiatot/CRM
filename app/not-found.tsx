import Link from 'next/link'
import { TramitLogo } from '@/components/layout/logo'
import { Button } from '@/components/ui/button'
import { Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-tramit-blue-light via-white to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="flex justify-center">
          <TramitLogo size="md" />
        </div>
        <div>
          <p className="text-8xl font-bold text-tramit-blue/20 dark:text-tramit-blue/10">404</p>
          <h1 className="text-2xl font-bold -mt-4">Pàgina no trobada</h1>
          <p className="text-muted-foreground mt-2">
            La pàgina que busques no existeix o ha estat moguda.
          </p>
        </div>
        <Button asChild variant="tramit">
          <Link href="/" className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            Tornar a l&apos;inici
          </Link>
        </Button>
      </div>
    </div>
  )
}
