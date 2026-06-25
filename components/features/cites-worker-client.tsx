'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, CheckCircle, XCircle, Clock, User, MapPin, AlertTriangle, Building2 } from 'lucide-react'

const TOPIC_LABELS: Record<string, string> = {
  fiscal: 'Fiscal', labor: 'Laboral', accounting: 'Comptable',
  income_tax: 'Renda', freelance: 'Autònoms', companies: 'Societats',
  internal_meeting: 'Reunió interna', client_query: 'Consulta client',
  documentation: 'Documentació', other: 'Altre',
}
const CHANNEL_LABELS: Record<string, string> = {
  in_person: 'Presencial', phone: 'Telèfon', video: 'Videotrucada', email: 'Email', other: 'Altre',
}

interface Appointment {
  id: string
  start_time: string
  end_time: string
  topic: string
  channel: string
  status: string
  priority: string
  location: string | null
  internal_notes: string | null
  main_attendee_id: string
  created_by: string
  profiles?: { full_name: string; color: string | null } | null
  clients?: { name: string; company: string | null } | null
}

const MONTHS_CA = ['gen', 'feb', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'des']

function formatDT(dateStr: string): { date: string; time: string } {
  const d = new Date(dateStr)
  return {
    date: `${d.getDate()} ${MONTHS_CA[d.getMonth()]} ${d.getFullYear()}`,
    time: `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`,
  }
}

interface Props {
  appointments: Appointment[]
  currentUserId: string
  currentUserRole: string
}

export function CitesWorkerClient({ appointments, currentUserId, currentUserRole }: Props) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [localAppts, setLocalAppts] = useState<Appointment[]>(appointments)

  const pending = localAppts.filter(a => a.status === 'pending')
  const confirmed = localAppts.filter(a => a.status === 'confirmed')

  async function handleAction(appointmentId: string, action: 'confirm' | 'reject') {
    let reason = ''
    if (action === 'reject') {
      const input = prompt('Introduïu el motiu de la cancel·lació (opcional):')
      if (input === null) return // user cancelled
      reason = input.trim()
    }

    setLoading(appointmentId)
    setError(null)
    try {
      const res = await fetch('/api/appointments/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, action, reason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      const newStatus = action === 'confirm' ? 'confirmed' : 'rejected'
      setLocalAppts(prev => prev.map(a => a.id === appointmentId ? { ...a, status: newStatus } : a))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setLoading(null)
    }
  }

  function AppointmentCard({ appt, showActions }: { appt: Appointment; showActions: boolean }) {
    const start = formatDT(appt.start_time)
    const end = formatDT(appt.end_time)
    const profileData = appt.profiles
      ? (Array.isArray(appt.profiles) ? appt.profiles[0] : appt.profiles)
      : null
    const creatorName = profileData?.full_name ?? null
    const clientData = appt.clients
      ? (Array.isArray(appt.clients) ? appt.clients[0] : appt.clients)
      : null

    return (
      <Card className={showActions ? 'border-amber-200 dark:border-amber-800' : ''}>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{TOPIC_LABELS[appt.topic] || appt.topic}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  appt.status === 'confirmed'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30'
                }`}>
                  {appt.status === 'confirmed' ? 'Confirmada' : 'Pendent confirmació'}
                </span>
                {appt.priority === 'urgent' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Urgent</span>
                )}
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {start.date} · {start.time} – {end.time}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {CHANNEL_LABELS[appt.channel] || appt.channel}
                </span>
                {appt.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {appt.location}
                  </span>
                )}
                {creatorName && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Creada per {creatorName}
                  </span>
                )}
                {clientData && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {clientData.name}
                  </span>
                )}
              </div>

              {appt.internal_notes && (
                <p className="text-xs text-muted-foreground bg-muted px-3 py-2 rounded-md italic">
                  &ldquo;{appt.internal_notes}&rdquo;
                </p>
              )}
            </div>
          </div>

          {showActions && (
            <div className="flex gap-2 mt-4 pt-4 border-t">
              {appt.created_by !== currentUserId && (
                <Button
                  size="sm"
                  disabled={loading === appt.id}
                  onClick={() => handleAction(appt.id, 'confirm')}
                  className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  {loading === appt.id ? 'Processant...' : 'Acceptar'}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={loading === appt.id}
                onClick={() => handleAction(appt.id, 'reject')}
                className="flex items-center gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
              >
                <XCircle className="h-3.5 w-3.5" />
                {appt.created_by === currentUserId ? 'Cancel·lar' : 'Rebutjar'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const activeAppts = localAppts.filter(a => !['cancelled', 'rejected'].includes(a.status))

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Les meves cites</h1>
        <p className="text-muted-foreground mt-1">Gestiona les cites assignades a tu</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <span className="bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">{pending.length}</span>
            Pendents de confirmació
          </h2>
          {pending.map(appt => (
            <AppointmentCard key={appt.id} appt={appt} showActions={true} />
          ))}
        </section>
      )}

      {confirmed.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Confirmades</h2>
          {confirmed.map(appt => (
            <AppointmentCard key={appt.id} appt={appt} showActions={false} />
          ))}
        </section>
      )}

      {activeAppts.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">No tens cap cita assignada</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
