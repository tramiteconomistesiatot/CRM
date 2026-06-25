'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Plus, X, Save, Pencil, Trash2, CheckCircle,
  Clock, AlertTriangle, Circle, ArrowRight, RefreshCw,
  FileText, Calendar, User
} from 'lucide-react'

interface Expedient {
  id: string
  client_id: string
  type: string
  title: string
  year: number
  status: string
  responsible_id: string | null
  deadline: string | null
  notes: string | null
  created_at: string
  profiles?: { full_name: string; color: string | null } | null
}

interface Profile { id: string; full_name: string; color: string | null }

const EXPEDIENT_TYPES: Record<string, { label: string; color: string; bg: string }> = {
  irpf:        { label: 'IRPF / Renda',      color: 'text-amber-700', bg: 'bg-amber-100 dark:bg-amber-900/20' },
  is:          { label: 'Impost Societats',  color: 'text-purple-700', bg: 'bg-purple-100 dark:bg-purple-900/20' },
  iva:         { label: 'IVA',               color: 'text-blue-700',  bg: 'bg-blue-100 dark:bg-blue-900/20' },
  nomines:     { label: 'Nòmines',           color: 'text-green-700', bg: 'bg-green-100 dark:bg-green-900/20' },
  autonomo:    { label: 'Autònom',           color: 'text-teal-700',  bg: 'bg-teal-100 dark:bg-teal-900/20' },
  alta_empresa:{ label: 'Alta empresa',      color: 'text-indigo-700',bg: 'bg-indigo-100 dark:bg-indigo-900/20' },
  patrimoni:   { label: 'Patrimoni',         color: 'text-rose-700',  bg: 'bg-rose-100 dark:bg-rose-900/20' },
  comptabilitat:{ label: 'Comptabilitat',    color: 'text-cyan-700',  bg: 'bg-cyan-100 dark:bg-cyan-900/20' },
  altre:       { label: 'Altre',             color: 'text-slate-700', bg: 'bg-slate-100 dark:bg-slate-800' },
}

