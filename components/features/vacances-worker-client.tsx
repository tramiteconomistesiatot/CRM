'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Umbrella, Plus, X, CheckCircle, AlertTriangle, ClipboardList } from 'lucide-react'

interface Balance {
  total_days: number
  used_days: number
  pending_days: number
}

interface Request {
  id: string
  type: string
  start_date: string
  end_date: string
  working_days: number
  status: string
  notes: string | null
  admin_note: string | null
  created_at: string
}

const STATUS_STYLES: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  approved:  'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected:  'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  cancelled: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendent', approved: 'Aprovada',
  rejected: 'Rebutjada', cancelled: 'Cancel·lada',
}

const ABSENCE_TYPE_LABELS: Record<string, string> = {
  sick_leave: 'Baixa mèdica',
  permission: 'Permís',
  other: 'Altre',
}

function calculateWorkingDays(start: string, end: string, holidays: string[], closures: string[]): number {
  const nonWorking = new Set([...holidays, ...closures])
  let count = 0
  const current = new Date(start)
  const endDate = new Date(end)
  while (current <= endDate) {
    const day = current.getDay()
    const dateStr = current.toISOString().split('T')[0]
    if (day !== 0 && day !== 6 && !nonWorking.has(dateStr)) count++
    current.setDate(current.getDate() + 1)
  }
  return count
}

interface Props {
  balance: Balance | null
  requests: Request[]
  holidays: string[]
  closures: string[]
  userId: string
}

