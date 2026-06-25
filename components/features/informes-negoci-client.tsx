'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Download, Users, Calendar, TrendingUp,
  CheckSquare, BarChart3, FileText, Umbrella,
  ArrowUpRight, ArrowDownRight, Minus, Timer,
  Euro, Target, AlertCircle
} from 'lucide-react'

interface Balance { user_id: string; total_days: number; used_days: number; pending_days: number; profiles?: { full_name: string; email: string } | null }
interface Request { id: string; user_id: string; type: string; start_date: string; end_date: string; working_days: number; status: string; profiles?: { full_name: string; email: string } | null }
interface Profile { id: string; full_name: string; email: string }
interface Client { id: string; name: string; status: string; client_type: string; created_at: string; estimated_value: number | null; last_contact_at: string | null }
interface Appointment { id: string; topic: string; status: string; start_time: string; main_attendee_id: string }
interface Task { id: string; status: string; priority: string; assigned_to: string | null; created_at: string; done_at: string | null; client_id: string | null }
interface Quote { id: string; amount: number; tax_rate: number; status: string; created_at: string; client_id: string }
interface TimeEntry { id: string; task_id: string; user_id: string; client_id: string | null; minutes: number; date: string }
interface Expedient { id: string; client_id: string; type: string; status: string; year: number; responsible_id: string | null }

interface Props {
  balances: Balance[]; requests: Request[]; profiles: Profile[]
  clients: Client[]; appointments: Appointment[]; tasks: Task[]
  quotes: Quote[]; timeEntries: TimeEntry[]; expedients: Expedient[]
  currentYear: number
}

const MONTHS_CA = ['Gen','Feb','Mar','Abr','Mai','Jun','Jul','Ago','Set','Oct','Nov','Des']

function getName(profiles: Balance['profiles']): string {
  if (!profiles) return '—'
  if (Array.isArray(profiles)) return (profiles as { full_name: string }[])[0]?.full_name || '—'
  return (profiles as { full_name: string }).full_name || '—'
}
function getEmail(profiles: Balance['profiles']): string {
  if (!profiles) return '—'
  if (Array.isArray(profiles)) return (profiles as { email: string }[])[0]?.email || '—'
  return (profiles as { email: string }).email || '—'
}

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers.map(h => `"${h}"`).join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename + '.csv'; a.click()
  URL.revokeObjectURL(url)
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60); const m = min % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

type TabId = 'resum' | 'equip' | 'clients' | 'financer' | 'temps' | 'expedients'

