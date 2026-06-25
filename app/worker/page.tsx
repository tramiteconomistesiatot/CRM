export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getGreeting } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Calendar, Clock, Users, MessageSquare,
  ChevronRight, Plus, Umbrella, AlertCircle,
  CheckCircle, ArrowRight
} from 'lucide-react'
import Link from 'next/link'

export const metadata = { title: 'Inici — Tràmit Economistes' }

const TOPIC_LABELS: Record<string, string> = {
  fiscal: 'Fiscal', labor: 'Laboral', accounting: 'Comptable',
  income_tax: 'Renda', freelance: 'Autònoms', companies: 'Societats',
  internal_meeting: 'Reunió interna', client_query: 'Consulta client',
  documentation: 'Documentació', other: 'Altre',
}

const CHANNEL_LABELS: Record<string, string> = {
  in_person: 'Presencial', phone: 'Telèfon', video: 'Videotrucada',
  email: 'Email', other: 'Altre',
}

const PRIORITY_STYLES: Record<string, string> = {
  normal: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  high: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

export default async function WorkerPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, color')
    .eq('id', user!.id)
    .single()

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const tomorrowStr = new Date(today.getTime() + 86400000).toISOString().split('T')[0]
  const currentYear = today.getFullYear()

  // Cites d'avui
  const { data: todayCites } = await supabase
    .from('appointments')
    .select('*, clients(name, company)')
    .eq('main_attendee_id', user!.id)
    .gte('start_time', `${todayStr}T00:00:00`)
    .lte('start_time', `${todayStr}T23:59:59`)
    .neq('status', 'cancelled')
    .order('start_time', { ascending: true })

  // Cites de demà
  const { data: tomorrowCites } = await supabase
    .from('appointments')
    .select('*, clients(name, company)')
    .eq('main_attendee_id', user!.id)
    .gte('start_time', `${tomorrowStr}T00:00:00`)
    .lte('start_time', `${tomorrowStr}T23:59:59`)
    .neq('status', 'cancelled')
    .order('start_time', { ascending: true })

  // Properes cites (resta de la setmana)
  const weekEnd = new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0]
  const { data: upcomingCites } = await supabase
    .from('appointments')
    .select('*, clients(name, company)')
    .eq('main_attendee_id', user!.id)
    .gt('start_time', `${tomorrowStr}T23:59:59`)
    .lte('start_time', `${weekEnd}T23:59:59`)
    .neq('status', 'cancelled')
    .order('start_time', { ascending: true })
    .limit(3)

  // Missatges no llegits
  const { count: unreadMessages } = await supabase
    .from('internal_messages')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', user!.id)
    .eq('read', false)

  // Notificacions no llegides
  const { count: unreadNotifs } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user!.id)
    .eq('read', false)

  // Saldo vacances
  const { data: balance } = await supabase
    .from('vacation_balances')
    .select('total_days, used_days, pending_days')
    .eq('user_id', user!.id)
    .eq('year', currentYear)
    .single()

  // Sol·licituds pendents
  const { data: pendingRequests } = await supabase
    .from('absence_requests')
    .select('id, type, start_date, end_date, status')
    .eq('user_id', user!.id)
    .eq('status', 'pending')

  // Qui no hi és avui
  const { data: absentToday } = await supabase
    .from('absence_requests')
    .select('*, profiles!absence_requests_user_id_fkey(full_name, color)')
    .eq('status', 'approved')
    .lte('start_date', todayStr)
    .gte('end_date', todayStr)
    .neq('user_id', user!.id)

  // Terminis fiscals del mes
  const { data: fiscalDeadlines } = await supabase
    .from('fiscal_deadlines')
    .select('*')
    .gte('date', todayStr)
    .lte('date', new Date(today.getFullYear(), today.getMonth() + 1, 20).toISOString().split('T')[0])
    .order('date', { ascending: true })
    .limit(4)

  const greeting = getGreeting()
  const firstName = profile?.full_name?.split(' ')[0] || ''
  const remaining = balance ? balance.total_days - balance.used_days : 0

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Salutació */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{greeting}, {firstName} 👋</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {today.toLocaleDateString('ca-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(unreadMessages || 0) > 0 && (
            <Link href="/worker/missatges">
              <div className="flex items-center gap-1.5 bg-tramit-blue text-white px-3 py-1.5 rounded-full text-xs font-medium">
                <MessageSquare className="h-3.5 w-3.5" />
                {unreadMessages} missatge{(unreadMessages || 0) > 1 ? 's' : ''} nou{(unreadMessages || 0) > 1 ? 's' : ''}
              </div>
            </Link>
          )}
          {(pendingRequests?.length || 0) > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-3 py-1.5 rounded-full text-xs font-medium">
              <AlertCircle className="h-3.5 w-3.5" />
              {pendingRequests?.length} sol·licitud{(pendingRequests?.length || 0) > 1 ? 's' : ''} pendent{(pendingRequests?.length || 0) > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* Cites d'avui — PRIORITAT MÀXIMA */}
      <Card className="border-tramit-blue/30 bg-tramit-blue-light/20 dark:bg-blue-900/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-tramit-blue" />
              Cites d&apos;avui
              {(todayCites?.length || 0) > 0 && (
                <span className="bg-tramit-blue text-white text-xs px-2 py-0.5 rounded-full font-bold">
                  {todayCites?.length}
                </span>
              )}
            </CardTitle>
            <Link href="/worker/agenda" className="text-xs text-tramit-blue hover:underline flex items-center gap-1">
              Agenda completa <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {!todayCites || todayCites.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Cap cita programada per avui</p>
              <Link href="/worker/agenda">
                <Button variant="tramit" size="sm" className="mt-3 flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Crear cita
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {todayCites.map((cita: {
                id: string
                start_time: string
                end_time: string
                topic: string
                channel: string
                priority: string
                location: string | null
                clients?: { name: string; company: string | null } | null
              }) => {
                const start = new Date(cita.start_time)
                const end = new Date(cita.end_time)
                const now = new Date()
                const isNow = start <= now && end >= now
                const isPast = end < now

                return (
                  <div
                    key={cita.id}
                    className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${
                      isNow
                        ? 'bg-tramit-blue text-white'
                        : isPast
                        ? 'bg-muted/30 opacity-60'
                        : 'bg-white dark:bg-slate-800 border border-border'
                    }`}
                  >
                    <div className={`text-center shrink-0 ${isNow ? 'text-white' : 'text-tramit-blue'}`}>
                      <p className="text-lg font-bold leading-none">
                        {start.toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-xs opacity-70">
                        {end.toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-semibold ${isNow ? 'text-white' : ''}`}>
                          {TOPIC_LABELS[cita.topic] || cita.topic}
                        </p>
                        {isNow && (
                          <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                            Ara
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          isNow ? 'bg-white/20 text-white' : PRIORITY_STYLES[cita.priority] || PRIORITY_STYLES.normal
                        }`}>
                          {cita.priority === 'urgent' ? 'Urgent' : cita.priority === 'high' ? 'Alta' : 'Normal'}
                        </span>
                      </div>
                      {(cita.clients as { name: string; company: string | null } | null)?.name && (
                        <p className={`text-xs mt-0.5 ${isNow ? 'text-white/80' : 'text-muted-foreground'}`}>
                          👤 {(cita.clients as { name: string; company: string | null }).name}
                          {(cita.clients as { name: string; company: string | null }).company &&
                            ` · ${(cita.clients as { name: string; company: string | null }).company}`}
                        </p>
                      )}
                      <p className={`text-xs mt-0.5 ${isNow ? 'text-white/70' : 'text-muted-foreground'}`}>
                        {CHANNEL_LABELS[cita.channel]}
                        {cita.location && ` · ${cita.location}`}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fila: Demà + Qui no hi és */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Cites de demà */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Demà
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!tomorrowCites || tomorrowCites.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Cap cita per a demà</p>
            ) : (
              <div className="space-y-2">
                {tomorrowCites.map((cita: {
                  id: string
                  start_time: string
                  topic: string
                  channel: string
                  clients?: { name: string } | null
                }) => (
                  <div key={cita.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50">
                    <p className="text-sm font-bold text-tramit-blue shrink-0">
                      {new Date(cita.start_time).toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{TOPIC_LABELS[cita.topic]}</p>
                      {(cita.clients as { name: string } | null)?.name && (
                        <p className="text-xs text-muted-foreground truncate">
                          {(cita.clients as { name: string }).name}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Qui no hi és avui */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Equip avui
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!absentToday || absentToday.length === 0 ? (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 py-2">
                <CheckCircle className="h-4 w-4" />
                <p className="text-sm font-medium">Tot l&apos;equip disponible</p>
              </div>
            ) : (
              <div className="space-y-2">
                {absentToday.map((abs: {
                  id: string
                  type: string
                  end_date: string
                  profiles?: { full_name: string; color: string | null } | null
                }) => {
                  const p = abs.profiles as { full_name: string; color: string | null } | null
                  const color = p?.color || '#64748b'
                  const initials = p?.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?'
                  return (
                    <div key={abs.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/50">
                      <div
                        className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: color }}
                      >
                        {abs.type === 'sick_leave' ? '?' : initials}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {abs.type === 'sick_leave' ? 'No disponible' : p?.full_name || '—'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {abs.type === 'vacation' ? 'Vacances' : 'Absència'} · fins {abs.end_date}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Terminis fiscals */}
      {fiscalDeadlines && fiscalDeadlines.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Propers terminis fiscals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {fiscalDeadlines.map((d: {
                id: string
                date: string
                name: string
                model: string | null
                description: string | null
              }) => {
                const daysLeft = Math.ceil(
                  (new Date(d.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                )
                const isUrgent = daysLeft <= 5
                return (
                  <div key={d.id} className={`flex items-center justify-between p-3 rounded-lg ${
                    isUrgent ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' : 'bg-muted/50'
                  }`}>
                    <div>
                      <p className="text-sm font-medium">{d.name}</p>
                      {d.model && <p className="text-xs text-muted-foreground">Model {d.model}</p>}
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${isUrgent ? 'text-red-600' : 'text-foreground'}`}>
                        {new Date(d.date).toLocaleDateString('ca-ES', { day: 'numeric', month: 'short' })}
                      </p>
                      <p className={`text-xs ${isUrgent ? 'text-red-500' : 'text-muted-foreground'}`}>
                        {daysLeft === 0 ? 'Avui!' : daysLeft === 1 ? 'Demà' : `${daysLeft} dies`}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fila inferior: vacances + properes cites */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Saldo vacances compacte */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Umbrella className="h-4 w-4 text-tramit-blue" />
                <p className="text-sm font-semibold">Vacances {currentYear}</p>
              </div>
              <Link href="/worker/vacances" className="text-xs text-tramit-blue hover:underline flex items-center gap-1">
                Gestionar <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="flex items-end justify-between mb-2">
              <div>
                <p className={`text-3xl font-bold ${remaining <= 3 ? 'text-red-500' : 'text-tramit-blue'}`}>
                  {remaining}
                </p>
                <p className="text-xs text-muted-foreground">dies disponibles</p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>{balance?.used_days || 0} usats</p>
                {(balance?.pending_days || 0) > 0 && (
                  <p className="text-amber-500">{balance?.pending_days} pendents</p>
                )}
              </div>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-tramit-blue transition-all"
                style={{
                  width: `${Math.min(100, ((balance?.used_days || 0) / (balance?.total_days || 1)) * 100)}%`
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Properes cites */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-sm">Aquesta setmana</CardTitle>
          </CardHeader>
          <CardContent>
            {!upcomingCites || upcomingCites.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">Cap cita aquesta setmana</p>
            ) : (
              <div className="space-y-2">
                {upcomingCites.map((cita: {
                  id: string
                  start_time: string
                  topic: string
                  clients?: { name: string } | null
                }) => {
                  const d = new Date(cita.start_time)
                  return (
                    <div key={cita.id} className="flex items-center gap-3">
                      <div className="text-center min-w-[36px]">
                        <p className="text-xs text-muted-foreground">
                          {d.toLocaleDateString('ca-ES', { weekday: 'short' })}
                        </p>
                        <p className="text-sm font-bold">{d.getDate()}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{TOPIC_LABELS[cita.topic]}</p>
                        {(cita.clients as { name: string } | null)?.name && (
                          <p className="text-xs text-muted-foreground truncate">
                            {(cita.clients as { name: string }).name}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Accions ràpides */}
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="tramit" size="sm">
          <Link href="/worker/agenda" className="flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Nova cita
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/worker/missatges" className="flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            Missatges
            {(unreadMessages || 0) > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                {unreadMessages}
              </span>
            )}
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/worker/vacances/nova" className="flex items-center gap-1.5">
            <Umbrella className="h-3.5 w-3.5" />
            Sol·licitar vacances
          </Link>
        </Button>
      </div>
    </div>
  )
}
