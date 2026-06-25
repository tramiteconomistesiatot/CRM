'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  CheckCircle, XCircle, Clock, Umbrella,
  ChevronDown, ChevronUp, Pencil, X, Save, AlertTriangle,
} from 'lucide-react'

interface Request {
  id: string
  user_id: string
  start_date: string
  end_date: string
  working_days: number
  status: string
  notes: string | null
  admin_note: string | null
  created_at: string
  profiles?: { full_name: string; email: string } | { full_name: string; email: string }[] | null
}

interface Balance {
  id: string
  user_id: string
  total_days: number
  used_days: number
  pending_days: number
  profiles?: { full_name: string } | { full_name: string }[] | null
}

const STATUS_STYLES: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  approved:  'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected:  'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  cancelled: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
}

const STATUS_LABELS: Record<string, string> = {
  pending:   'Pendent',
  approved:  'Aprovada',
  rejected:  'Rebutjada',
  cancelled: 'Cancel·lada',
}

function getProfileName(profiles: Request['profiles']): string {
  if (!profiles) return '—'
  if (Array.isArray(profiles)) return profiles[0]?.full_name || '—'
  return (profiles as { full_name: string }).full_name || '—'
}

export function VacancesAdminClient({
  requests,
  balances,
}: {
  requests: Request[]
  balances: Balance[]
}) {
  const [tab, setTab] = useState<'sol·licituds' | 'saldos'>('sol·licituds')
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [adminNote, setAdminNote] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [editingBalance, setEditingBalance] = useState<string | null>(null)
  const [balanceEdits, setBalanceEdits] = useState<Record<string, { total_days: number; used_days: number; note: string }>>({})
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)

  const supabase = createClient()
  const pendingCount = requests.filter(r => r.status === 'pending').length
  const filtered = requests.filter(r => filter === 'all' || r.status === filter)

  // ── Aprovar / Rebutjar via API route (envia email automàticament) ──
  async function handleAction(id: string, action: 'approved' | 'rejected') {
    setLoading(id)
    setActionError(null)
    try {
      const res = await fetch('/api/vacances/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: id,
          action,
          adminNote: adminNote[id] || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error desconegut')
      window.location.reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error en processar la sol·licitud')
      setLoading(null)
    }
  }

  // ── Editar saldo manualment ──
  function startEditBalance(bal: Balance) {
    setEditingBalance(bal.id)
    setBalanceEdits(prev => ({
      ...prev,
      [bal.id]: { total_days: bal.total_days, used_days: bal.used_days, note: '' },
    }))
  }

  async function saveBalance(bal: Balance) {
    const edit = balanceEdits[bal.id]
    if (!edit) return
    setLoading(bal.id)

    await supabase
      .from('vacation_balances')
      .update({ total_days: edit.total_days, used_days: edit.used_days })
      .eq('id', bal.id)

    await supabase.from('audit_logs').insert({
      user_id: (await supabase.auth.getUser()).data.user?.id,
      action: 'update_vacation_balance',
      entity_type: 'vacation_balance',
      entity_id: bal.id,
      old_values: { total_days: bal.total_days, used_days: bal.used_days },
      new_values: { total_days: edit.total_days, used_days: edit.used_days, note: edit.note },
    })

    setEditingBalance(null)
    setLoading(null)
    setSaveSuccess(bal.id)
    setTimeout(() => {
      setSaveSuccess(null)
      window.location.reload()
    }, 1500)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Vacances</h1>
        <p className="text-muted-foreground mt-1">Gestió de sol·licituds i saldos de vacances</p>
      </div>

      {/* Missatge d'error global */}
      {actionError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {actionError}
        </div>
      )}

      {/* Pestanyes */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('sol·licituds')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            tab === 'sol·licituds' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Clock className="h-4 w-4" />
          Sol·licituds
          {pendingCount > 0 && (
            <span className="ml-1 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('saldos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            tab === 'saldos' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Umbrella className="h-4 w-4" />
          Saldos
        </button>
      </div>

      {/* ── Tab Sol·licituds ── */}
      {tab === 'sol·licituds' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  filter === f
                    ? 'bg-tramit-blue text-white'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {f === 'all' ? 'Totes' : STATUS_LABELS[f]}
                {f === 'pending' && pendingCount > 0 && ` (${pendingCount})`}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>Cap sol·licitud en aquest estat</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map(req => (
                <Card
                  key={req.id}
                  className={req.status === 'pending' ? 'border-amber-200 dark:border-amber-800' : ''}
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm">{getProfileName(req.profiles)}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[req.status]}`}>
                            {STATUS_LABELS[req.status]}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {req.start_date} → {req.end_date}
                          <span className="ml-2 font-medium text-foreground">
                            {req.working_days} dies laborables
                          </span>
                        </p>
                        {req.notes && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            &ldquo;{req.notes}&rdquo;
                          </p>
                        )}
                        {req.admin_note && (
                          <p className="text-xs text-muted-foreground mt-1">
                            <span className="font-medium">Nota admin:</span> {req.admin_note}
                          </p>
                        )}
                      </div>
                      {req.status === 'pending' && (
                        <button
                          onClick={() => setExpanded(expanded === req.id ? null : req.id)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {expanded === req.id
                            ? <ChevronUp className="h-4 w-4" />
                            : <ChevronDown className="h-4 w-4" />}
                        </button>
                      )}
                    </div>

                    {req.status === 'pending' && expanded === req.id && (
                      <div className="mt-4 pt-4 border-t space-y-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">
                            Nota opcional per al treballador
                          </label>
                          <input
                            type="text"
                            placeholder="Escriu una nota..."
                            value={adminNote[req.id] || ''}
                            onChange={e =>
                              setAdminNote(prev => ({ ...prev, [req.id]: e.target.value }))
                            }
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="tramit"
                            disabled={loading === req.id}
                            onClick={() => handleAction(req.id, 'approved')}
                            className="flex items-center gap-1.5"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            {loading === req.id ? 'Processant...' : 'Aprovar'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={loading === req.id}
                            onClick={() => handleAction(req.id, 'rejected')}
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
      )}

      {/* ── Tab Saldos ── */}
      {tab === 'saldos' && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Clica el botó d&apos;edició per modificar manualment els dies d&apos;un treballador.
            Tots els canvis queden registrats a l&apos;auditoria.
          </p>

          {balances.map(bal => {
            const remaining = bal.total_days - bal.used_days
            const pct = bal.total_days > 0 ? Math.round((bal.used_days / bal.total_days) * 100) : 0
            const isEditing = editingBalance === bal.id
            const edit = balanceEdits[bal.id]
            const name = Array.isArray(bal.profiles)
              ? bal.profiles[0]?.full_name || '—'
              : (bal.profiles as { full_name: string } | null)?.full_name || '—'

            return (
              <Card key={bal.id} className={isEditing ? 'border-tramit-blue/50' : ''}>
                <CardContent className="pt-4 pb-4">
                  {!isEditing ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <p className="font-medium text-sm">{name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground text-base">{remaining}</span>
                            restants de {bal.total_days}
                            {bal.pending_days > 0 && (
                              <span className="text-amber-600 dark:text-amber-400">
                                ({bal.pending_days} pendents)
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => startEditBalance(bal)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </button>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-tramit-blue transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {saveSuccess === bal.id && (
                        <div className="flex items-center gap-1.5 text-green-600 text-xs">
                          <CheckCircle className="h-3.5 w-3.5" />
                          Saldo actualitzat correctament
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm">{name}</p>
                        <button
                          onClick={() => setEditingBalance(null)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium">Dies totals assignats</label>
                          <Input
                            type="number"
                            min="0"
                            max="60"
                            value={edit?.total_days ?? bal.total_days}
                            onChange={e =>
                              setBalanceEdits(prev => ({
                                ...prev,
                                [bal.id]: { ...prev[bal.id], total_days: Number(e.target.value) },
                              }))
                            }
                            className="h-9"
                          />
                          <p className="text-xs text-muted-foreground">Dies contractuals anuals</p>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium">Dies ja gastats</label>
                          <Input
                            type="number"
                            min="0"
                            max={edit?.total_days ?? bal.total_days}
                            value={edit?.used_days ?? bal.used_days}
                            onChange={e =>
                              setBalanceEdits(prev => ({
                                ...prev,
                                [bal.id]: { ...prev[bal.id], used_days: Number(e.target.value) },
                              }))
                            }
                            className="h-9"
                          />
                          <p className="text-xs text-muted-foreground">Dies laborables aprovats</p>
                        </div>
                      </div>

                      {edit && (
                        <div className="rounded-lg bg-tramit-blue-light dark:bg-blue-900/20 px-4 py-2.5">
                          <p className="text-sm text-tramit-blue dark:text-blue-300">
                            Dies restants:{' '}
                            <span className="font-bold text-base">
                              {edit.total_days - edit.used_days}
                            </span>
                          </p>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium">
                          Motiu de l&apos;ajust{' '}
                          <span className="text-muted-foreground">(quedarà a l&apos;auditoria)</span>
                        </label>
                        <Input
                          placeholder="Ex: Correcció per acord especial, error de càlcul..."
                          value={edit?.note || ''}
                          onChange={e =>
                            setBalanceEdits(prev => ({
                              ...prev,
                              [bal.id]: { ...prev[bal.id], note: e.target.value },
                            }))
                          }
                          className="h-9"
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="tramit"
                          disabled={loading === bal.id}
                          onClick={() => saveBalance(bal)}
                          className="flex items-center gap-1.5"
                        >
                          <Save className="h-3.5 w-3.5" />
                          {loading === bal.id ? 'Desant...' : 'Desar canvis'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingBalance(null)}
                        >
                          Cancel·lar
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
