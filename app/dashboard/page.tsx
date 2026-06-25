export const dynamic = 'force-dynamic'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { PendingAppointmentsList } from '@/components/features/pending-appointments-list'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Clock, Calendar, Umbrella, Users,
  ChevronRight, AlertCircle, CheckSquare,
  Activity, FileText, TrendingUp
} from 'lucide-react'
import Link from 'next/link'

export const metadata = { title: 'Tauler — Tràmit Economistes' }

const TOPIC_LABELS: Record<string, string> = {
  fiscal: 'Fiscal', labor: 'Laboral', accounting: 'Comptable',
  income_tax: 'Renda', freelance: 'Autònoms', companies: 'Societats',
  internal_meeting: 'Reunió interna', client_query: 'Consulta client',
  documentation: 'Documentació', other: 'Altre',
}

const MONTHS_CA = ['gen', 'feb', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'des']

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return `${d.getDate()} ${MONTHS_CA[d.getMonth()]}`
}
function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getDate()} ${MONTHS_CA[d.getMonth()]} · ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}h`
}
function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bon dia'
  if (h < 19) return 'Bona tarda'
  return 'Bona nit'
}

export default async function DashboardPage() {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]
  const currentYear = new Date().getFullYear()
  const in30Days = new Date()
  in30Days.setDate(in30Days.getDate() + 30)

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles').select('full_name').eq('id', user!.id).single()

  const [
    { data: pendingVacations, count: pendingVacationsCount },
    { count: todayAppointmentsCount },
    { data: vacancesAvui },
    { count: totalWorkers },
    { count: totalClients },
    { data: pendingTasks, count: pendingTasksCount },
    { data: upcomingDeadlines },
    { data: recentAppointments },
    { data: lowBalances },
    { data: pendingAttendeesRaw },
  ] = await Promise.all([
    supabase.from('absence_requests')
      .select('id, type, start_date, end_date, working_days, profiles!absence_requests_user_id_fkey(full_name, color)', { count: 'exact' })
      .eq('status', 'pending').eq('type', 'vacation')
      .order('created_at', { ascending: true }).limit(5),
    supabase.from('appointments').select('*', { count: 'exact', head: true })
      .gte('start_time', `${today}T00:00:00`)
      .lte('start_time', `${today}T23:59:59`)
      .neq('status', 'cancelled'),
    supabase.from('absence_requests')
      .select('id, profiles!absence_requests_user_id_fkey(full_name, color)')
      .eq('status', 'approved').eq('type', 'vacation')
      .lte('start_date', today).gte('end_date', today),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'worker').eq('active', true),
    supabase.from('clients').select('*', { count: 'exact', head: true }),
    supabase.from('tasks').select('id, title, priority, due_date, profiles!tasks_assigned_to_fkey(full_name)', { count: 'exact' })
      .in('status', ['pending', 'in_progress'])
      .order('due_date', { ascending: true, nullsFirst: false }).limit(5),
    supabase.from('fiscal_deadlines')
      .select('id, name, model, date, is_critical')
      .gte('date', today)
      .lte('date', in30Days.toISOString().split('T')[0])
      .order('date').limit(5),
    supabase.from('appointments')
      .select('id, start_time, topic, status, main_attendee_id, profiles!appointments_main_attendee_id_fkey(full_name, color)')
      .gte('start_time', `${today}T00:00:00`)
      .neq('status', 'cancelled')
      .order('start_time').limit(8),
    supabase.from('vacation_balances')
      .select('*, profiles!vacation_balances_user_id_fkey(full_name, color)')
      .eq('year', currentYear)
      .order('used_days', { ascending: false }).limit(5),
    createServiceClient()
      .from('appointment_attendees')
      .select(`
        status,
        appointments (
          id,
          start_time,
          end_time,
          topic,
          channel,
          status,
          created_by,
          profiles!appointments_created_by_fkey (full_name, color)
        )
      `)
      .eq('user_id', user!.id)
      .eq('status', 'pending'),
  ])

  const pendingMeetingRequests = (pendingAttendeesRaw || [])
    .map((att: any) => att.appointments)
    .filter((apt: any) => apt !== null && apt.status === 'pending' && apt.created_by !== user!.id)

  function getColor(profiles: unknown): string {
    if (!profiles) return '#94a3b8'
    const p = Array.isArray(profiles) ? profiles[0] : profiles
    return (p as { color?: string })?.color || '#94a3b8'
  }
  function getName(profiles: unknown): string {
    if (!profiles) return '—'
    const p = Array.isArray(profiles) ? profiles[0] : profiles
    return (p as { full_name?: string })?.full_name || '—'
  }

  const PRIORITY_STYLES: Record<string, string> = {
    urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30',
    high: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30',
    normal: 'bg-slate-100 text-slate-600 dark:bg-slate-800',
    low: 'bg-green-100 text-green-700 dark:bg-green-900/30',
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold">
          {getGreeting()}, {profile?.full_name?.split(' ')[0] || 'Marina'} 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          {new Date().toLocaleDateString('ca-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/dashboard/vacances">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Sol·licituds pendents</p>
                  <p className="text-2xl font-bold mt-1">{pendingVacationsCount || 0}</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Umbrella className="h-5 w-5 text-amber-600" />
                </div>
              </div>
              {(pendingVacationsCount || 0) > 0 && (
                <p className="text-xs text-amber-600 mt-2 font-medium">Requereix atenció</p>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/agenda">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Cites avui</p>
                  <p className="text-2xl font-bold mt-1">{todayAppointmentsCount || 0}</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/clients">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total clients</p>
                  <p className="text-2xl font-bold mt-1">{totalClients || 0}</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Users className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">De vacances avui</p>
                <p className="text-2xl font-bold mt-1">{vacancesAvui?.length || 0}</p>
                <p className="text-xs text-muted-foreground">de {totalWorkers || 0} treballadors</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Activity className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Vacations + Tasks */}
        <div className="lg:col-span-2 space-y-6">
          {/* Pending Meeting Requests */}
          <PendingAppointmentsList appointments={pendingMeetingRequests} />

          {/* Pending Vacations */}
          {(pendingVacationsCount || 0) > 0 && (
            <Card className="border-amber-200 dark:border-amber-800">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Umbrella className="h-4 w-4 text-amber-500" />
                    Sol·licituds de vacances pendents
                    <span className="bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5 font-medium">
                      {pendingVacationsCount}
                    </span>
                  </CardTitle>
                  <Link href="/dashboard/vacances" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                    Veure totes <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {pendingVacations?.map(req => (
                  <div key={req.id} className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10">
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ backgroundColor: getColor(req.profiles) }}
                    >
                      {getName(req.profiles).split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{getName(req.profiles)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(req.start_date)} → {formatDate(req.end_date)} · {req.working_days} dies
                      </p>
                    </div>
                    <Link
                      href="/dashboard/vacances"
                      className="text-xs bg-tramit-blue text-white px-2.5 py-1 rounded-md hover:bg-tramit-blue/90 transition-colors shrink-0"
                    >
                      Gestionar
                    </Link>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Today's Appointments */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-500" />
                  Agenda d&apos;avui
                </CardTitle>
                <Link href="/dashboard/agenda" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                  Obrir agenda <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {(!recentAppointments || recentAppointments.length === 0) ? (
                <div className="text-center py-8">
                  <Calendar className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">Sense cites avui</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentAppointments.map(appt => (
                    <div key={appt.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div
                        className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: getColor(appt.profiles) }}
                      >
                        {getName(appt.profiles).split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0,2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{TOPIC_LABELS[appt.topic] || appt.topic}</p>
                        <p className="text-xs text-muted-foreground">{getName(appt.profiles)} · {formatDateTime(appt.start_time)}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        appt.status === 'confirmed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30' :
                        'bg-amber-100 text-amber-700 dark:bg-amber-900/30'
                      }`}>
                        {appt.status === 'confirmed' ? 'Confirmada' : 'Pendent'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Tasks */}
          {(pendingTasksCount || 0) > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-purple-500" />
                    Tasques pendents
                    <span className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 text-xs rounded-full px-1.5 py-0.5">
                      {pendingTasksCount}
                    </span>
                  </CardTitle>
                  <Link href="/dashboard/tasques" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                    Veure totes <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {pendingTasks?.map(task => (
                  <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {getName(task.profiles)}
                        {task.due_date ? ` · Venciment: ${formatDate(task.due_date)}` : ''}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                      PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.normal
                    }`}>
                      {task.priority}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Who's on vacation today */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Umbrella className="h-4 w-4 text-purple-500" />
                Avui de vacances
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {(!vacancesAvui || vacancesAvui.length === 0) ? (
                <p className="text-sm text-muted-foreground text-center py-4">Tots els treballadors disponibles ✅</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {vacancesAvui.map(abs => (
                    <div key={abs.id} className="flex items-center gap-1.5 bg-purple-50 dark:bg-purple-900/20 px-2.5 py-1.5 rounded-full">
                      <div
                        className="h-5 w-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                        style={{ backgroundColor: getColor(abs.profiles) }}
                      >
                        {getName(abs.profiles).split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)}
                      </div>
                      <span className="text-xs font-medium">{getName(abs.profiles).split(' ')[0]}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fiscal Deadlines */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-red-500" />
                Terminis fiscals (30 dies)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {(!upcomingDeadlines || upcomingDeadlines.length === 0) ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sense terminis propers</p>
              ) : (
                <div className="space-y-2">
                  {upcomingDeadlines.map(deadline => {
                    const daysUntil = Math.ceil(
                      (new Date(deadline.date + 'T12:00:00').getTime() - new Date().setHours(0,0,0,0)) / 86400000
                    )
                    return (
                      <div key={deadline.id} className={`flex items-start gap-3 p-2.5 rounded-lg ${
                        deadline.is_critical ? 'bg-red-50 dark:bg-red-900/10' : 'bg-muted/50'
                      }`}>
                        <div className={`text-center shrink-0 w-12 rounded-md p-1 ${
                          deadline.is_critical ? 'bg-red-100 dark:bg-red-900/30' : 'bg-slate-100 dark:bg-slate-800'
                        }`}>
                          <p className="text-[10px] text-muted-foreground uppercase">{formatDate(deadline.date).split(' ')[1]}</p>
                          <p className="text-sm font-bold">{formatDate(deadline.date).split(' ')[0]}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium leading-tight">{deadline.name}</p>
                          {deadline.model && <p className="text-[10px] text-muted-foreground">{deadline.model}</p>}
                          <p className={`text-[10px] font-medium mt-0.5 ${
                            daysUntil <= 7 ? 'text-red-500' : daysUntil <= 14 ? 'text-amber-500' : 'text-muted-foreground'
                          }`}>
                            {daysUntil === 0 ? 'Avui!' : daysUntil === 1 ? 'Demà' : `${daysUntil} dies`}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vacation balances */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  Saldos de vacances
                </CardTitle>
                <Link href="/dashboard/vacances" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                  Gestionar <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {lowBalances?.map(bal => {
                const remaining = bal.total_days - bal.used_days
                const pct = bal.total_days > 0 ? Math.round((bal.used_days / bal.total_days) * 100) : 0
                return (
                  <div key={bal.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium">{getName(bal.profiles)}</p>
                      <p className="text-xs text-muted-foreground">{remaining}/{bal.total_days} dies</p>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-amber-500' : 'bg-tramit-blue'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