export function InformesNegociClient({ balances, requests, profiles, clients, appointments, tasks, quotes, timeEntries, expedients, currentYear }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('resum')
  const [filterProfile, setFilterProfile] = useState('')

  // ── Estadístiques globals ──
  const stats = useMemo(() => {
    const activeClients = clients.filter(c => c.status === 'active').length
    const inactiveClients = clients.filter(c => c.status === 'inactive').length
    const newClientsThisYear = clients.filter(c => c.created_at?.startsWith(String(currentYear))).length
    const totalQuoted = quotes.filter(q => q.status !== 'draft').reduce((s, q) => s + q.amount, 0)
    const totalPaid = quotes.filter(q => q.status === 'paid').reduce((s, q) => s + q.amount * (1 + q.tax_rate / 100), 0)
    const totalPending = quotes.filter(q => ['sent','accepted','invoiced'].includes(q.status)).reduce((s, q) => s + q.amount, 0)
    const doneTasks = tasks.filter(t => t.status === 'done').length
    const totalTasks = tasks.length
    const totalMinutes = timeEntries.reduce((s, e) => s + e.minutes, 0)
    const pendingRequests = requests.filter(r => r.status === 'pending').length
    const doneExpedients = expedients.filter(e => e.status === 'done').length

    return { activeClients, inactiveClients, newClientsThisYear, totalQuoted, totalPaid, totalPending, doneTasks, totalTasks, totalMinutes, pendingRequests, doneExpedients }
  }, [clients, quotes, tasks, timeEntries, requests, expedients, currentYear])

  // ── Facturació per mes ──
  const billingByMonth = useMemo(() => {
    const months = Array(12).fill(0)
    quotes.filter(q => q.status === 'paid' && q.created_at?.startsWith(String(currentYear))).forEach(q => {
      const m = new Date(q.created_at).getMonth()
      months[m] += q.amount * (1 + q.tax_rate / 100)
    })
    return months
  }, [quotes, currentYear])

  const maxBilling = Math.max(1, ...billingByMonth)

  // ── Temps per treballador ──
  const timeByUser = useMemo(() => {
    const map: Record<string, number> = {}
    timeEntries.forEach(e => { map[e.user_id] = (map[e.user_id] || 0) + e.minutes })
    return Object.entries(map).map(([userId, minutes]) => {
      const profile = profiles.find(p => p.id === userId)
      return { userId, name: profile?.full_name || '—', minutes }
    }).sort((a, b) => b.minutes - a.minutes)
  }, [timeEntries, profiles])

  // ── Temps per client ──
  const timeByClient = useMemo(() => {
    const map: Record<string, number> = {}
    timeEntries.filter(e => e.client_id).forEach(e => {
      map[e.client_id!] = (map[e.client_id!] || 0) + e.minutes
    })
    return Object.entries(map).map(([clientId, minutes]) => {
      const client = clients.find(c => c.id === clientId)
      const revenue = quotes.filter(q => q.client_id === clientId && q.status === 'paid').reduce((s, q) => s + q.amount * (1 + q.tax_rate / 100), 0)
      return { clientId, name: client?.name || '—', minutes, revenue }
    }).sort((a, b) => b.minutes - a.minutes).slice(0, 10)
  }, [timeEntries, clients, quotes])

  // ── Expedients per estat ──
  const expedientsByStatus = useMemo(() => {
    const map: Record<string, number> = {}
    expedients.forEach(e => { map[e.status] = (map[e.status] || 0) + 1 })
    return map
  }, [expedients])

  const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'resum',      label: 'Resum',       icon: BarChart3 },
    { id: 'equip',      label: 'Equip',        icon: Users },
    { id: 'clients',    label: 'Clients',      icon: Users },
    { id: 'financer',   label: 'Financer',     icon: Euro },
    { id: 'temps',      label: 'Temps',        icon: Timer },
    { id: 'expedients', label: 'Expedients',   icon: FileText },
  ]

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Informes</h1>
        <p className="text-muted-foreground mt-1 text-sm">Dades i exportacions · Any {currentYear}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit flex-wrap">
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}>
              <Icon className="h-3.5 w-3.5" />{tab.label}
            </button>
          )
        })}
      </div>

      {/* ── RESUM ── */}
      {activeTab === 'resum' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Clients actius', value: stats.activeClients, icon: Users, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
              { label: 'Nous aquest any', value: stats.newClientsThisYear, icon: ArrowUpRight, color: 'text-tramit-blue', bg: 'bg-tramit-blue-light dark:bg-blue-900/20' },
              { label: 'Facturats (cobrat)', value: `${stats.totalPaid.toLocaleString('ca-ES', { maximumFractionDigits: 0 })}€`, icon: Euro, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
              { label: 'Hores registrades', value: formatMinutes(stats.totalMinutes), icon: Timer, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
            ].map(s => {
              const Icon = s.icon
              return (
                <Card key={s.label}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                        <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                      </div>
                      <div className={`p-2 rounded-lg ${s.bg}`}><Icon className={`h-4 w-4 ${s.color}`} /></div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Gràfic de barres facturació per mes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-tramit-blue" />
                Facturació mensual {currentYear} (pressupostos cobrats)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.totalPaid === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sense pressupostos cobrats aquest any</p>
              ) : (
                <div className="flex items-end gap-1.5 h-32">
                  {billingByMonth.map((amount, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full rounded-t-sm transition-all"
                        style={{ height: `${(amount / maxBilling) * 100}%`, minHeight: amount > 0 ? '4px' : '0', backgroundColor: amount > 0 ? '#2272A3' : 'transparent' }}
                        title={`${MONTHS_CA[i]}: ${amount.toLocaleString('ca-ES', { maximumFractionDigits: 0 })}€`}
                      />
                      <span className="text-[9px] text-muted-foreground">{MONTHS_CA[i]}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Alertes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Sol·licituds pendents d\'aprovació', value: stats.pendingRequests, urgent: stats.pendingRequests > 0 },
              { label: 'Pressupostos pendents de cobrar', value: `${stats.totalPending.toLocaleString('ca-ES', { maximumFractionDigits: 0 })}€`, urgent: stats.totalPending > 0 },
              { label: 'Clients inactius', value: stats.inactiveClients, urgent: false },
            ].map(a => (
              <Card key={a.label} className={a.urgent ? 'border-amber-200 dark:border-amber-800' : ''}>
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center gap-2">
                    {a.urgent && <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />}
                    <div>
                      <p className="text-xl font-bold">{a.value}</p>
                      <p className="text-xs text-muted-foreground leading-tight">{a.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── EQUIP ── */}
      {activeTab === 'equip' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => downloadCSV(
              `vacances-${currentYear}`,
              ['Treballador', 'Email', 'Dies totals', 'Usats', 'Pendents', 'Restants'],
              balances.map(b => [getName(b.profiles), getEmail(b.profiles), b.total_days, b.used_days, b.pending_days, b.total_days - b.used_days])
            )} className="flex items-center gap-1.5">
              <Download className="h-3.5 w-3.5" />Exportar CSV
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      {['Treballador','Total','Usats','Pendents','Restants','% Usat'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {balances.map(b => {
                      const remaining = b.total_days - b.used_days
                      const pct = b.total_days > 0 ? Math.round((b.used_days / b.total_days) * 100) : 0
                      return (
                        <tr key={b.user_id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium">{getName(b.profiles)}</td>
                          <td className="px-4 py-3 text-center">{b.total_days}</td>
                          <td className="px-4 py-3 text-center text-tramit-blue font-semibold">{b.used_days}</td>
                          <td className="px-4 py-3 text-center">{b.pending_days > 0 ? <span className="text-amber-600">{b.pending_days}</span> : '—'}</td>
                          <td className="px-4 py-3 text-center"><span className={remaining <= 3 ? 'text-red-500 font-bold' : 'text-green-600 font-bold'}>{remaining}</span></td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-tramit-blue rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground w-8">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Absències */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Historial d&apos;absències</CardTitle>
                <Button variant="outline" size="sm" onClick={() => downloadCSV(
                  `absencies-${currentYear}`,
                  ['Treballador', 'Tipus', 'Inici', 'Fi', 'Dies', 'Estat'],
                  requests.map(r => [getName(r.profiles), r.type, r.start_date, r.end_date, r.working_days, r.status])
                )} className="flex items-center gap-1.5">
                  <Download className="h-3.5 w-3.5" />CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      {['Treballador','Tipus','Inici','Fi','Dies','Estat'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {requests.slice(0, 20).map(r => (
                      <tr key={r.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2.5">{getName(r.profiles)}</td>
                        <td className="px-4 py-2.5 capitalize">{r.type === 'vacation' ? 'Vacances' : r.type === 'sick_leave' ? 'Baixa' : 'Permís'}</td>
                        <td className="px-4 py-2.5 text-xs">{r.start_date}</td>
                        <td className="px-4 py-2.5 text-xs">{r.end_date}</td>
                        <td className="px-4 py-2.5 text-center">{r.working_days}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            r.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/20' :
                            r.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/20' :
                            'bg-amber-100 text-amber-700 dark:bg-amber-900/20'
                          }`}>{r.status === 'approved' ? 'Aprovada' : r.status === 'rejected' ? 'Rebutjada' : 'Pendent'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── CLIENTS ── */}
      {activeTab === 'clients' && (
        <div className="space-y-4">
          {/* KPIs clients */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total', value: clients.length },
              { label: 'Actius', value: clients.filter(c => c.status === 'active').length },
              { label: 'Leads/Prospectes', value: clients.filter(c => ['lead','prospect'].includes(c.status)).length },
              { label: 'Inactius / Baixes', value: clients.filter(c => ['inactive','blocked'].includes(c.status)).length },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className="pt-3 pb-3 text-center">
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Taula clients */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">Llistat de clients</CardTitle>
                <Button variant="outline" size="sm" onClick={() => downloadCSV(
                  `clients-${currentYear}`,
                  ['Nom','Tipus','Estat','Alta','Dies sense contacte'],
                  clients.map(c => [
                    c.name, c.client_type, c.status,
                    new Date(c.created_at).toLocaleDateString('ca-ES'),
                    c.last_contact_at ? Math.floor((Date.now() - new Date(c.last_contact_at).getTime()) / 86400000) : 'Mai'
                  ])
                )} className="flex items-center gap-1.5">
                  <Download className="h-3.5 w-3.5" />CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      {['Client','Tipus','Estat','Alta','Últim contacte'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {clients.map(c => {
                      const daysSince = c.last_contact_at ? Math.floor((Date.now() - new Date(c.last_contact_at).getTime()) / 86400000) : null
                      return (
                        <tr key={c.id} className="hover:bg-muted/30">
                          <td className="px-4 py-2.5 font-medium">{c.name}</td>
                          <td className="px-4 py-2.5 text-xs capitalize">{c.client_type}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              c.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/20' :
                              c.status === 'inactive' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/20' :
                              'bg-slate-100 text-slate-600 dark:bg-slate-800'
                            }`}>{c.status === 'active' ? 'Actiu' : c.status === 'inactive' ? 'Inactiu' : c.status}</span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString('ca-ES')}</td>
                          <td className="px-4 py-2.5 text-xs">
                            {daysSince !== null ? (
                              <span className={daysSince > 90 ? 'text-amber-600 font-medium' : 'text-muted-foreground'}>
                                Fa {daysSince} dies{daysSince > 90 ? ' ⚠️' : ''}
                              </span>
                            ) : <span className="text-muted-foreground">Mai</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── FINANCER ── */}
      {activeTab === 'financer' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: 'Total facturat (base)', value: `${stats.totalQuoted.toLocaleString('ca-ES', { maximumFractionDigits: 0 })}€`, color: 'text-tramit-blue' },
              { label: 'Cobrat (amb IVA)', value: `${stats.totalPaid.toLocaleString('ca-ES', { maximumFractionDigits: 0 })}€`, color: 'text-green-600' },
              { label: 'Pendent de cobrar', value: `${stats.totalPending.toLocaleString('ca-ES', { maximumFractionDigits: 0 })}€`, color: 'text-amber-600' },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className="pt-4 pb-4 text-center">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Gràfic barres per mes */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Facturació per mes</CardTitle>
                <Button variant="outline" size="sm" onClick={() => downloadCSV(
                  `facturacio-${currentYear}`,
                  ['Mes', 'Import cobrat (€)'],
                  billingByMonth.map((a, i) => [MONTHS_CA[i], a.toFixed(2)])
                )} className="flex items-center gap-1.5">
                  <Download className="h-3.5 w-3.5" />CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-1.5 h-40 mb-2">
                {billingByMonth.map((amount, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] text-muted-foreground">
                      {amount > 0 ? `${(amount / 1000).toFixed(0)}k` : ''}
                    </span>
                    <div className="w-full rounded-t-md transition-all hover:opacity-80"
                      style={{ height: `${Math.max((amount / maxBilling) * 100, amount > 0 ? 5 : 0)}%`, backgroundColor: amount > 0 ? '#2272A3' : '#e2e8f0' }}
                      title={`${MONTHS_CA[i]}: ${amount.toLocaleString('ca-ES', { maximumFractionDigits: 0 })}€`}
                    />
                    <span className="text-[9px] text-muted-foreground">{MONTHS_CA[i]}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Llistat pressupostos */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">Pressupostos {currentYear}</CardTitle>
                <Button variant="outline" size="sm" onClick={() => downloadCSV(
                  `pressupostos-${currentYear}`,
                  ['Data','Import','IVA%','Total','Estat','Client'],
                  quotes.map(q => [
                    new Date(q.created_at).toLocaleDateString('ca-ES'),
                    q.amount.toFixed(2), q.tax_rate,
                    (q.amount * (1 + q.tax_rate / 100)).toFixed(2),
                    q.status,
                    clients.find(c => c.id === q.client_id)?.name || '—'
                  ])
                )} className="flex items-center gap-1.5">
                  <Download className="h-3.5 w-3.5" />CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      {['Data','Client','Base','IVA','Total','Estat'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {quotes.map(q => {
                      const client = clients.find(c => c.id === q.client_id)
                      const total = q.amount * (1 + q.tax_rate / 100)
                      return (
                        <tr key={q.id} className="hover:bg-muted/30">
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{new Date(q.created_at).toLocaleDateString('ca-ES')}</td>
                          <td className="px-4 py-2.5 font-medium">{client?.name || '—'}</td>
                          <td className="px-4 py-2.5">{q.amount.toLocaleString('ca-ES')}€</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{q.tax_rate}%</td>
                          <td className="px-4 py-2.5 font-semibold text-tramit-blue">{total.toLocaleString('ca-ES', { maximumFractionDigits: 2 })}€</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              q.status === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/20' :
                              q.status === 'accepted' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20' :
                              q.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/20' :
                              'bg-slate-100 text-slate-600 dark:bg-slate-800'
                            }`}>{q.status === 'paid' ? 'Cobrat' : q.status === 'accepted' ? 'Acceptat' : q.status === 'rejected' ? 'Rebutjat' : q.status}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── TEMPS ── */}
      {activeTab === 'temps' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card><CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold text-purple-600">{formatMinutes(stats.totalMinutes)}</p>
              <p className="text-xs text-muted-foreground">Total registrat</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold">{timeByUser.length}</p>
              <p className="text-xs text-muted-foreground">Treballadors amb temps registrat</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold">{timeByClient.length}</p>
              <p className="text-xs text-muted-foreground">Clients amb hores assignades</p>
            </CardContent></Card>
          </div>

          {/* Per treballador */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Hores per treballador</CardTitle>
                <Button variant="outline" size="sm" onClick={() => downloadCSV(
                  `temps-treballadors-${currentYear}`,
                  ['Treballador', 'Hores', 'Minuts'],
                  timeByUser.map(u => [u.name, Math.floor(u.minutes / 60), u.minutes % 60])
                )} className="flex items-center gap-1.5">
                  <Download className="h-3.5 w-3.5" />CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {timeByUser.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sense temps registrat</p>
              ) : timeByUser.map(u => (
                <div key={u.userId} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{u.name}</span>
                    <span className="text-muted-foreground">{formatMinutes(u.minutes)}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full"
                      style={{ width: `${(u.minutes / (timeByUser[0]?.minutes || 1)) * 100}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Per client — rendibilitat */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Hores per client (top 10)</CardTitle>
                <Button variant="outline" size="sm" onClick={() => downloadCSV(
                  `temps-clients-${currentYear}`,
                  ['Client', 'Hores', 'Facturats (€)', '€/h estimat'],
                  timeByClient.map(c => [
                    c.name, formatMinutes(c.minutes), c.revenue.toFixed(2),
                    c.minutes > 0 ? (c.revenue / (c.minutes / 60)).toFixed(2) : '—'
                  ])
                )} className="flex items-center gap-1.5">
                  <Download className="h-3.5 w-3.5" />CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      {['Client','Hores dedicades','Facturat (cobrat)','€/h estimat'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {timeByClient.map(c => {
                      const hourlyRate = c.minutes > 0 ? c.revenue / (c.minutes / 60) : 0
                      return (
                        <tr key={c.clientId} className="hover:bg-muted/30">
                          <td className="px-4 py-2.5 font-medium">{c.name}</td>
                          <td className="px-4 py-2.5">{formatMinutes(c.minutes)}</td>
                          <td className="px-4 py-2.5 text-green-600 font-medium">{c.revenue > 0 ? `${c.revenue.toLocaleString('ca-ES', { maximumFractionDigits: 0 })}€` : '—'}</td>
                          <td className="px-4 py-2.5">
                            {hourlyRate > 0 ? (
                              <span className={hourlyRate < 30 ? 'text-red-500' : hourlyRate < 60 ? 'text-amber-500' : 'text-green-600'}>
                                {hourlyRate.toFixed(0)}€/h
                              </span>
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── EXPEDIENTS ── */}
      {activeTab === 'expedients' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total', value: expedients.length },
              { label: 'En curs', value: expedients.filter(e => e.status === 'in_progress').length },
              { label: 'Esperant client', value: expedients.filter(e => e.status === 'waiting_client').length },
              { label: 'Completats', value: expedients.filter(e => e.status === 'done').length },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className="pt-3 pb-3 text-center">
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Expedients {currentYear}</CardTitle>
                <Button variant="outline" size="sm" onClick={() => downloadCSV(
                  `expedients-${currentYear}`,
                  ['Client','Tipus','Estat','Any'],
                  expedients.map(e => [
                    clients.find(c => c.id === e.client_id)?.name || '—',
                    e.type, e.status, e.year
                  ])
                )} className="flex items-center gap-1.5">
                  <Download className="h-3.5 w-3.5" />CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      {['Client','Tipus','Estat','Responsable'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {expedients.map(e => {
                      const client = clients.find(c => c.id === e.client_id)
                      const responsible = profiles.find(p => p.id === e.responsible_id)
                      return (
                        <tr key={e.id} className="hover:bg-muted/30">
                          <td className="px-4 py-2.5 font-medium">{client?.name || '—'}</td>
                          <td className="px-4 py-2.5 text-xs capitalize">{e.type}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              e.status === 'done' ? 'bg-green-100 text-green-700 dark:bg-green-900/20' :
                              e.status === 'in_progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20' :
                              e.status === 'waiting_client' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/20' :
                              'bg-slate-100 text-slate-600 dark:bg-slate-800'
                            }`}>{e.status === 'done' ? 'Completat' : e.status === 'in_progress' ? 'En curs' : e.status === 'waiting_client' ? 'Esperant client' : e.status}</span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{responsible?.full_name.split(' ')[0] || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
