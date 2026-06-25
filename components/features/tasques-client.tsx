'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DocumentsClient } from './documents-client'
import {
  Plus, X, CheckCircle, Clock, AlertTriangle,
  Circle, ArrowRight, Calendar, User, Timer,
  Kanban, List, Trash2, Zap, FileText,
} from 'lucide-react'

interface Task {
  id: string
  title: string
  description: string | null
  status: 'pending' | 'in_progress' | 'done' | 'archived'
  priority: 'normal' | 'high' | 'urgent'
  assigned_to: string | null
  client_id: string | null
  expedient_id: string | null
  created_by: string
  due_date: string | null
  done_at: string | null
  estimated_minutes: number | null
  created_at: string
  profiles?: { full_name: string; color: string | null } | null
  clients?: { name: string } | null
}

interface TimeEntry {
  id: string
  task_id: string
  user_id: string
  minutes: number
  description: string | null
  date: string
}

interface Profile { id: string; full_name: string; color: string | null }
interface Client { id: string; name: string }
interface Template {
  id: string
  name: string
  type: string
  tasks: { title: string; priority: string }[]
}

const STATUS_CONFIG = {
  pending:     { label: 'Pendent',  icon: Circle,      style: 'text-slate-500',        bg: 'bg-slate-50 dark:bg-slate-800/50',  border: 'border-slate-200 dark:border-slate-700' },
  in_progress: { label: 'En curs',  icon: ArrowRight,  style: 'text-blue-500',         bg: 'bg-blue-50 dark:bg-blue-900/20',    border: 'border-blue-200 dark:border-blue-800' },
  done:        { label: 'Fet',      icon: CheckCircle, style: 'text-green-500',        bg: 'bg-green-50 dark:bg-green-900/20',  border: 'border-green-200 dark:border-green-800' },
  archived:    { label: 'Arxivada', icon: Circle,      style: 'text-muted-foreground', bg: 'bg-muted',                          border: 'border-border' },
}

