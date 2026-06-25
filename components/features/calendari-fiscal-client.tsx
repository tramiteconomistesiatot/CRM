'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertCircle, Calendar, CheckCircle, Download,
  Plus, X, Pencil, Save, Trash2, RefreshCw, Building2
} from 'lucide-react'

interface Holiday { id: string; date: string; name: string; calendar_type: string; year: number }
interface Closure { id: string; date: string; name: string; year: number; deducts_vacation: boolean }

interface Deadline {
  id: string
  date: string
  name: string
  model: string | null
  description: string | null
  year: number
  color: string | null
  is_official: boolean | null
  recurring: boolean | null
  source_url: string | null
}

const MODEL_COLORS: Record<string, string> = {
  '111': '#3B82F6', '115': '#3B82F6', '123': '#3B82F6',
  '180': '#3B82F6', '190': '#3B82F6', '193': '#3B82F6',
  '303': '#6366F1', '349': '#6366F1', '390': '#6366F1',
  '130': '#10B981', '131': '#10B981',
  '200': '#F59E0B', '202': '#F59E0B',
  '100': '#EF4444', '714': '#EC4899',
  '347': '#8B5CF6', '036': '#64748B',
}

const MODEL_LABELS: Record<string, string> = {
  '100': 'Renda', '111': 'Retencions treball', '115': 'Retencions lloguers',
  '123': 'Ret. capital mob.', '130': 'IRPF autònoms', '131': 'IRPF mòduls',
  '180': 'Res. ret. lloguers', '190': 'Res. ret. treball', '193': 'Res. ret. capital',
  '200': 'Soc. anual', '202': 'Soc. fraccionat', '303': 'IVA trimestral',
  '347': 'Operacions tercers', '349': 'Intracomunitari', '390': 'IVA anual',
  '714': 'Patrimoni', '036': 'Censal',
}

const MONTH_NAMES = ['Gener','Febrer','Març','Abril','Maig','Juny','Juliol','Agost','Setembre','Octubre','Novembre','Desembre']

const MONTH_COLORS = [
  'bg-slate-50 dark:bg-slate-800/40',
  'bg-blue-50/40 dark:bg-blue-900/10',
  'bg-green-50/40 dark:bg-green-900/10',
  'bg-amber-50/40 dark:bg-amber-900/10',
  'bg-rose-50/40 dark:bg-rose-900/10',
  'bg-purple-50/40 dark:bg-purple-900/10',
  'bg-sky-50/40 dark:bg-sky-900/10',
  'bg-orange-50/40 dark:bg-orange-900/10',
  'bg-teal-50/40 dark:bg-teal-900/10',
  'bg-indigo-50/40 dark:bg-indigo-900/10',
  'bg-pink-50/40 dark:bg-pink-900/10',
  'bg-cyan-50/40 dark:bg-cyan-900/10',
]

function getDaysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0,0,0,0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

function UrgencyBadge({ days }: { days: number }) {
  if (days < 0) return <span className="text-[10px] text-muted-foreground">Passat</span>
  if (days === 0) return <span className="text-[10px] font-bold text-red-600 flex items-center gap-0.5"><AlertCircle className="h-3 w-3" />Avui!</span>
  if (days <= 3) return <span className="text-[10px] font-bold text-red-600">{days}d ⚠️</span>
  if (days <= 7) return <span className="text-[10px] font-semibold text-amber-600">{days}d</span>
  if (days <= 14) return <span className="text-[10px] text-yellow-600">{days}d</span>
  return <span className="text-[10px] text-muted-foreground">{days}d</span>
}

const EMPTY_FORM = { name: '', date: '', model: '', description: '', color: '#6366F1', recurring: false }

