'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, Calendar, AlertTriangle } from 'lucide-react'

interface PendingApt {
  id: string
  start_time: string
  end_time: string
  topic: string
  channel: string
  status: string
  created_by: string
  profiles?: { full_name: string; color: string | null } | null
}

const TOPIC_LABELS: Record<string, string> = {
  fiscal: 'Fiscal', labor: 'Laboral', accounting: 'Comptable',
  income_tax: 'Renda', freelance: 'Autònoms', companies: 'Societats',
  internal_meeting: 'Reunió interna', client_query: 'Consulta client',
  documentation: 'Documentació', other: 'Altre',
}

const MONTHS_CA = ['gen', 'feb', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'des']

export function PendingAppointmentsList({ appointments }: { appointments: PendingApt[] }) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (appointments.length === 0) return null

  async function handleAction(appointmentId: string, action: 'confirm' | 'reject') {
    let reason = ''
    if (action === 'reject') {
      const input = prompt('Introduïu el motiu de la cancel·lació (opcional):')
      if (input === null) return // user cancelled
      reason = input.trim()
    }

    setLoadingId(appointmentId)
    setError(null)
    try {
      const res = await fetch('/api/appointments/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, action, reason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setLoadingId(null)
    }
  }

  function formatDT(dateStr: string): string {
    const d = new Date(dateStr)
    return `${d.getDate()} ${MONTHS_CA[d.getMonth()]} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}h`
  }

  return (
    <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/20 dark:bg-amber-900/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Calendar className="h-4 w-4 text-amber-500" />
          Tens sol·licituds de reunió pendents
          <span className="bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5 font-medium">
            {appointments.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {error && (
          <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg mb-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        {appointments.map(apt => {
          const profileData = apt.profiles
            ? (Array.isArray(apt.profiles) ? apt.profiles[0] : apt.profiles)
            : null
          const creatorName = profileData?.full_name || 'Altre'
          const color = profileData?.color || '#2272A3'
          return (
            <div key={apt.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200/50">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: color }}>
                  {creatorName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Reunió de {TOPIC_LABELS[apt.topic] || apt.topic}</p>
                  <p className="text-xs text-muted-foreground">Convocada per {creatorName} · {formatDT(apt.start_time)}</p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0 self-end sm:self-auto">
                <Button
                  size="sm"
                  disabled={loadingId !== null}
                  onClick={() => handleAction(apt.id, 'confirm')}
                  className="bg-green-600 hover:bg-green-700 text-white h-8 px-3 text-xs"
                >
                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                  {loadingId === apt.id ? 'Processant...' : 'Acceptar'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loadingId !== null}
                  onClick={() => handleAction(apt.id, 'reject')}
                  className="text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/20 h-8 px-3 text-xs"
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Rebutjar
                </Button>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
