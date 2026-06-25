'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Plus, X, CheckCircle, XCircle, ChevronDown, ChevronUp,
  AlertTriangle, ClipboardList
} from 'lucide-react'

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
  deducts_vacation: boolean | null
  created_at: string
  profiles?: { full_name: string; email: string } | null
}

interface Profile {
  id: string
  full_name: string
  email: string
}

const TYPE_LABELS: Record<string, string> = {
  sick_leave: 'Baixa mèdica',
  permission: 'Permís',
  other: 'Altre',
}

const TYPE_STYLES: Record<string, string> = {
  sick_leave: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  permission: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  other: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendent',
  approved: 'Aprovada',
  rejected: 'Rebutjada',
  cancelled: 'Cancel·lada',
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  cancelled: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
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
  requests: Request[]
  profiles: Profile[]
  holidays: string[]
  closures: string[]
}

export function AbsenciesAdminClient({ requests, profiles, holidays, closures }: Props) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('pending')
  const [filterType, setFilterType] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [adminNote, setAdminNote] = useState<Record<string, string>>({})
  const [deductsMap, setDeductsMap] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState<string | null>(null)

  // Formulari nova absència
  const [form, setForm] = useState({
    user_id: '',
    type: 'sick_leave',
    start_date: '',
    end_date: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState(false)

  const supabase = createClient()

  const pendingCount = requests.filter(r => r.status === 'pending').length

  const filtered = requests.filter(r => {
    const matchStatus = filter === 'all' || r.status === filter
    const matchType = !filterType || r.type === filterType
    return matchStatus && matchType
  })

  async function handleAction(id: string, action: 'approved' | 'rejected', type: string) {
    setLoading(id)
    const updates: Record<string, unknown> = {
      status: action,
      admin_note: adminNote[id] || null,
      approved_at: new Date().toISOString(),
    }

    // Per permisos, guardar si descompten vacances
    if (type === 'permission') {
      updates.deducts_vacation = deductsMap[id] ?? false
    }

    await supabase.from('absence_requests').update(updates).eq('id', id)
    setLoading(null)
    window.location.reload()
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!form.user_id || !form.start_date || !form.end_date) {
      setFormError('Omple tots els camps obligatoris.')
      return
    }

    const workingDays = calculateWorkingDays(form.start_date, form.end_date, holidays, closures)

    setSaving(true)
    try {
      const { error } = await supabase.from('absence_requests').insert({
        user_id: form.user_id,
        type: form.type,
        start_date: form.start_date,
        end_date: form.end_date,
        working_days: workingDays,
        status: 'pending',
        notes: form.notes || null,
        deducts_vacation: form.type === 'sick_leave' ? false : null,
      })

      if (error) throw error

      setFormSuccess(true)
      setShowForm(false)
      setForm({ user_id: '', type: 'sick_leave', start_date: '', end_date: '', notes: '' })
      setTimeout(() => {
        setFormSuccess(false)
        window.location.reload()
      }, 1500)
    } catch {
      setFormError("S'ha produït un error. Torna-ho a intentar.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Absències</h1>
          <p className="text-muted-foreground mt-1">Baixes mèdiques, permisos i altres absències</p>
        </div>
        <Button variant="tramit" onClick={() => setShowForm(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nova absència
        </Button>
      </div>

      {formSuccess && (
        <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-900/20 px-4 py-3 rounded-lg">
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm font-medium">Absència registrada correctament</span>
        </div>
      )}

      {/* Formulari nova absència */}
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
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Treballador *</Label>
                  <select
                    value={form.user_id}
                    onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))}
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Selecciona un treballador</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>{p.full_name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label>Tipus *</Label>
                  <select
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="sick_leave">Baixa mèdica</option>
                    <option value="permission">Permís</option>
                    <option value="other">Altre</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label>Data d&apos;inici *</Label>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Data de fi *</Label>
                  <Input
                    type="date"
                    value={form.end_date}
                    min={form.start_date}
                    onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Notes internes <span className="text-muted-foreground">(opcional)</span></Label>
                <Input
                  type="text"
                  placeholder="Nota interna..."
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              {form.type === 'sick_leave' && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3">
                  <p className="text-sm text-amber-800 dark:text-amber-400">
                    ⚠️ Les baixes mèdiques <strong>no descompten vacances</strong> i només les veus tu i la Rosa. A l&apos;agenda general apareixerà com <em>&quot;No disponible&quot;</em>.
                  </p>
                </div>
              )}

              {formError && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  {formError}
                </div>
              )}

              <div className="flex gap-2">
                <Button type="submit" variant="tramit" disabled={saving}>
                  {saving ? 'Desant...' : 'Registrar absència'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel·lar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex gap-1 bg-muted p-1 rounded-lg">
          {(['all', 'pending', 'approved'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                filter === f ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f === 'all' ? 'Totes' : f === 'pending' ? `Pendents${pendingCount > 0 ? ` (${pendingCount})` : ''}` : 'Aprovades'}
            </button>
          ))}
        </div>

        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Tots els tipus</option>
          <option value="sick_leave">Baixa mèdica</option>
          <option value="permission">Permís</option>
          <option value="other">Altre</option>
        </select>
      </div>

      {/* Llista */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>Cap absència en aquest estat</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => (
            <Card key={req.id} className={req.status === 'pending' ? 'border-amber-200 dark:border-amber-800' : ''}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">
                        {req.type === 'sick_leave'
                          ? '🔒 Nom ocult'
                          : (req.profiles as { full_name: string } | null)?.full_name || '—'
                        }
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_STYLES[req.type]}`}>
                        {TYPE_LABELS[req.type] || req.type}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[req.status]}`}>
                        {STATUS_LABELS[req.status]}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {req.start_date} → {req.end_date}
                      <span className="ml-2 font-medium text-foreground">{req.working_days} dies</span>
                    </p>
                    {req.notes && req.type !== 'sick_leave' && (
                      <p className="text-xs text-muted-foreground mt-1 italic">&ldquo;{req.notes}&rdquo;</p>
                    )}
                    {req.admin_note && (
                      <p className="text-xs text-muted-foreground mt-1">
                        <span className="font-medium">Nota:</span> {req.admin_note}
                      </p>
                    )}
                  </div>

                  {req.status === 'pending' && (
                    <button
                      onClick={() => setExpanded(expanded === req.id ? null : req.id)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {expanded === req.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  )}
                </div>

                {req.status === 'pending' && expanded === req.id && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    {req.type === 'permission' && (
                      <div className="flex items-center gap-3">
                        <Label className="text-sm">Descomptar vacances?</Label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setDeductsMap(m => ({ ...m, [req.id]: true }))}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                              deductsMap[req.id] === true ? 'bg-tramit-blue text-white' : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            Sí
                          </button>
                          <button
                            onClick={() => setDeductsMap(m => ({ ...m, [req.id]: false }))}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                              deductsMap[req.id] === false ? 'bg-tramit-blue text-white' : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            No
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Nota per al treballador (opcional)</label>
                      <input
                        type="text"
                        placeholder="Escriu una nota..."
                        value={adminNote[req.id] || ''}
                        onChange={e => setAdminNote(prev => ({ ...prev, [req.id]: e.target.value }))}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="tramit"
                        disabled={loading === req.id}
                        onClick={() => handleAction(req.id, 'approved', req.type)}
                        className="flex items-center gap-1.5"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loading === req.id}
                        onClick={() => handleAction(req.id, 'rejected', req.type)}
                        className="flex items-center gap-1.5 text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Rebutjar
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
