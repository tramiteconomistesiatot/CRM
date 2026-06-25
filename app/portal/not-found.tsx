import Link from 'next/link'
import { TramitLogo } from '@/components/layout/logo'
import { AlertTriangle } from 'lucide-react'

export default function PortalNotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-tramit-blue-light via-white to-slate-50 p-4">
      <div className="text-center space-y-4 max-w-sm">
        <div className="flex justify-center">
          <TramitLogo size="md" />
        </div>
        <div className="p-4 rounded-full bg-amber-50 w-fit mx-auto">
          <AlertTriangle className="h-8 w-8 text-amber-500" />
        </div>
        <h1 className="text-xl font-bold">Accés no vàlid</h1>
        <p className="text-muted-foreground text-sm">
          Aquest link ha caducat o no és vàlid.
          Contacta amb Tràmit Economistes per obtenir un nou accés.
        </p>
        <a
          href="mailto:info@tramiteconomistes.com"
          className="inline-block bg-tramit-blue text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-tramit-blue-dark transition-colors"
        >
          Contactar
        </a>
      </div>
    </div>
  )
}