export function CalendariFiscalClient({
  deadlines: initialDeadlines,
  currentYear,
  isAdmin = false,
  holidays: initialHolidays = [],
  closures: initialClosures = [],
}: {
  deadlines: Deadline[]
  currentYear: number
  isAdmin?: boolean
  holidays?: Holiday[]
  closures?: Closure[]
}) {
  const [deadlines, setDeadlines] = useState<Deadline[]>(initialDeadlines)
  const [activeSubTab, setActiveSubTab] = useState<'deadlines' | 'festius' | 'tancaments'>('deadlines')
  const [localHolidays, setLocalHolidays] = useState<Holiday[]>(initialHolidays)
  const [localClosures, setLocalClosures] = useState<Closure[]>(initialClosures)
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [showHolidayForm, setShowHolidayForm] = useState(false)
  const [showClosureForm, setShowClosureForm] = useState(false)
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '' })
  const [newClosure, setNewClosure] = useState({ date: '', name: '', deducts_vacation: false })

  const [filterYear, setFilterYear] = useState(currentYear)
  const [filterModel, setFilterModel] = useState('')
  const [showPast, setShowPast] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const supabase = createClient()
  const today = new Date(); today.setHours(0,0,0,0)

  const SUB_TABS = [
    { id: 'deadlines' as const, label: 'Terminis Fiscals', icon: Calendar },
    { id: 'festius' as const, label: 'Festius no laborables', icon: Calendar },
    { id: 'tancaments' as const, label: 'Tancaments d\'empresa', icon: Building2 },
  ]

  async function handleAddHoliday() {
    if (!newHoliday.date || !newHoliday.name) return
    const year = new Date(newHoliday.date + 'T12:00:00').getFullYear()
    const { data, error } = await supabase
      .from('holidays')
      .insert({ date: newHoliday.date, name: newHoliday.name, calendar_type: 'local', year })
      .select()
      .single()
    if (!error && data) {
      setLocalHolidays(h => [...h, data])
      setNewHoliday({ date: '', name: '' })
      setShowHolidayForm(false)
    }
  }

  async function handleDeleteHoliday(id: string) {
    await supabase.from('holidays').delete().eq('id', id)
    setLocalHolidays(h => h.filter(x => x.id !== id))
  }

  async function handleAddClosure() {
    if (!newClosure.date || !newClosure.name) return
    const year = new Date(newClosure.date + 'T12:00:00').getFullYear()
    const { data, error } = await supabase
      .from('company_closures')
      .insert({ date: newClosure.date, name: newClosure.name, year, deducts_vacation: newClosure.deducts_vacation })
      .select()
      .single()
    if (!error && data) {
      setLocalClosures(c => [...c, data])
      setNewClosure({ date: '', name: '', deducts_vacation: false })
      setShowClosureForm(false)
    }
  }

  async function handleDeleteClosure(id: string) {
    await supabase.from('company_closures').delete().eq('id', id)
    setLocalClosures(c => c.filter(x => x.id !== id))
  }

  const filtered = useMemo(() => {
    let result = deadlines.filter(d => d.year === filterYear)
    if (filterModel) result = result.filter(d => d.model === filterModel)
    if (!showPast) result = result.filter(d => new Date(d.date + 'T00:00:00') >= today)
    return result.sort((a, b) => a.date.localeCompare(b.date))
  }, [deadlines, filterYear, filterModel, showPast])

  // Agrupar per mes
  const byMonth = useMemo(() => {
    const months: Record<number, Deadline[]> = {}
    filtered.forEach(d => {
      const m = new Date(d.date + 'T00:00:00').getMonth()
      if (!months[m]) months[m] = []
      months[m].push(d)
    })
    return months
  }, [filtered])

  const nextDeadline = deadlines
    .filter(d => d.year === filterYear && getDaysUntil(d.date) >= 0)
    .sort((a, b) => getDaysUntil(a.date) - getDaysUntil(b.date))[0]

  const urgentCount = deadlines.filter(d => {
    const days = getDaysUntil(d.date)
    return d.year === filterYear && days >= 0 && days <= 7
  }).length

  const availableModels = Array.from(new Set(
    deadlines.filter(d => d.year === filterYear && d.model).map(d => d.model!)
  )).sort()

  function openAdd() {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(d: Deadline) {
    setForm({
      name: d.name,
      date: d.date,
      model: d.model || '',
      description: d.description || '',
      color: d.color || '#6366F1',
      recurring: d.recurring || false,
    })
    setEditingId(d.id)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.date) return
    setSaving(true)
    const year = new Date(form.date + 'T00:00:00').getFullYear()
    const payload = {
      name: form.name.trim(),
      date: form.date,
      model: form.model.trim() || null,
      description: form.description.trim() || null,
      color: form.model && MODEL_COLORS[form.model] ? MODEL_COLORS[form.model] : form.color,
      year,
      recurring: form.recurring,
      is_official: false,
      source_url: null,
    }

    if (editingId) {
      const { data, error } = await supabase.from('fiscal_deadlines')
        .update(payload).eq('id', editingId).select().single()
      if (!error && data) {
        setDeadlines(prev => prev.map(d => d.id === editingId ? data : d))
        closeForm()
      }
    } else {
      const { data, error } = await supabase.from('fiscal_deadlines')
        .insert(payload).select().single()
      if (!error && data) {
        setDeadlines(prev => [...prev, data])
        closeForm()
      }
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    await supabase.from('fiscal_deadlines').delete().eq('id', id)
    setDeadlines(prev => prev.filter(d => d.id !== id))
    setDeleting(null)
  }

  function exportICS() {
    const events = filtered.map(d => {
      const date = d.date.replace(/-/g, '')
      return [
        'BEGIN:VEVENT',
        `DTSTART;VALUE=DATE:${date}`,
        `DTEND;VALUE=DATE:${date}`,
        `SUMMARY:${d.name}${d.model ? ` (Model ${d.model})` : ''}`,
        `DESCRIPTION:${d.description || ''}`,
        `UID:tramit-fiscal-${d.id}`,
        'END:VEVENT',
      ].join('\r\n')
    })
    const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Tràmit Economistes//Calendari Fiscal//CA','CALSCALE:GREGORIAN','METHOD:PUBLISH',...events,'END:VCALENDAR'].join('\r\n')
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `calendari-fiscal-${filterYear}.ics`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Selector de sub-pestanyes */}
      {isAdmin && (
        <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit flex-wrap">
          {SUB_TABS.map(tab => {
            const Icon = tab.icon
            return (
              <button key={tab.id} onClick={() => { setActiveSubTab(tab.id); setShowHolidayForm(false); setShowClosureForm(false); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${activeSubTab === tab.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                <Icon className="h-4 w-4" />{tab.label}
              </button>
            )
          })}
        </div>
      )}

      {activeSubTab === 'deadlines' && (
        <>
          {/* Capçalera */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold">Calendari Fiscal {filterYear}</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Font oficial: AEAT · {filtered.length} terminis
                {urgentCount > 0 && <span className="ml-2 text-red-600 font-medium">· {urgentCount} urgent{urgentCount > 1 ? 's' : ''}</span>}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={exportICS} className="flex items-center gap-1.5">
                <Download className="h-3.5 w-3.5" />Exportar ICS
              </Button>
              {isAdmin && (
                <Button variant="tramit" size="sm" onClick={openAdd} className="flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5" />Afegir termini
                </Button>
              )}
            </div>
          </div>

          {/* Formulari afegir/editar */}
          {showForm && isAdmin && (
            <Card className="border-tramit-blue/40 bg-tramit-blue-light/20 dark:bg-blue-900/10">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{editingId ? 'Editar termini' : 'Nou termini fiscal'}</CardTitle>
                  <button onClick={closeForm} className="text-muted-foreground hover:text-foreground p-1">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-medium">Nom *</label>
                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Ex: IVA 1r trimestre 2026" autoFocus />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Data *</label>
                    <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Model AEAT</label>
                    <Input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                      placeholder="Ex: 303, 130, 111..." />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-medium">Descripció (opcional)</label>
                    <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Descripció breu del termini..." />
                  </div>
                  <div className="flex items-center gap-2 sm:col-span-2">
                    <input type="checkbox" id="recurring_check" checked={form.recurring}
                      onChange={e => setForm(f => ({ ...f, recurring: e.target.checked }))} className="rounded" />
                    <label htmlFor="recurring_check" className="text-xs text-muted-foreground">
                      Termini recurrent (es repeteix cada any)
                    </label>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="tramit" size="sm" onClick={handleSave} disabled={saving || !form.name || !form.date}>
                    <Save className="h-3.5 w-3.5 mr-1" />
                    {saving ? 'Desant...' : editingId ? 'Actualitzar' : 'Afegir'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={closeForm}>Cancel·lar</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Proper termini destacat */}
          {nextDeadline && (
            <Card className={`${getDaysUntil(nextDeadline.date) <= 7 ? 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/5' : 'border-tramit-blue/30 bg-tramit-blue-light/20 dark:bg-blue-900/10'}`}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-4">
                  <div className={`text-center px-4 py-3 rounded-xl min-w-[72px] shrink-0 ${getDaysUntil(nextDeadline.date) <= 7 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-tramit-blue text-white'}`}>
                    <p className={`text-2xl font-bold leading-none ${getDaysUntil(nextDeadline.date) <= 7 ? 'text-red-700 dark:text-red-400' : 'text-white'}`}>
                      {getDaysUntil(nextDeadline.date) === 0 ? 'Avui' : getDaysUntil(nextDeadline.date)}
                    </p>
                    {getDaysUntil(nextDeadline.date) > 0 && (
                      <p className={`text-xs mt-0.5 ${getDaysUntil(nextDeadline.date) <= 7 ? 'text-red-600' : 'text-white/80'}`}>dies</p>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{nextDeadline.name}</p>
                      {nextDeadline.model && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">
                          Model {nextDeadline.model}
                          {MODEL_LABELS[nextDeadline.model] ? ` · ${MODEL_LABELS[nextDeadline.model]}` : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {new Date(nextDeadline.date + 'T00:00:00').toLocaleDateString('ca-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    {nextDeadline.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{nextDeadline.description}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Controls de filtre */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 bg-muted p-1 rounded-lg">
              {[currentYear, currentYear + 1].map(y => (
                <button key={y} onClick={() => setFilterYear(y)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${filterYear === y ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  {y}
                </button>
              ))}
            </div>

            <select value={filterModel} onChange={e => setFilterModel(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <option value="">Tots els models</option>
              {availableModels.map(m => (
                <option key={m} value={m}>Model {m}{MODEL_LABELS[m] ? ` — ${MODEL_LABELS[m]}` : ''}</option>
              ))}
            </select>

            <button onClick={() => setShowPast(!showPast)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${showPast ? 'bg-muted text-foreground border-border' : 'text-muted-foreground border-transparent hover:border-border'}`}>
              <CheckCircle className="h-3.5 w-3.5" />
              {showPast ? 'Amagar passats' : 'Mostrar passats'}
            </button>

            <span className="text-xs text-muted-foreground ml-auto hidden sm:block">
              {filtered.length} terminis
            </span>
          </div>

          {/* Llista per mesos */}
          {Object.keys(byMonth).length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>Cap termini fiscal en el període seleccionat</p>
                {!showPast && <p className="text-xs mt-1 opacity-70">Prova activar &quot;Mostrar passats&quot;</p>}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {Object.entries(byMonth)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([monthIdx, monthDeadlines]) => {
                  const mIdx = Number(monthIdx)
                  const urgentInMonth = monthDeadlines.filter(d => {
                    const days = getDaysUntil(d.date)
                    return days >= 0 && days <= 7
                  }).length

                  return (
                    <div key={monthIdx} className={`rounded-xl border border-border overflow-hidden ${MONTH_COLORS[mIdx % 12]}`}>
                      {/* Capçalera del mes */}
                      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm">{MONTH_NAMES[mIdx]}</h3>
                          <span className="text-xs text-muted-foreground">
                            {monthDeadlines.length} termini{monthDeadlines.length > 1 ? 's' : ''}
                          </span>
                          {urgentInMonth > 0 && (
                            <span className="text-xs font-bold text-red-600 flex items-center gap-0.5">
                              <AlertCircle className="h-3 w-3" />{urgentInMonth} urgent{urgentInMonth > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Terminis del mes */}
                      <div className="divide-y divide-border/40">
                        {monthDeadlines.map(d => {
                          const days = getDaysUntil(d.date)
                          const isPast = days < 0
                          const dateObj = new Date(d.date + 'T00:00:00')
                          const modelColor = d.color || (d.model ? MODEL_COLORS[d.model] : '#64748B') || '#64748B'

                          return (
                            <div key={d.id} className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/50 dark:hover:bg-white/5 ${isPast ? 'opacity-50' : ''}`}>

                              {/* Indicador de color + data */}
                              <div className="flex items-center gap-2.5 shrink-0">
                                <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: modelColor }} />
                                <div className="text-center w-8">
                                  <p className={`text-base font-bold leading-none ${isPast ? 'text-muted-foreground' : ''}`}>
                                    {dateObj.getDate()}
                                  </p>
                                  <p className="text-[9px] text-muted-foreground uppercase tracking-wide">
                                    {MONTH_NAMES[dateObj.getMonth()].slice(0, 3)}
                                  </p>
                                </div>
                              </div>

                              {/* Contingut */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className={`text-sm font-medium ${isPast ? 'line-through text-muted-foreground' : ''}`}>
                                    {d.name}
                                  </p>
                                  {d.model && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium text-white shrink-0"
                                      style={{ backgroundColor: modelColor }}>
                                      {d.model}
                                      {MODEL_LABELS[d.model] ? ` · ${MODEL_LABELS[d.model]}` : ''}
                                    </span>
                                  )}
                                  {d.is_official && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">
                                      AEAT
                                    </span>
                                  )}
                                </div>
                                {d.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{d.description}</p>
                                )}
                              </div>

                              {/* Dies restants + accions admin */}
                              <div className="flex items-center gap-2 shrink-0">
                                <UrgencyBadge days={days} />
                                {isAdmin && (
                                  <div className="flex gap-0.5 ml-1">
                                    <button onClick={() => openEdit(d)}
                                      className="p-1.5 text-muted-foreground hover:text-tramit-blue hover:bg-tramit-blue-light dark:hover:bg-blue-900/20 rounded-md transition-colors">
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button onClick={() => handleDelete(d.id)}
                                      disabled={deleting === d.id}
                                      className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors">
                                      {deleting === d.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </>
      )}

      {activeSubTab === 'festius' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">Festius no laborables {selectedYear}</CardTitle>
                <div className="flex items-center gap-2">
                  <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
                    {[2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  {isAdmin && (
                    <Button size="sm" variant="tramit" onClick={() => setShowHolidayForm(true)} className="flex items-center gap-1">
                      <Plus className="h-3.5 w-3.5" />Afegir
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {showHolidayForm && (
                <div className="flex gap-2 items-end p-3 bg-muted/50 rounded-lg flex-wrap">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Data</label>
                    <Input type="date" value={newHoliday.date} onChange={e => setNewHoliday(h => ({ ...h, date: e.target.value }))} className="h-8 w-36" />
                  </div>
                  <div className="space-y-1 flex-1 min-w-[140px]">
                    <label className="text-xs font-medium">Nom</label>
                    <Input value={newHoliday.name} onChange={e => setNewHoliday(h => ({ ...h, name: e.target.value }))} placeholder="Nom del festiu" className="h-8" />
                  </div>
                  <Button size="sm" variant="tramit" onClick={handleAddHoliday} disabled={!newHoliday.date || !newHoliday.name}>Afegir</Button>
                  <Button size="sm" variant="outline" onClick={() => setShowHolidayForm(false)}>Cancel·lar</Button>
                </div>
              )}
              {localHolidays.filter(h => h.year === selectedYear).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No hi ha festius per a {selectedYear}</p>
              ) : (
                <div className="space-y-2">
                  {localHolidays.filter(h => h.year === selectedYear).sort((a, b) => a.date.localeCompare(b.date)).map(holiday => {
                    const date = new Date(holiday.date + 'T12:00:00')
                    return (
                      <div key={holiday.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div className="text-center bg-tramit-blue text-white rounded-lg p-2 min-w-[48px]">
                            <div className="text-xs font-medium">{MONTH_NAMES[date.getMonth()]}</div>
                            <div className="text-lg font-bold leading-none">{date.getDate()}</div>
                          </div>
                          <p className="text-sm font-medium">{holiday.name}</p>
                        </div>
                        {isAdmin && (
                          <button onClick={() => handleDeleteHoliday(holiday.id)} className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeSubTab === 'tancaments' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">Tancaments d&apos;empresa {selectedYear}</CardTitle>
                <div className="flex items-center gap-2">
                  <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
                    {[2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  {isAdmin && (
                    <Button size="sm" variant="tramit" onClick={() => setShowClosureForm(true)} className="flex items-center gap-1">
                      <Plus className="h-3.5 w-3.5" />Afegir
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {showClosureForm && (
                <div className="flex gap-2 items-end p-3 bg-muted/50 rounded-lg flex-wrap">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Data</label>
                    <Input type="date" value={newClosure.date} onChange={e => setNewClosure(c => ({ ...c, date: e.target.value }))} className="h-8 w-36" />
                  </div>
                  <div className="space-y-1 flex-1 min-w-[140px]">
                    <label className="text-xs font-medium">Nom</label>
                    <Input value={newClosure.name} onChange={e => setNewClosure(c => ({ ...c, name: e.target.value }))} placeholder="Nom del tancament" className="h-8" />
                  </div>
                  <div className="flex items-center gap-2 pt-4">
                    <input type="checkbox" id="deducts" checked={newClosure.deducts_vacation} onChange={e => setNewClosure(c => ({ ...c, deducts_vacation: e.target.checked }))} className="rounded" />
                    <label htmlFor="deducts" className="text-xs whitespace-nowrap">Descompte vacances</label>
                  </div>
                  <Button size="sm" variant="tramit" onClick={handleAddClosure} disabled={!newClosure.date || !newClosure.name}>Afegir</Button>
                  <Button size="sm" variant="outline" onClick={() => setShowClosureForm(false)}>Cancel·lar</Button>
                </div>
              )}
              {localClosures.filter(c => c.year === selectedYear).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No hi ha tancaments per a {selectedYear}</p>
              ) : (
                <div className="space-y-2">
                  {localClosures.filter(c => c.year === selectedYear).sort((a, b) => a.date.localeCompare(b.date)).map(closure => {
                    const date = new Date(closure.date + 'T12:00:00')
                    return (
                      <div key={closure.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div className="text-center bg-slate-600 text-white rounded-lg p-2 min-w-[48px]">
                            <div className="text-xs font-medium">{MONTH_NAMES[date.getMonth()]}</div>
                            <div className="text-lg font-bold leading-none">{date.getDate()}</div>
                          </div>
                          <div>
                            <p className="text-sm font-medium">{closure.name}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${closure.deducts_vacation ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30' : 'bg-green-100 text-green-800 dark:bg-green-900/30'}`}>
                              {closure.deducts_vacation ? 'Descompte vacances' : 'Sense descompte'}
                            </span>
                          </div>
                        </div>
                        {isAdmin && (
                          <button onClick={() => handleDeleteClosure(closure.id)} className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