const PRIORITY_CONFIG = {
  normal: { label: 'Normal', style: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
  high:   { label: 'Alta',   style: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  urgent: { label: 'Urgent', style: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function formatMinutes(min: number): string {
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

const EMPTY_FORM = {
  title: '', description: '', priority: 'normal' as Task['priority'],
  assigned_to: '', client_id: '', due_date: '', estimated_minutes: '',
}

export function TasquesClient({
  tasks: initialTasks,
  profiles,
  clients,
  templates = [],
  currentUserId,
  timeEntries: initialTimeEntries = [],
  documents = [],
  docRequests = [],
  isAdmin = false,
}: {
  tasks: Task[]
  profiles: Profile[]
  clients: Client[]
  templates?: Template[]
  currentUserId: string
  timeEntries?: TimeEntry[]
  documents?: unknown[]
  docRequests?: unknown[]
  isAdmin?: boolean
}) {
  const [mainTab, setMainTab] = useState<'tasques' | 'documents'>('tasques')
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(initialTimeEntries)
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [filter, setFilter] = useState<'all' | 'mine' | 'pending' | 'done'>('all')
  const [showArchived, setShowArchived] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showTimer, setShowTimer] = useState<string | null>(null)
  const [timerMinutes, setTimerMinutes] = useState('')
  const [timerDesc, setTimerDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const supabase = createClient()

  const filtered = useMemo(() => {
    let result = tasks.filter(t => t.status !== 'archived')
    if (filter === 'mine') result = result.filter(t => t.assigned_to === currentUserId)
    if (filter === 'pending') result = result.filter(t => t.status === 'pending' || t.status === 'in_progress')
    if (filter === 'done') result = result.filter(t => t.status === 'done')
    return result
  }, [tasks, filter, currentUserId])

  const archivedCount = tasks.filter(t => t.status === 'archived').length

  function getTaskTime(taskId: string): number {
    return timeEntries.filter(e => e.task_id === taskId).reduce((s, e) => s + e.minutes, 0)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    const { data, error } = await supabase.from('tasks').insert({
      title: form.title.trim(),
      description: form.description || null,
      priority: form.priority,
      assigned_to: form.assigned_to || null,
      client_id: form.client_id || null,
      due_date: form.due_date || null,
      estimated_minutes: form.estimated_minutes ? parseInt(form.estimated_minutes) * 60 : null,
      status: 'pending',
      created_by: currentUserId,
    }).select('*, profiles!tasks_assigned_to_fkey(full_name, color), clients(name)').single()
    setSaving(false)
    if (!error && data) {
      setTasks(prev => [data, ...prev])
      setForm(EMPTY_FORM)
      setShowForm(false)
    }
  }

  async function applyTemplate(template: Template) {
    setShowTemplates(false)
    setSaving(true)
    const inserts = template.tasks.map(t => ({
      title: t.title,
      priority: t.priority as Task['priority'],
      status: 'pending' as const,
      created_by: currentUserId,
    }))
    const { data, error } = await supabase.from('tasks')
      .insert(inserts)
      .select('*, profiles!tasks_assigned_to_fkey(full_name, color), clients(name)')
    setSaving(false)
    if (!error && data) setTasks(prev => [...data, ...prev])
  }

  async function changeStatus(id: string, status: Task['status']) {
    setLoading(id)
    await supabase.from('tasks').update({
      status,
      done_at: status === 'done' ? new Date().toISOString() : null,
    }).eq('id', id)
    setTasks(prev => prev.map(t => t.id === id
      ? { ...t, status, done_at: status === 'done' ? new Date().toISOString() : null }
      : t
    ))
    setLoading(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('Segur que vols esborrar aquesta tasca? No es pot desfer.')) return
    setLoading(id)
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
    setLoading(null)
  }

  async function logTime(taskId: string, clientId: string | null) {
    const min = parseInt(timerMinutes)
    if (!min || min <= 0) return
    setSaving(true)
    const { data, error } = await supabase.from('time_entries').insert({
      task_id: taskId,
      user_id: currentUserId,
      client_id: clientId,
      minutes: min,
      description: timerDesc || null,
      date: new Date().toISOString().split('T')[0],
    }).select().single()
    setSaving(false)
    if (!error && data) {
      setTimeEntries(prev => [...prev, data])
      setShowTimer(null)
      setTimerMinutes('')
      setTimerDesc('')
    }
  }

  const columns: { status: 'pending' | 'in_progress' | 'done' }[] = [
    { status: 'pending' },
    { status: 'in_progress' },
    { status: 'done' },
  ]

  const stats = useMemo(() => ({
    pending: tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    done: tasks.filter(t => t.status === 'done').length,
    totalMinutes: timeEntries.reduce((s, e) => s + e.minutes, 0),
  }), [tasks, timeEntries])

  function TaskCard({ task }: { task: Task }) {
    const assignedProfile = task.profiles as { full_name: string; color: string | null } | null
    const clientName = (task.clients as { name: string } | null)?.name
    const isOverdue = task.due_date && task.status !== 'done' && task.due_date < new Date().toISOString().split('T')[0]
    const daysUntil = task.due_date ? Math.ceil((new Date(task.due_date).getTime() - new Date().getTime()) / 86400000) : null
    const taskTime = getTaskTime(task.id)
    const isShowingTimer = showTimer === task.id

    return (
      <Card className={`${isOverdue ? 'border-red-300 dark:border-red-800' : ''} ${loading === task.id ? 'opacity-50' : ''} transition-all`}>
        <CardContent className="pt-3 pb-3 px-3 space-y-2">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium leading-tight ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                {task.title}
              </p>
              {task.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
              )}
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${PRIORITY_CONFIG[task.priority].style}`}>
              {PRIORITY_CONFIG[task.priority].label}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {assignedProfile && (
              <div className="flex items-center gap-1">
                <div className="h-5 w-5 rounded-full flex items-center justify-center text-white shrink-0"
                  style={{ backgroundColor: assignedProfile.color || '#2272A3', fontSize: '8px', fontWeight: 700 }}>
                  {getInitials(assignedProfile.full_name)}
                </div>
                <span className="text-xs text-muted-foreground">{assignedProfile.full_name.split(' ')[0]}</span>
              </div>
            )}
            {clientName && <span className="text-xs text-muted-foreground">· {clientName}</span>}
            {task.due_date && (
              <div className={`flex items-center gap-1 ml-auto ${isOverdue ? 'text-red-500' : daysUntil !== null && daysUntil <= 2 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                <Calendar className="h-3 w-3" />
                <span className="text-xs">
                  {isOverdue ? 'Vençuda' : daysUntil === 0 ? 'Avui' : daysUntil === 1 ? 'Demà' : task.due_date}
                </span>
              </div>
            )}
          </div>

          {(taskTime > 0 || task.estimated_minutes) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Timer className="h-3 w-3" />
              <span>{formatMinutes(taskTime)}</span>
              {task.estimated_minutes && (
                <span className="text-muted-foreground/60">/ {formatMinutes(task.estimated_minutes)} estimat</span>
              )}
              {task.estimated_minutes && taskTime > 0 && (
                <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-tramit-blue rounded-full transition-all"
                    style={{ width: `${Math.min(100, (taskTime / task.estimated_minutes) * 100)}%` }} />
                </div>
              )}
            </div>
          )}

          {isShowingTimer && (
            <div className="flex gap-1.5 items-center pt-1 border-t border-border flex-wrap">
              <Input type="number" value={timerMinutes} onChange={e => setTimerMinutes(e.target.value)}
                placeholder="Minuts" className="h-7 w-20 text-xs" min="1" autoFocus />
              <Input value={timerDesc} onChange={e => setTimerDesc(e.target.value)}
                placeholder="Nota (opcional)" className="h-7 flex-1 text-xs min-w-[80px]" />
              <Button size="sm" variant="tramit" className="h-7 px-2 text-xs"
                onClick={() => logTime(task.id, task.client_id)} disabled={saving || !timerMinutes}>
                ✓
              </Button>
              <button onClick={() => setShowTimer(null)} className="text-muted-foreground hover:text-foreground p-1">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="flex gap-1 pt-1 border-t border-border flex-wrap">
            {(['pending', 'in_progress', 'done'] as const).map(s => (
              <button key={s} onClick={() => changeStatus(task.id, s)}
                disabled={task.status === s || loading === task.id}
                className={`flex-1 py-1 rounded text-xs font-medium transition-all ${
                  task.status === s
                    ? `${STATUS_CONFIG[s].bg} ${STATUS_CONFIG[s].style} cursor-default`
                    : 'text-muted-foreground hover:bg-muted'
                }`}>
                {STATUS_CONFIG[s].label}
              </button>
            ))}
            <button onClick={() => setShowTimer(isShowingTimer ? null : task.id)}
              className={`px-2 py-1 rounded text-xs transition-all ${isShowingTimer ? 'bg-tramit-blue text-white' : 'text-muted-foreground hover:bg-muted'}`}
              title="Registrar temps">
              <Timer className="h-3 w-3" />
            </button>
            <button onClick={() => changeStatus(task.id, task.status === 'archived' ? 'pending' : 'archived')}
              disabled={loading === task.id}
              className="px-2 py-1 rounded text-xs text-muted-foreground hover:bg-muted transition-all"
              title={task.status === 'archived' ? 'Desarxivar' : 'Arxivar'}>
              {task.status === 'archived' ? '↩' : '📁'}
            </button>
            <button onClick={() => handleDelete(task.id)}
              disabled={loading === task.id}
              className="px-2 py-1 rounded text-xs text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-all"
              title="Esborrar tasca">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-5 max-w-6xl">

      {/* Selector pestanya principal */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        <button onClick={() => setMainTab('tasques')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            mainTab === 'tasques' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}>
          <CheckCircle className="h-4 w-4" />
          Tasques
        </button>
        <button onClick={() => setMainTab('documents')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            mainTab === 'documents' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}>
          <FileText className="h-4 w-4" />
          Documents
        </button>
      </div>

      {/* ── TAB DOCUMENTS ── */}
      {mainTab === 'documents' && (
        <DocumentsClient
          documents={documents as never[]}
          requests={docRequests as never[]}
          clients={clients}
          profiles={profiles}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
        />
      )}

      {/* ── TAB TASQUES ── */}
      {mainTab === 'tasques' && (
        <div className="space-y-5">

          {/* Capçalera */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold">Tasques</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {stats.pending} pendents · {stats.inProgress} en curs · {stats.done} fetes
                {stats.totalMinutes > 0 && (
                  <span className="ml-2 text-tramit-blue font-medium">· {formatMinutes(stats.totalMinutes)} registrades</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex gap-1 bg-muted p-1 rounded-lg">
                <button onClick={() => setViewMode('kanban')}
                  className={`p-1.5 rounded-md transition-all ${viewMode === 'kanban' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>
                  <Kanban className="h-4 w-4" />
                </button>
                <button onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>
                  <List className="h-4 w-4" />
                </button>
              </div>
              {templates.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => setShowTemplates(!showTemplates)} className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" />Plantilles
                </Button>
              )}
              <Button variant="tramit" size="sm" onClick={() => setShowForm(true)} className="flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" />Nova tasca
              </Button>
            </div>
          </div>

          {/* Plantilles */}
          {showTemplates && (
            <Card className="border-tramit-blue/30">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />Plantilles de tasques
                  </CardTitle>
                  <button onClick={() => setShowTemplates(false)} className="text-muted-foreground hover:text-foreground p-1">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {templates.map(tpl => (
                    <div key={tpl.id} className="border border-border rounded-xl p-3 hover:border-tramit-blue/40 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-sm">{tpl.name}</p>
                        <Button size="sm" variant="tramit" className="h-7 px-2 text-xs"
                          onClick={() => applyTemplate(tpl)} disabled={saving}>
                          Aplicar
                        </Button>
                      </div>
                      <div className="space-y-1">
                        {tpl.tasks.slice(0, 3).map((t, i) => (
                          <p key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Circle className="h-2.5 w-2.5 shrink-0" />{t.title}
                          </p>
                        ))}
                        {tpl.tasks.length > 3 && (
                          <p className="text-xs text-muted-foreground">+ {tpl.tasks.length - 3} més...</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Formulari nova tasca */}
          {showForm && (
            <Card className="border-tramit-blue/30">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Nova tasca</CardTitle>
                  <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground p-1">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreate} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Títol *</Label>
                      <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                        placeholder="Descripció de la tasca" required autoFocus />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Prioritat</Label>
                      <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as Task['priority'] }))}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <option value="normal">Normal</option>
                        <option value="high">Alta</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Data límit</Label>
                      <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Assignar a</Label>
                      <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <option value="">Sense assignar</option>
                        {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Client relacionat</Label>
                      <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <option value="">Sense client</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Temps estimat (hores)</Label>
                      <Input type="number" min="0" step="0.5" value={form.estimated_minutes}
                        onChange={e => setForm(f => ({ ...f, estimated_minutes: e.target.value }))}
                        placeholder="Ex: 2" />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Descripció (opcional)</Label>
                      <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="Detalls addicionals..." />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" variant="tramit" disabled={saving}>{saving ? 'Creant...' : 'Crear tasca'}</Button>
                    <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel·lar</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Filtres */}
          <div className="flex gap-2 flex-wrap">
            {([
              { id: 'all', label: 'Totes' },
              { id: 'mine', label: 'Les meves' },
              { id: 'pending', label: 'Actives' },
              { id: 'done', label: 'Fetes' },
            ] as const).map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  filter === f.id ? 'bg-tramit-blue text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}>
                {f.label}
              </button>
            ))}
            <button onClick={() => setShowArchived(!showArchived)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                showArchived ? 'bg-muted text-foreground border-muted' : 'border-dashed border-muted-foreground/30 text-muted-foreground hover:text-foreground'
              }`}>
              📁 {showArchived ? 'Amagar arxivades' : `Arxivades${archivedCount > 0 ? ` (${archivedCount})` : ''}`}
            </button>
          </div>

          {/* VISTA KANBAN */}
          {viewMode === 'kanban' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {columns.map(col => {
                const config = STATUS_CONFIG[col.status]
                const Icon = config.icon
                const colTasks = filtered.filter(t => t.status === col.status)
                return (
                  <div key={col.status} className="space-y-3">
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${config.bg} ${config.border}`}>
                      <Icon className={`h-4 w-4 ${config.style}`} />
                      <span className="text-sm font-semibold">{config.label}</span>
                      <span className="ml-auto text-xs font-bold text-muted-foreground">{colTasks.length}</span>
                    </div>
                    <div className="space-y-2 min-h-[100px]">
                      {colTasks.map(task => <TaskCard key={task.id} task={task} />)}
                      {colTasks.length === 0 && (
                        <div className="border-2 border-dashed border-border rounded-lg p-6 text-center text-muted-foreground">
                          <p className="text-xs">Cap tasca</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* VISTA LLISTA */}
          {viewMode === 'list' && (
            <div className="space-y-2">
              {filtered.length === 0 ? (
                <Card><CardContent className="py-10 text-center text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Cap tasca en aquest filtre</p>
                </CardContent></Card>
              ) : filtered.map(task => {
                const assignedProfile = task.profiles as { full_name: string; color: string | null } | null
                const clientName = (task.clients as { name: string } | null)?.name
                const isOverdue = task.due_date && task.status !== 'done' && task.due_date < new Date().toISOString().split('T')[0]
                const taskTime = getTaskTime(task.id)
                const conf = STATUS_CONFIG[task.status]
                const Icon = conf.icon
                return (
                  <Card key={task.id} className={isOverdue ? 'border-red-200 dark:border-red-800' : ''}>
                    <CardContent className="pt-3 pb-3">
                      <div className="flex items-center gap-3">
                        <Icon className={`h-4 w-4 shrink-0 ${conf.style}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                              {task.title}
                            </p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${PRIORITY_CONFIG[task.priority].style}`}>
                              {PRIORITY_CONFIG[task.priority].label}
                            </span>
                            {clientName && <span className="text-xs text-muted-foreground">{clientName}</span>}
                            {taskTime > 0 && (
                              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                <Timer className="h-3 w-3" />{formatMinutes(taskTime)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            {assignedProfile && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <User className="h-3 w-3" />{assignedProfile.full_name.split(' ')[0]}
                              </span>
                            )}
                            {task.due_date && (
                              <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-red-500' : 'text-muted-foreground'}`}>
                                <Calendar className="h-3 w-3" />{task.due_date}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {task.status !== 'done' && (
                            <button onClick={() => changeStatus(task.id, task.status === 'pending' ? 'in_progress' : 'done')}
                              disabled={loading === task.id}
                              className="text-xs px-2 py-1 rounded-lg bg-tramit-blue-light text-tramit-blue hover:bg-tramit-blue hover:text-white transition-colors font-medium">
                              {task.status === 'pending' ? 'Iniciar' : 'Fet ✓'}
                            </button>
                          )}
                          <button onClick={() => setShowTimer(showTimer === task.id ? null : task.id)}
                            className={`p-1.5 rounded-md transition-colors ${showTimer === task.id ? 'bg-tramit-blue text-white' : 'text-muted-foreground hover:bg-muted'}`}>
                            <Timer className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleDelete(task.id)}
                            disabled={loading === task.id}
                            className="p-1.5 rounded-md text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-colors"
                            title="Esborrar tasca">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      {showTimer === task.id && (
                        <div className="flex gap-1.5 items-center mt-2 pt-2 border-t flex-wrap">
                          <Input type="number" value={timerMinutes} onChange={e => setTimerMinutes(e.target.value)}
                            placeholder="Minuts" className="h-7 w-20 text-xs" min="1" autoFocus />
                          <Input value={timerDesc} onChange={e => setTimerDesc(e.target.value)}
                            placeholder="Nota (opcional)" className="h-7 flex-1 text-xs min-w-[80px]" />
                          <Button size="sm" variant="tramit" className="h-7 px-2 text-xs"
                            onClick={() => logTime(task.id, task.client_id)} disabled={saving || !timerMinutes}>
                            Desar
                          </Button>
                          <button onClick={() => setShowTimer(null)} className="text-muted-foreground p-1">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {/* Arxivades */}
          {showArchived && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted">
                <span className="text-sm font-semibold text-muted-foreground">📁 Arxivades</span>
                <span className="ml-auto text-xs font-bold text-muted-foreground">{archivedCount}</span>
              </div>
              <div className="space-y-2">
                {tasks.filter(t => t.status === 'archived').map(task => {
                  const assignedProfile = task.profiles as { full_name: string; color: string | null } | null
                  const clientName = (task.clients as { name: string } | null)?.name
                  return (
                    <Card key={task.id} className="opacity-60">
                      <CardContent className="pt-3 pb-3 px-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium line-through text-muted-foreground truncate">{task.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {assignedProfile && <span className="text-xs text-muted-foreground">{assignedProfile.full_name.split(' ')[0]}</span>}
                              {clientName && <span className="text-xs text-muted-foreground">· {clientName}</span>}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => changeStatus(task.id, 'pending')}
                              className="text-xs text-tramit-blue hover:underline shrink-0">
                              Desarxivar
                            </button>
                            <button onClick={() => handleDelete(task.id)}
                              disabled={loading === task.id}
                              className="p-1 rounded text-red-400 hover:text-red-600 transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
                {archivedCount === 0 && <p className="text-sm text-muted-foreground text-center py-4">Cap tasca arxivada</p>}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