const STATUS_CONFIG: Record<string, { label: string; style: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending:        { label: 'Pendent',           style: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', icon: Circle },
  in_progress:    { label: 'En curs',           style: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: ArrowRight },
  waiting_client: { label: 'Esperant client',   style: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock },
  waiting_admin:  { label: 'Esperant admin',    style: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: AlertTriangle },
  done:           { label: 'Completat',         style: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
  cancelled:      { label: 'Cancel·lat',        style: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: X },
}

const EMPTY_FORM = {
  type: 'irpf', title: '', year: new Date().getFullYear(),
  status: 'pending', responsible_id: '', deadline: '', notes: '',
}

export function ExpedientsComponent({
  clientId,
  expedients: initialExpedients,
  profiles,
  isAdmin = false,
}: {
  clientId: string
  expedients: Expedient[]
  profiles: Profile[]
  isAdmin?: boolean
}) {
  const [expedients, setExpedients] = useState<Expedient[]>(initialExpedients)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [filterYear, setFilterYear] = useState(new Date().getFullYear())
  const [filterStatus, setFilterStatus] = useState('')

  const supabase = createClient()

  const years = Array.from(new Set(expedients.map(e => e.year))).sort((a, b) => b - a)
  if (!years.includes(new Date().getFullYear())) years.unshift(new Date().getFullYear())

  const filtered = expedients
    .filter(e => e.year === filterYear)
    .filter(e => !filterStatus || e.status === filterStatus)
    .sort((a, b) => {
      const order = ['in_progress','waiting_client','waiting_admin','pending','done','cancelled']
      return order.indexOf(a.status) - order.indexOf(b.status)
    })

  function openAdd() {
    setForm({ ...EMPTY_FORM, year: filterYear })
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(e: Expedient) {
    setForm({
      type: e.type, title: e.title, year: e.year, status: e.status,
      responsible_id: e.responsible_id || '', deadline: e.deadline || '', notes: e.notes || '',
    })
    setEditingId(e.id)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function handleSave() {
    if (!form.title.trim()) return
    setSaving(true)
    const payload = {
      client_id: clientId,
      type: form.type,
      title: form.title.trim(),
      year: form.year,
      status: form.status,
      responsible_id: form.responsible_id || null,
      deadline: form.deadline || null,
      notes: form.notes || null,
    }

    if (editingId) {
      const { data, error } = await supabase.from('expedients')
        .update(payload).eq('id', editingId)
        .select('*, profiles!expedients_responsible_id_fkey(full_name, color)')
        .single()
      if (!error && data) {
        setExpedients(prev => prev.map(e => e.id === editingId ? data : e))
        closeForm()
      }
    } else {
      const { data, error } = await supabase.from('expedients')
        .insert(payload)
        .select('*, profiles!expedients_responsible_id_fkey(full_name, color)')
        .single()
      if (!error && data) {
        setExpedients(prev => [data, ...prev])
        closeForm()
      }
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    await supabase.from('expedients').delete().eq('id', id)
    setExpedients(prev => prev.filter(e => e.id !== id))
    setDeleting(null)
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('expedients').update({ status }).eq('id', id)
    setExpedients(prev => prev.map(e => e.id === id ? { ...e, status } : e))
  }

  const stats = {
    total: filtered.length,
    done: filtered.filter(e => e.status === 'done').length,
    inProgress: filtered.filter(e => ['in_progress','waiting_client','waiting_admin'].includes(e.status)).length,
    pending: filtered.filter(e => e.status === 'pending').length,
  }

  return (
    <div className="space-y-4">
      {/* Capçalera */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-tramit-blue" />
            Expedients
          </h3>
          <div className="flex gap-1 bg-muted p-0.5 rounded-lg">
            {years.slice(0, 4).map(y => (
              <button key={y} onClick={() => setFilterYear(y)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  filterYear === y ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
                }`}>{y}</button>
            ))}
          </div>
        </div>
        {isAdmin && (
          <Button variant="tramit" size="sm" onClick={openAdd} className="flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" />Nou expedient
          </Button>
        )}
      </div>

      {/* Mini stats */}
      {filtered.length > 0 && (
        <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
          <span>{stats.total} total</span>
          <span className="text-blue-600 font-medium">{stats.inProgress} en curs</span>
          <span className="text-amber-600">{stats.pending} pendents</span>
          <span className="text-green-600">{stats.done} completats</span>
        </div>
      )}

      {/* Filtre estat */}
      <div className="flex gap-1.5 flex-wrap">
        <button onClick={() => setFilterStatus('')}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${!filterStatus ? 'bg-tramit-blue text-white' : 'bg-muted text-muted-foreground'}`}>
          Tots
        </button>
        {Object.entries(STATUS_CONFIG).map(([v, c]) => (
          <button key={v} onClick={() => setFilterStatus(v)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${filterStatus === v ? c.style : 'bg-muted text-muted-foreground'}`}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Formulari */}
      {showForm && isAdmin && (
        <Card className="border-tramit-blue/30 bg-tramit-blue-light/10 dark:bg-blue-900/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-medium text-sm">{editingId ? 'Editar expedient' : 'Nou expedient'}</p>
              <button onClick={closeForm} className="text-muted-foreground hover:text-foreground p-1">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-medium">Títol *</label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Ex: IRPF 2025 — Pere García" autoFocus />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Tipus</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {Object.entries(EXPEDIENT_TYPES).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Any</label>
                <Input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: parseInt(e.target.value) }))}
                  min="2020" max="2030" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Estat</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {Object.entries(STATUS_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Termini</label>
                <Input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Responsable</label>
                <select value={form.responsible_id} onChange={e => setForm(f => ({ ...f, responsible_id: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="">Sense assignar</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-medium">Notes</label>
                <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Notes de l'expedient..." />
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button variant="tramit" size="sm" onClick={handleSave} disabled={saving || !form.title}>
                <Save className="h-3.5 w-3.5 mr-1" />{saving ? 'Desant...' : editingId ? 'Actualitzar' : 'Crear'}
              </Button>
              <Button variant="outline" size="sm" onClick={closeForm}>Cancel·lar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Llista d'expedients */}
      {filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-border rounded-xl">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Cap expedient per a {filterYear}</p>
          {isAdmin && <button onClick={openAdd} className="text-xs text-tramit-blue hover:underline mt-1">Crear el primer expedient</button>}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(exp => {
            const typeConf = EXPEDIENT_TYPES[exp.type] || EXPEDIENT_TYPES.altre
            const statusConf = STATUS_CONFIG[exp.status] || STATUS_CONFIG.pending
            const StatusIcon = statusConf.icon
            const responsible = exp.profiles as { full_name: string } | null
            const isOverdue = exp.deadline && new Date(exp.deadline) < new Date() && exp.status !== 'done'

            return (
              <div key={exp.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${isOverdue ? 'border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-900/5' : 'border-border bg-background hover:border-tramit-blue/20'}`}>
                <StatusIcon className={`h-4 w-4 shrink-0 ${
                  exp.status === 'done' ? 'text-green-500' :
                  exp.status === 'in_progress' ? 'text-blue-500' :
                  exp.status === 'waiting_client' ? 'text-amber-500' : 'text-slate-400'
                }`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm font-medium ${exp.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                      {exp.title}
                    </p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${typeConf.bg} ${typeConf.color}`}>
                      {typeConf.label}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusConf.style}`}>
                      {statusConf.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                    {responsible && <span className="flex items-center gap-1"><User className="h-3 w-3" />{responsible.full_name.split(' ')[0]}</span>}
                    {exp.deadline && (
                      <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
                        <Calendar className="h-3 w-3" />
                        {new Date(exp.deadline + 'T00:00:00').toLocaleDateString('ca-ES', { day: 'numeric', month: 'short' })}
                        {isOverdue && ' ⚠️'}
                      </span>
                    )}
                    {exp.notes && <span className="truncate max-w-[200px]">{exp.notes}</span>}
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Canvi d'estat ràpid */}
                    {exp.status !== 'done' && (
                      <button onClick={() => updateStatus(exp.id, exp.status === 'pending' ? 'in_progress' : exp.status === 'in_progress' ? 'done' : 'done')}
                        className="text-xs px-2 py-1 rounded-lg bg-tramit-blue-light text-tramit-blue hover:bg-tramit-blue hover:text-white transition-colors font-medium">
                        {exp.status === 'pending' ? 'Iniciar' : 'Fet ✓'}
                      </button>
                    )}
                    <button onClick={() => openEdit(exp)}
                      className="p-1.5 text-muted-foreground hover:text-tramit-blue hover:bg-tramit-blue-light rounded-md transition-colors">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDelete(exp.id)} disabled={deleting === exp.id}
                      className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                      {deleting === exp.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