export function VacancesWorkerClient({ balance, requests, holidays, closures, userId }: Props) {
  const [tab, setTab] = useState<'vacances' | 'absencies'>('vacances')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Formulari vacances
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')

  // Formulari absència
  const [absForm, setAbsForm] = useState({
    type: 'permission',
    start_date: '',
    end_date: '',
    notes: '',
  })

  const supabase = createClient()

  const vacancesRequests = requests.filter(r => r.type === 'vacation')
  const absenciesRequests = requests.filter(r => r.type !== 'vacation')
  const remaining = balance ? balance.total_days - balance.used_days : 0
  const workingDays = startDate && endDate && endDate >= startDate
    ? calculateWorkingDays(startDate, endDate, holidays, closures) : 0

  async function handleSubmitVacances(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (workingDays <= 0) { setError('Les dates no inclouen dies laborables.'); return }
    if (workingDays > remaining) { setError(`No tens suficients dies. Tens ${remaining} dies restants.`); return }
    setSaving(true)
    try {
      if (balance) {
        await supabase.from('vacation_balances')
          .update({ pending_days: (balance.pending_days || 0) + workingDays })
          .eq('user_id', userId).eq('year', new Date().getFullYear())
      }
      const { error: insertError } = await supabase.from('absence_requests').insert({
        user_id: userId, type: 'vacation',
        start_date: startDate, end_date: endDate,
        working_days: workingDays, status: 'pending',
        notes: notes || null, deducts_vacation: true,
      })
      if (insertError) throw insertError
      setSuccess(true)
      setShowForm(false)
      setStartDate(''); setEndDate(''); setNotes('')
      setTimeout(() => { setSuccess(false); window.location.reload() }, 2000)
    } catch { setError("S'ha produït un error. Torna-ho a intentar.") }
    finally { setSaving(false) }
  }

  async function handleSubmitAbsencia(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!absForm.start_date) { setError('Cal seleccionar una data d\'inici.'); return }
    setSaving(true)
    try {
      const wDays = absForm.end_date
        ? calculateWorkingDays(absForm.start_date, absForm.end_date, holidays, closures)
        : 1
      const { error: insertError } = await supabase.from('absence_requests').insert({
        user_id: userId, type: absForm.type,
        start_date: absForm.start_date,
        end_date: absForm.end_date || absForm.start_date,
        working_days: wDays, status: 'pending',
        notes: absForm.notes || null, deducts_vacation: false,
      })
      if (insertError) throw insertError
      setSuccess(true)
      setShowForm(false)
      setAbsForm({ type: 'permission', start_date: '', end_date: '', notes: '' })
      setTimeout(() => { setSuccess(false); window.location.reload() }, 2000)
    } catch { setError("S'ha produït un error. Torna-ho a intentar.") }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Vacances i absències</h1>
        <p className="text-muted-foreground mt-1">Les teves sol·licituds {new Date().getFullYear()}</p>
      </div>

      {/* Saldo vacances */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Dies totals', value: balance?.total_days || 0, color: 'text-foreground' },
          { label: 'Dies usats', value: balance?.used_days || 0, color: 'text-tramit-blue' },
          { label: 'Dies restants', value: remaining, color: remaining <= 3 ? 'text-red-500' : 'text-green-600' },
        ].map(item => (
          <Card key={item.label}>
            <CardContent className="pt-4 pb-3 text-center">
              <p className={`text-3xl font-bold ${item.color}`}>{item.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {balance?.pending_days ? (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          ⏳ {balance.pending_days} dies pendents d&apos;aprovació
        </p>
      ) : null}

      {/* Pestanyes */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        <button onClick={() => { setTab('vacances'); setShowForm(false) }}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            tab === 'vacances' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}>
          <Umbrella className="h-4 w-4" />
          Vacances
          {vacancesRequests.filter(r => r.status === 'pending').length > 0 && (
            <span className="bg-amber-500 text-white text-[10px] rounded-full px-1.5 font-bold">
              {vacancesRequests.filter(r => r.status === 'pending').length}
            </span>
          )}
        </button>
        <button onClick={() => { setTab('absencies'); setShowForm(false) }}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            tab === 'absencies' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}>
          <ClipboardList className="h-4 w-4" />
          Absències
          {absenciesRequests.filter(r => r.status === 'pending').length > 0 && (
            <span className="bg-amber-500 text-white text-[10px] rounded-full px-1.5 font-bold">
              {absenciesRequests.filter(r => r.status === 'pending').length}
            </span>
          )}
        </button>
      </div>

      {success && (
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-4 py-3 rounded-lg">
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm font-medium">Sol·licitud enviada correctament!</span>
        </div>
      )}

      {/* ── TAB VACANCES ── */}
      {tab === 'vacances' && (
        <div className="space-y-4">
          {!showForm && (
            <Button variant="tramit" onClick={() => setShowForm(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nova sol·licitud de vacances
            </Button>
          )}

          {showForm && (
            <Card className="border-tramit-blue/30">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Nova sol·licitud</CardTitle>
                  <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitVacances} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Data d&apos;inici</Label>
                      <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Data de fi</Label>
                      <Input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} required />
                    </div>
                  </div>
                  {workingDays > 0 && (
                    <div className="rounded-lg bg-tramit-blue-light dark:bg-blue-900/20 px-4 py-3">
                      <p className="text-sm font-medium text-tramit-blue dark:text-blue-300">
                        Dies laborables: <span className="text-lg font-bold">{workingDays}</span>
                        {workingDays > remaining && <span className="ml-2 text-red-500">⚠️ Supera el saldo</span>}
                      </p>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label>Notes <span className="text-muted-foreground">(opcional)</span></Label>
                    <Input placeholder="Afegeix una nota..." value={notes} onChange={e => setNotes(e.target.value)} />
                  </div>
                  {error && <div className="flex items-center gap-2 text-red-600 text-sm"><AlertTriangle className="h-4 w-4" />{error}</div>}
                  <div className="flex gap-2">
                    <Button type="submit" variant="tramit" disabled={saving || workingDays === 0}>
                      {saving ? 'Enviant...' : 'Enviar sol·licitud'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel·lar</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Historial de vacances</CardTitle></CardHeader>
            <CardContent>
              {vacancesRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Umbrella className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Encara no has fet cap sol·licitud</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {vacancesRequests.map(req => (
                    <div key={req.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="text-sm font-medium">{req.start_date} → {req.end_date}</p>
                        <p className="text-xs text-muted-foreground">
                          {req.working_days} dies laborables
                          {req.admin_note && ` · "${req.admin_note}"`}
                        </p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLES[req.status]}`}>
                        {STATUS_LABELS[req.status]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── TAB ABSÈNCIES ── */}
      {tab === 'absencies' && (
        <div className="space-y-4">
          {!showForm && (
            <Button variant="tramit" onClick={() => setShowForm(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nova sol·licitud d&apos;absència
            </Button>
          )}

          {showForm && (
            <Card className="border-tramit-blue/30">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Nova absència</CardTitle>
                  <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitAbsencia} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Tipus</Label>
                    <select value={absForm.type} onChange={e => setAbsForm(f => ({ ...f, type: e.target.value }))}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <option value="permission">Permís</option>
                      <option value="sick_leave">Baixa mèdica</option>
                      <option value="other">Altre</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Data d&apos;inici</Label>
                      <Input type="date" value={absForm.start_date}
                        onChange={e => setAbsForm(f => ({ ...f, start_date: e.target.value }))} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Data de fi <span className="text-muted-foreground">(opcional)</span></Label>
                      <Input type="date" value={absForm.end_date} min={absForm.start_date}
                        onChange={e => setAbsForm(f => ({ ...f, end_date: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Notes <span className="text-muted-foreground">(opcional)</span></Label>
                    <Input placeholder="Motiu o informació addicional..."
                      value={absForm.notes} onChange={e => setAbsForm(f => ({ ...f, notes: e.target.value }))} />
                  </div>
                  {error && <div className="flex items-center gap-2 text-red-600 text-sm"><AlertTriangle className="h-4 w-4" />{error}</div>}
                  <div className="flex gap-2">
                    <Button type="submit" variant="tramit" disabled={saving}>
                      {saving ? 'Enviant...' : 'Enviar sol·licitud'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel·lar</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Historial d&apos;absències</CardTitle></CardHeader>
            <CardContent>
              {absenciesRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Encara no has fet cap sol·licitud d&apos;absència</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {absenciesRequests.map(req => (
                    <div key={req.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="text-sm font-medium">
                          {ABSENCE_TYPE_LABELS[req.type] || req.type} · {req.start_date}
                          {req.end_date !== req.start_date && ` → ${req.end_date}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {req.working_days} dies
                          {req.admin_note && ` · "${req.admin_note}"`}
                        </p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLES[req.status]}`}>
                        {STATUS_LABELS[req.status]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
