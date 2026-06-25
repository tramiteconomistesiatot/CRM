'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Plus, X, Search, User, Building2, Phone, Mail,
  FileText, CheckCircle, AlertTriangle, Pencil,
  ChevronDown, ChevronUp, Tag, TrendingUp,
  Clock, AlertCircle, Circle, CheckSquare,
  XCircle, MinusCircle
} from 'lucide-react'
import Link from 'next/link'

interface Client {
  id: string
  name: string
  company: string | null
  phone: string | null
  email: string | null
  nif_cif: string | null
  notes: string | null
  responsible_id: string | null
  origin: string
  status: string
  pipeline_stage: string | null
  estimated_value: number | null
  last_contact_at: string | null
  tags: string[]
  client_type: string
  address: string | null
  city: string | null
  iae: string | null
  vat_regime: string | null
  legal_form: string | null
  created_at: string
  profiles?: { full_name: string; color: string | null } | null
}

interface Profile { id: string; full_name: string; color: string | null }

const STATUS_CONFIG: Record<string, { label: string; style: string; dot: string }> = {
  prospect: { label: 'Prospecte', style: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', dot: 'bg-slate-400' },
  lead:     { label: 'Lead',      style: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', dot: 'bg-blue-500' },
  active:   { label: 'Actiu',     style: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', dot: 'bg-green-500' },
  inactive: { label: 'Inactiu',   style: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', dot: 'bg-amber-500' },
  blocked:  { label: 'Bloquejat', style: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', dot: 'bg-red-500' },
}

const CLIENT_TYPE_LABELS: Record<string, string> = {
  particular: 'Particular',
  autonomo: 'Autònom',
  empresa: 'Empresa',
  asociacion: 'Associació',
}

const ORIGIN_LABELS: Record<string, string> = {
  appointment: 'Des d\'una cita',
  manual: 'Alta manual',
  other: 'Altre',
}

// Semàfor d'estat
function TrafficLight({ client }: { client: Client }) {
  const daysSince = client.last_contact_at
    ? Math.floor((Date.now() - new Date(client.last_contact_at).getTime()) / 86400000)
    : null

  if (client.status === 'inactive' || client.status === 'blocked') {
    return (
      <div title="Client inactiu o bloquejat" className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
    )
  }
  if (!daysSince || daysSince > 90) {
    return (
      <div title={`${daysSince ? `${daysSince} dies sense contacte` : 'Sense contacte registrat'}`}
        className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
    )
  }
  return (
    <div title={`Últim contacte fa ${daysSince} dies`} className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
  )
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const EMPTY_FORM = {
  name: '', company: '', phone: '', email: '', nif_cif: '',
  notes: '', responsible_id: '', status: 'active', client_type: 'particular',
  pipeline_stage: 'new', estimated_value: '', address: '', city: '',
  iae: '', vat_regime: '', legal_form: '', tags: [] as string[],
}

export function ClientsClient({ clients: initialClients, profiles, isWorker = false }: { clients: Client[]; profiles: Profile[]; isWorker?: boolean }) {
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterResponsible, setFilterResponsible] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [tagInput, setTagInput] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)

  const supabase = createClient()

  const filtered = useMemo(() => {
    let result = clients
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.nif_cif?.toLowerCase().includes(q) ||
        c.tags?.some(t => t.toLowerCase().includes(q))
      )
    }
    if (filterStatus) result = result.filter(c => c.status === filterStatus)
    if (filterType) result = result.filter(c => c.client_type === filterType)
    if (filterResponsible) result = result.filter(c => c.responsible_id === filterResponsible)
    return result
  }, [clients, search, filterStatus, filterType, filterResponsible])

  const stats = useMemo(() => ({
    total: clients.length,
    active: clients.filter(c => c.status === 'active').length,
    leads: clients.filter(c => c.status === 'lead' || c.status === 'prospect').length,
    inactive: clients.filter(c => c.status === 'inactive').length,
  }), [clients])

  function startEdit(client: Client) {
    setForm({
      name: client.name, company: client.company || '', phone: client.phone || '',
      email: client.email || '', nif_cif: client.nif_cif || '', notes: client.notes || '',
      responsible_id: client.responsible_id || '', status: client.status,
      client_type: client.client_type, pipeline_stage: client.pipeline_stage || 'new',
      estimated_value: client.estimated_value?.toString() || '', address: client.address || '',
      city: client.city || '', iae: client.iae || '', vat_regime: client.vat_regime || '',
      legal_form: client.legal_form || '', tags: client.tags || [],
    })
    setEditingId(client.id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setShowForm(false)
    setTagInput('')
  }

  function addTag() {
    const t = tagInput.trim()
    if (t && !form.tags.includes(t)) {
      setForm(f => ({ ...f, tags: [...f.tags, t] }))
    }
    setTagInput('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return

    // Comprovar duplicats per telèfon o correu electrònic
    const normalizedEmail = form.email ? form.email.trim().toLowerCase() : ''
    const normalizedPhone = form.phone ? form.phone.trim() : ''

    if (normalizedEmail || normalizedPhone) {
      const emailDup = normalizedEmail ? clients.some(c => c.id !== editingId && c.email?.toLowerCase().trim() === normalizedEmail) : false
      const phoneDup = normalizedPhone ? clients.some(c => c.id !== editingId && c.phone?.trim() === normalizedPhone) : false

      if (emailDup) {
        setMsg({ ok: false, text: 'Ja existeix un client amb aquest correu electrònic.' })
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      if (phoneDup) {
        setMsg({ ok: false, text: 'Ja existeix un client amb aquest telèfon.' })
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
    }

    setLoading(true)
    const payload = {
      name: form.name.trim(), company: form.company || null, phone: form.phone || null,
      email: form.email || null, nif_cif: form.nif_cif || null, notes: form.notes || null,
      responsible_id: form.responsible_id || null, status: form.status,
      client_type: form.client_type, pipeline_stage: form.pipeline_stage,
      estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : null,
      address: form.address || null, city: form.city || null,
      iae: form.iae || null, vat_regime: form.vat_regime || null,
      legal_form: form.legal_form || null, tags: form.tags,
    }
    try {
      if (editingId) {
        const { data, error } = await supabase.from('clients').update(payload).eq('id', editingId).select('*, profiles!clients_responsible_id_fkey(full_name, color)').single()
        if (error) throw error
        setClients(prev => prev.map(c => c.id === editingId ? { ...c, ...data } : c))
        setMsg({ ok: true, text: 'Client actualitzat' })
      } else {
        const { data, error } = await supabase.from('clients').insert({ ...payload, origin: 'manual' }).select('*, profiles!clients_responsible_id_fkey(full_name, color)').single()
        if (error) throw error
        setClients(prev => [data, ...prev])
        setMsg({ ok: true, text: 'Client creat correctament' })
      }
      resetForm()
      setTimeout(() => setMsg(null), 3000)
    } catch {
      setMsg({ ok: false, text: 'Error desant el client' })
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Estàs segur que vols eliminar el client "${name}"? Aquesta acció no es pot desfer.`)) {
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.from('clients').delete().eq('id', id)
      if (error) throw error
      setClients(prev => prev.filter(c => c.id !== id))
      setMsg({ ok: true, text: `Client "${name}" eliminat correctament.` })
      setTimeout(() => setMsg(null), 3000)
    } catch (err) {
      setMsg({ ok: false, text: 'Error en eliminar el client. Comprova si té dades relacionades (ex. cites).' })
      window.scrollTo({ top: 0, behavior: 'smooth' })
      setTimeout(() => setMsg(null), 4000)
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('clients').update({ status }).eq('id', id)
    setClients(prev => prev.map(c => c.id === id ? { ...c, status } : c))
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Capçalera */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-muted-foreground mt-1">{clients.length} clients registrats</p>
        </div>
        <Button variant="tramit" size="sm" onClick={() => setShowForm(true)} className="flex items-center gap-1.5">
          <Plus className="h-4 w-4" />Nou client
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-foreground', dot: 'bg-muted-foreground' },
          { label: 'Actius', value: stats.active, color: 'text-green-600', dot: 'bg-green-500' },
          { label: 'Leads', value: stats.leads, color: 'text-blue-600', dot: 'bg-blue-500' },
          { label: 'Inactius', value: stats.inactive, color: 'text-amber-600', dot: 'bg-amber-500' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                <div>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {msg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${msg.ok ? 'bg-green-50 text-green-700 dark:bg-green-900/20' : 'bg-red-50 text-red-700'}`}>
          {msg.ok ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {msg.text}
        </div>
      )}

      {/* Formulari */}
      {showForm && (
        <Card className="border-tramit-blue/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{editingId ? 'Editar client' : 'Nou client'}</CardTitle>
              <button onClick={resetForm} className="text-muted-foreground hover:text-foreground p-1"><X className="h-4 w-4" /></button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Nom *</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nom complet o raó social" required autoFocus />
                </div>
                <div className="space-y-1.5">
                  <Label>Empresa</Label>
                  <Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Nom de l'empresa" />
                </div>
                <div className="space-y-1.5">
                  <Label>NIF / CIF</Label>
                  <Input value={form.nif_cif} onChange={e => setForm(f => ({ ...f, nif_cif: e.target.value }))} placeholder="12345678A" />
                </div>
                <div className="space-y-1.5">
                  <Label>Telèfon</Label>
                  <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="600 000 000" />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="client@example.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Tipus</Label>
                  <select value={form.client_type} onChange={e => setForm(f => ({ ...f, client_type: e.target.value }))}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {Object.entries(CLIENT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Estat</Label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {Object.entries(STATUS_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Forma jurídica</Label>
                  <Input value={form.legal_form} onChange={e => setForm(f => ({ ...f, legal_form: e.target.value }))} placeholder="SL, SA, Autònom..." />
                </div>
                <div className="space-y-1.5">
                  <Label>IAE</Label>
                  <Input value={form.iae} onChange={e => setForm(f => ({ ...f, iae: e.target.value }))} placeholder="Codi IAE" />
                </div>
                <div className="space-y-1.5">
                  <Label>Règim IVA</Label>
                  <select value={form.vat_regime} onChange={e => setForm(f => ({ ...f, vat_regime: e.target.value }))}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <option value="">Selecciona...</option>
                    <option value="general">Règim general</option>
                    <option value="simplificado">Règim simplificat</option>
                    <option value="recargo">Recàrrec d'equivalència</option>
                    <option value="exento">Exempt d'IVA</option>
                    <option value="otro">Altre</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Responsable intern</Label>
                  <select value={form.responsible_id} onChange={e => setForm(f => ({ ...f, responsible_id: e.target.value }))}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <option value="">Sense assignar</option>
                    {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Adreça</Label>
                  <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Carrer, número..." />
                </div>
                <div className="space-y-1.5">
                  <Label>Municipi</Label>
                  <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Girona, Barcelona..." />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Etiquetes</Label>
                  <div className="flex gap-2">
                    <Input value={tagInput} onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                      placeholder="Afegir etiqueta i prémer Enter..." />
                    <Button type="button" variant="outline" size="sm" onClick={addTag}>Afegir</Button>
                  </div>
                  {form.tags.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap mt-1">
                      {form.tags.map(tag => (
                        <span key={tag} className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-tramit-blue-light text-tramit-blue">
                          {tag}
                          <button type="button" onClick={() => setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }))}>
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Notes internes</Label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Notes internes sobre el client..." rows={3}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" variant="tramit" disabled={loading}>
                  {loading ? 'Desant...' : editingId ? 'Desar canvis' : 'Crear client'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>Cancel·lar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Cerca i filtres */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cercar per nom, empresa, email, telèfon, NIF o etiqueta..."
            value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <option value="">Tots els estats</option>
            {Object.entries(STATUS_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <option value="">Tots els tipus</option>
            {Object.entries(CLIENT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={filterResponsible} onChange={e => setFilterResponsible(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <option value="">Tots els responsables</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
          {(filterStatus || filterType || filterResponsible) && (
            <button onClick={() => { setFilterStatus(''); setFilterType(''); setFilterResponsible('') }}
              className="text-xs text-tramit-blue hover:underline">
              Netejar filtres
            </button>
          )}
          <span className="text-xs text-muted-foreground self-center ml-auto">
            {filtered.length} de {clients.length} clients
          </span>
        </div>

        {/* Llegenda semàfor */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500" />Al dia</div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-400" />+90 dies sense contacte</div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500" />Inactiu / bloquejat</div>
        </div>
      </div>

      {/* Llista de clients */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <User className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>{search ? 'Cap client coincideix amb la cerca' : 'Encara no hi ha clients registrats'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(client => {
            const isExpanded = expanded === client.id
            const responsible = client.profiles as { full_name: string; color: string | null } | null
            const daysSince = client.last_contact_at
              ? Math.floor((Date.now() - new Date(client.last_contact_at).getTime()) / 86400000)
              : null

            return (
              <Card key={client.id} className="overflow-hidden transition-colors hover:border-tramit-blue/20">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    {/* Semàfor */}
                    <div className="mt-1.5 shrink-0">
                      <TrafficLight client={client} />
                    </div>

                    {/* Avatar */}
                    <div className="h-10 w-10 rounded-full bg-tramit-blue-light dark:bg-blue-900/30 flex items-center justify-center shrink-0 text-tramit-blue font-bold text-sm">
                      {getInitials(client.name)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link href={`/dashboard/clients/${client.id}`}>
                              <p className="font-semibold text-sm hover:text-tramit-blue transition-colors cursor-pointer">{client.name}</p>
                            </Link>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CONFIG[client.status]?.style}`}>
                              {STATUS_CONFIG[client.status]?.label}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                              {CLIENT_TYPE_LABELS[client.client_type] || client.client_type}
                            </span>
                            {daysSince !== null && daysSince > 90 && (
                              <span className="text-xs text-amber-600 flex items-center gap-0.5">
                                <AlertCircle className="h-3 w-3" />{daysSince}d
                              </span>
                            )}
                          </div>
                          {client.company && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Building2 className="h-3 w-3 shrink-0" />{client.company}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-3 mt-1">
                            {client.phone && (
                              <a href={`tel:${client.phone}`} className="text-xs text-muted-foreground flex items-center gap-1 hover:text-tramit-blue">
                                <Phone className="h-3 w-3" />{client.phone}
                              </a>
                            )}
                            {client.email && (
                              <a href={`mailto:${client.email}`} className="text-xs text-muted-foreground flex items-center gap-1 hover:text-tramit-blue">
                                <Mail className="h-3 w-3" />{client.email}
                              </a>
                            )}
                            {client.nif_cif && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <FileText className="h-3 w-3" />{client.nif_cif}
                              </span>
                            )}
                            {responsible && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <User className="h-3 w-3" />{responsible.full_name.split(' ')[0]}
                              </span>
                            )}
                          </div>
                          {client.tags && client.tags.length > 0 && (
                            <div className="flex gap-1 flex-wrap mt-1.5">
                              {client.tags.map(tag => (
                                <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-tramit-blue-light dark:bg-blue-900/20 text-tramit-blue">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => startEdit(client)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setExpanded(isExpanded ? null : client.id)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t space-y-4">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                            {client.legal_form && <div><p className="text-xs font-medium text-muted-foreground">Forma jurídica</p><p>{client.legal_form}</p></div>}
                            {client.iae && <div><p className="text-xs font-medium text-muted-foreground">IAE</p><p>{client.iae}</p></div>}
                            {client.vat_regime && <div><p className="text-xs font-medium text-muted-foreground">Règim IVA</p><p>{client.vat_regime}</p></div>}
                            <div><p className="text-xs font-medium text-muted-foreground">Alta</p><p>{new Date(client.created_at).toLocaleDateString('ca-ES')}</p></div>
                            <div><p className="text-xs font-medium text-muted-foreground">Origen</p><p>{ORIGIN_LABELS[client.origin] || client.origin}</p></div>
                            <div><p className="text-xs font-medium text-muted-foreground">Últim contacte</p>
                              <p>{daysSince !== null ? `Fa ${daysSince} dies` : 'Mai'}</p></div>
                          </div>
                          {client.notes && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                              <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">{client.notes}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2">Canviar estat ràpid</p>
                            <div className="flex gap-1.5 flex-wrap">
                              {Object.entries(STATUS_CONFIG).map(([v, c]) => (
                                <button key={v} onClick={() => updateStatus(client.id, v)}
                                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                                    client.status === v ? c.style + ' ring-2 ring-offset-1 ring-tramit-blue' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                  }`}>
                                  {c.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Link href={`/dashboard/clients/${client.id}`}>
                              <Button size="sm" variant="tramit" className="flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5" />Veure fitxa completa
                              </Button>
                            </Link>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(client.id, client.name)}
                              className="text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-1.5"
                            >
                              <XCircle className="h-3.5 w-3.5" />Eliminar client
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
