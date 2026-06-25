'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Umbrella, ClipboardList, CheckCircle, AlertTriangle,
  Plus, X, ChevronDown, ChevronUp, Users, TrendingUp,
  Pencil, Save, Mail, Phone, Flame
} from 'lucide-react'
import Link from 'next/link'

interface Request {
  id: string
  user_id: string
  type: string
  start_date: string
  end_date: string
  working_days: number
  status: string
  notes: string | null
  admin_note: string | null
  created_at: string
  profiles?: { full_name: string; color: string | null; email: string } | null
}

interface Balance {
  user_id: string
  year: number
  total_days: number
  used_days: number
  pending_days: number
  profiles?: { full_name: string; color: string | null } | null
}

interface Profile {
  id: string
  full_name: string
  color: string | null
  role: string
  email: string
  phone?: string | null
  active?: boolean
}

const TYPE_LABELS: Record<string, string> = {
  vacation: 'Vacances',
  sick_leave: 'Baixa mèdica',
  permission: 'Permís',
  other: 'Altres',
}

const STATUS_CONFIG: Record<string, { label: string; style: string }> = {
  pending:  { label: 'Pendent',   style: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  approved: { label: 'Aprovada',  style: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  rejected: { label: 'Rebutjada', style: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administradora',
  supervisor: 'Supervisor',
  worker: 'Treballador/a',
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

type TabId = 'equip' | 'vacances' | 'absencies' | 'saldos' | 'mapa'

// ─── Mapa de calor ────────────────────────────────────────────
function HeatMap({ requests, profiles, year }: { requests: Request[]; profiles: Profile[]; year: number }) {
  const approved = requests.filter(r => r.status === 'approved')

  // Calcular quantes persones estan absents cada dia de l'any
  const absentByDay: Record<string, number> = {}
  approved.forEach(req => {
    const start = new Date(req.start_date + 'T00:00:00')
    const end = new Date(req.end_date + 'T00:00:00')
    const cur = new Date(start)
    while (cur <= end) {
      const dow = cur.getDay()
      if (dow !== 0 && dow !== 6) { // Només laborables
        const key = cur.toISOString().split('T')[0]
        absentByDay[key] = (absentByDay[key] || 0) + 1
      }
      cur.setDate(cur.getDate() + 1)
    }
  })

  const maxAbsent = Math.max(1, ...Object.values(absentByDay))

  function cellColor(count: number): string {
    if (count === 0) return 'bg-muted/30 dark:bg-muted/20'
    const pct = count / maxAbsent
    if (pct <= 0.25) return 'bg-green-200 dark:bg-green-900/40'
    if (pct <= 0.5)  return 'bg-yellow-200 dark:bg-yellow-900/40'
    if (pct <= 0.75) return 'bg-orange-300 dark:bg-orange-900/40'
    return 'bg-red-400 dark:bg-red-800/60'
  }

  const MONTHS = ['Gen','Feb','Mar','Abr','Mai','Jun','Jul','Ago','Set','Oct','Nov','Des']
  const DAYS = ['Dl','Dm','Dc','Dj','Dv']

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          Cada cel·la = 1 dia laborable. Color més fosc = més absències.
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Menys absències</span>
          <div className="flex gap-0.5">
            {['bg-muted/30','bg-green-200','bg-yellow-200','bg-orange-300','bg-red-400'].map((c,i) => (
              <div key={i} className={`w-4 h-4 rounded-sm ${c}`} />
            ))}
          </div>
          <span>Més absències</span>
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="grid grid-cols-12 gap-2 min-w-[700px]">
          {MONTHS.map((monthName, monthIdx) => {
            const firstDay = new Date(year, monthIdx, 1)
            const lastDay = new Date(year, monthIdx + 1, 0)
            const days: { date: Date; count: number }[] = []
            const cur = new Date(firstDay)
            while (cur <= lastDay) {
              const dow = cur.getDay()
              if (dow !== 0 && dow !== 6) {
                const key = cur.toISOString().split('T')[0]
                days.push({ date: new Date(cur), count: absentByDay[key] || 0 })
              }
              cur.setDate(cur.getDate() + 1)
            }

            return (
              <div key={monthIdx} className="space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground text-center">{monthName}</p>
                <div className="space-y-0.5">
                  {days.map((d, i) => (
                    <div
                      key={i}
                      title={`${d.date.toLocaleDateString('ca-ES')} — ${d.count} absent${d.count !== 1 ? 's' : ''}`}
                      className={`h-3 w-full rounded-sm cursor-default transition-all hover:opacity-80 ${cellColor(d.count)}`}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Dies crítics */}
      {Object.entries(absentByDay).filter(([, v]) => v >= 3).length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <Flame className="h-3.5 w-3.5 text-red-500" />
            Dies amb 3 o més persones absents
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(absentByDay)
              .filter(([, v]) => v >= 3)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, count]) => (
                <span key={date} className="text-xs px-2 py-1 rounded-lg bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-medium">
                  {new Date(date + 'T00:00:00').toLocaleDateString('ca-ES', { day: 'numeric', month: 'short' })}
                  {' '}· {count} persones
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Component principal ──────────────────────────────────────
export function EquipClient({
  requests,
  balances,
  profiles,
  holidays = [],
  closures = [],
  currentYear,
  today,
  isWorker = false,
  currentUserId,
}: {
  requests: Request[]
  balances: Balance[]
  profiles: Profile[]
  holidays?: string[]
  closures?: string[]
  currentYear: number
  today?: string
  isWorker?: boolean
  currentUserId?: string
}) {
  const [activeTab, setActiveTab] = useState<TabId>(isWorker ? 'vacances' : 'equip')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterYear, setFilterYear] = useState(currentYear)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [approving, setApproving] = useState<string | null>(null)
  const [adminNote, setAdminNote] = useState('')
  const [editingBalance, setEditingBalance] = useState<string | null>(null)
  const [editBalanceValue, setEditBalanceValue] = useState('')
  const [savingBalance, setSavingBalance] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const supabase = createClient()

  const vacances = requests.filter(r => r.type === 'vacation')
  const absencies = requests.filter(r => r.type !== 'vacation')
  const pendingVac = vacances.filter(r => r.status === 'pending').length
  const pendingAbs = absencies.filter(r => r.status === 'pending').length

  const filteredVacances = filterStatus ? vacances.filter(r => r.status === filterStatus) : vacances
  const filteredAbsencies = filterStatus ? absencies.filter(r => r.status === filterStatus) : absencies

  async function handleDecision(id: string, action: 'approved' | 'rejected') {
    setApproving(id)
    try {
      await fetch('/api/vacances/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: id, action, adminNote }),
      })
      setAdminNote('')
      setExpanded(null)
      setMsg({ ok: true, text: action === 'approved' ? 'Sol·licitud aprovada' : 'Sol·licitud rebutjada' })
      setTimeout(() => { setMsg(null); window.location.reload() }, 1200)
    } finally {
      setApproving(null)
    }
  }

  async function handleSaveBalance(userId: string) {
    const newTotal = parseInt(editBalanceValue)
    if (isNaN(newTotal) || newTotal < 0) return
    setSavingBalance(true)
    const { error } = await supabase.from('vacation_balances')
      .upsert({ user_id: userId, year: filterYear, total_days: newTotal }, { onConflict: 'user_id,year' })
    setSavingBalance(false)
    if (!error) {
      setEditingBalance(null)
      setMsg({ ok: true, text: 'Saldo actualitzat' })
      setTimeout(() => { setMsg(null); window.location.reload() }, 1200)
    }
  }

  const TABS: { id: TabId; label: string; icon: React.ReactNode; count?: number; adminOnly?: boolean }[] = [
    { id: 'equip',    label: 'Equip',     icon: <Users className="h-3.5 w-3.5" />,        adminOnly: true },
    { id: 'vacances', label: 'Vacances',  icon: <Umbrella className="h-3.5 w-3.5" />,     count: pendingVac },
    { id: 'absencies',label: 'Absències', icon: <ClipboardList className="h-3.5 w-3.5" />,count: pendingAbs },
    { id: 'saldos',   label: 'Saldos',    icon: <TrendingUp className="h-3.5 w-3.5" /> },
    { id: 'mapa',     label: 'Mapa calor',icon: <Flame className="h-3.5 w-3.5" />,        adminOnly: true },
  ].filter(t => !t.adminOnly || !isWorker) as { id: TabId; label: string; icon: React.ReactNode; count?: number; adminOnly?: boolean }[] as { id: TabId; label: string; icon: React.ReactNode; count?: number; adminOnly?: boolean }[] as { id: TabId; label: string; icon: React.ReactNode; count?: number; adminOnly?: boolean }[]

  function RequestCard({ req }: { req: Request }) {
    const isOpen = expanded === req.id
    const p = req.profiles as { full_name: string; color: string | null } | null
    const color = p?.color || '#2272A3'
    const name = p?.full_name || '—'
    const initials = getInitials(name)
    const isPending = req.status === 'pending'

    return (
      <Card className={isPending ? 'border-amber-200 dark:border-amber-800' : ''}>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ backgroundColor: color }}>{initials}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium">{name}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CONFIG[req.status]?.style}`}>
                  {STATUS_CONFIG[req.status]?.label}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {TYPE_LABELS[req.type] || req.type}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {req.start_date} → {req.end_date}
                {req.working_days > 0 && ` · ${req.working_days} dies`}
              </p>
              {req.notes && <p className="text-xs text-muted-foreground italic mt-0.5">{req.notes}</p>}
            </div>
            {!isWorker && (
              <button onClick={() => setExpanded(isOpen ? null : req.id)}
                className="text-muted-foreground hover:text-foreground shrink-0 p-1">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            )}
          </div>

          {isOpen && !isWorker && (
            <div className="mt-4 pt-4 border-t space-y-3">
              {isPending && (
                <>
                  <div className="space-y-1.5">
                    <Label>Nota per al treballador (opcional)</Label>
                    <Input value={adminNote} onChange={e => setAdminNote(e.target.value)}
                      placeholder="Motiu, comentari..." />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="tramit" size="sm" onClick={() => handleDecision(req.id, 'approved')}
                      disabled={approving === req.id} className="flex items-center gap-1.5">
                      <CheckCircle className="h-3.5 w-3.5" />
                      {approving === req.id ? 'Processant...' : 'Aprovar'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDecision(req.id, 'rejected')}
                      disabled={approving === req.id}
                      className="flex items-center gap-1.5 text-red-600 border-red-200">
                      <X className="h-3.5 w-3.5" />Rebutjar
                    </Button>
                  </div>
                </>
              )}
              {req.admin_note && (
                <div className="bg-muted/50 rounded-lg px-3 py-2">
                  <p className="text-xs text-muted-foreground">Nota admin: {req.admin_note}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Equip</h1>
          <p className="text-muted-foreground mt-1">
            {profiles.length} membres · Any {currentYear}
            {(pendingVac + pendingAbs) > 0 && !isWorker && (
              <span className="ml-2 text-amber-600 font-medium">
                · {pendingVac + pendingAbs} pendent{(pendingVac + pendingAbs) > 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        {isWorker && (
          <Button asChild variant="tramit" className="flex items-center gap-2">
            <Link href="/worker/vacances/nova">
              <Plus className="h-4 w-4" />Sol·licitar vacances
            </Link>
          </Button>
        )}
      </div>

      {msg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${msg.ok ? 'bg-green-50 text-green-700 dark:bg-green-900/20' : 'bg-red-50 text-red-700'}`}>
          {msg.ok ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {msg.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit flex-wrap">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === tab.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}>
            {tab.icon}{tab.label}
            {tab.count && tab.count > 0 ? (
              <span className="bg-amber-500 text-white text-[10px] rounded-full px-1.5 font-bold">{tab.count}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ── TAB: EQUIP ── */}
      {activeTab === 'equip' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {profiles.map(p => {
            const bal = balances.find(b => b.user_id === p.id && b.year === currentYear)
            const remaining = bal ? bal.total_days - bal.used_days : null
            return (
              <Card key={p.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 rounded-full flex items-center justify-center text-white text-base font-bold shrink-0"
                      style={{ backgroundColor: p.color || '#2272A3' }}>
                      {getInitials(p.full_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{p.full_name}</p>
                        {p.active === false && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Inactiu</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{ROLE_LABELS[p.role] || p.role}</p>
                      <div className="mt-2 space-y-1">
                        {p.email && (
                          <a href={`mailto:${p.email}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-tramit-blue transition-colors">
                            <Mail className="h-3 w-3 shrink-0" />{p.email}
                          </a>
                        )}
                        {p.phone && (
                          <a href={`tel:${p.phone}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-tramit-blue transition-colors">
                            <Phone className="h-3 w-3 shrink-0" />{p.phone}
                          </a>
                        )}
                      </div>
                    </div>
                    {remaining !== null && (
                      <div className="text-right shrink-0">
                        <p className="text-2xl font-bold text-tramit-blue">{remaining}</p>
                        <p className="text-[10px] text-muted-foreground">dies restants</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ── TAB: VACANCES ── */}
      {activeTab === 'vacances' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {(['', 'pending', 'approved', 'rejected'] as const).map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  filterStatus === s ? 'bg-tramit-blue text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}>
                {s === '' ? 'Totes' : STATUS_CONFIG[s]?.label}
                {s === 'pending' && pendingVac > 0 ? ` (${pendingVac})` : ''}
              </button>
            ))}
          </div>
          {filteredVacances.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              <Umbrella className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Cap sol·licitud de vacances</p>
            </CardContent></Card>
          ) : filteredVacances.map(req => <RequestCard key={req.id} req={req} />)}
        </div>
      )}

      {/* ── TAB: ABSÈNCIES ── */}
      {activeTab === 'absencies' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {(['', 'pending', 'approved', 'rejected'] as const).map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  filterStatus === s ? 'bg-tramit-blue text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}>
                {s === '' ? 'Totes' : STATUS_CONFIG[s]?.label}
                {s === 'pending' && pendingAbs > 0 ? ` (${pendingAbs})` : ''}
              </button>
            ))}
          </div>
          {filteredAbsencies.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Cap absència registrada</p>
            </CardContent></Card>
          ) : filteredAbsencies.map(req => <RequestCard key={req.id} req={req} />)}
        </div>
      )}

      {/* ── TAB: SALDOS ── */}
      {activeTab === 'saldos' && (
        <div className="space-y-3">
          {/* Selector d'any */}
          <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
            {[currentYear - 1, currentYear, currentYear + 1].map(y => (
              <button key={y} onClick={() => setFilterYear(y)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  filterYear === y ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}>{y}</button>
            ))}
          </div>

          {profiles.map(p => {
            const bal = balances.find(b => b.user_id === p.id && b.year === filterYear)
            const total = bal?.total_days || 0
            const used = bal?.used_days || 0
            const pending = bal?.pending_days || 0
            const remaining = total - used
            const pct = total > 0 ? Math.round((used / total) * 100) : 0
            const isEditing = editingBalance === p.id

            return (
              <Card key={p.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ backgroundColor: p.color || '#2272A3' }}>
                      {getInitials(p.full_name)}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{p.full_name}</p>
                      <p className="text-xs text-muted-foreground">{ROLE_LABELS[p.role]}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-2xl font-bold text-tramit-blue">{remaining}</p>
                        <p className="text-[10px] text-muted-foreground">restants</p>
                      </div>
                      {!isWorker && (
                        isEditing ? (
                          <div className="flex items-center gap-1">
                            <Input type="number" value={editBalanceValue}
                              onChange={e => setEditBalanceValue(e.target.value)}
                              className="h-8 w-16 text-sm text-center" min="0" max="40" />
                            <Button size="sm" variant="tramit"
                              onClick={() => handleSaveBalance(p.id)}
                              disabled={savingBalance} className="h-8 px-2">
                              <Save className="h-3.5 w-3.5" />
                            </Button>
                            <button onClick={() => setEditingBalance(null)}
                              className="p-1.5 text-muted-foreground hover:text-foreground">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditingBalance(p.id); setEditBalanceValue(String(total)) }}
                            className="p-1.5 text-muted-foreground hover:text-tramit-blue hover:bg-tramit-blue-light rounded-md transition-colors"
                            title="Editar dies totals">
                            <Pencil className="h-4 w-4" />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: p.color || '#2272A3' }} />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Usats: <strong className="text-foreground">{used}</strong></span>
                    {pending > 0 && <span>Pendents: <strong className="text-amber-500">{pending}</strong></span>}
                    <span>Total: <strong className="text-foreground">{total}</strong></span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ── TAB: MAPA DE CALOR ── */}
      {activeTab === 'mapa' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              Mapa de calor d&apos;absències {currentYear}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HeatMap requests={requests} profiles={profiles} year={currentYear} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
