'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DocumentOCR } from './document-ocr'
import {
  FileText, Plus, X, Search, Send, Clock,
  CheckCircle, AlertTriangle, ExternalLink,
  Copy, Users, FolderOpen, Sparkles, Link2, Archive,
} from 'lucide-react'

interface Document {
  id: string
  name: string
  ocr_status: string | null
  ocr_summary: string | null
  created_at: string
  clients?: { name: string } | null
  profiles?: { full_name: string } | null
}

interface DocRequest {
  id: string
  client_id: string
  title: string
  description: string | null
  document_types: string[]
  status: string
  token: string
  expires_at: string
  created_at: string
  clients?: { name: string } | null
  profiles?: { full_name: string } | null
}

interface Client { id: string; name: string }
interface Profile { id: string; full_name: string }

const DOC_TYPES = [
  'DNI / NIE', 'Nòmina', 'Factura', 'Extracte bancari',
  'Certificat bancari', 'Declaració IRPF', 'Vida laboral',
  'Certificat retencions', 'Escriptura', 'Contracte', 'Altre',
]

const STATUS_CONFIG: Record<string, { label: string; style: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending:   { label: 'Pendent',   style: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',   icon: Clock },
  partial:   { label: 'Parcial',   style: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',       icon: FileText },
  completed: { label: 'Completat', style: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',   icon: CheckCircle },
  expired:   { label: 'Caducat',   style: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',      icon: AlertTriangle },
  archived:  { label: 'Arxivada',  style: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500',      icon: Archive },
}

type TabId = 'historial' | 'sollicituds' | 'ocr'

export function DocumentsClient({
  documents,
  requests: initialRequests,
  clients,
  profiles,
  isAdmin,
  currentUserId,
}: {
  documents: Document[]
  requests: DocRequest[]
  clients: Client[]
  profiles: Profile[]
  isAdmin: boolean
  currentUserId: string
}) {
  const [activeTab, setActiveTab] = useState<TabId>('historial')
  const [requests, setRequests] = useState<DocRequest[]>(initialRequests)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [form, setForm] = useState({
    client_id: '',
    title: '',
    description: '',
    document_types: [] as string[],
    expires_days: '30',
  })

  const supabase = createClient()

  const filteredDocs = useMemo(() => {
    if (!search) return documents
    const q = search.toLowerCase()
    return documents.filter(d =>
      d.name.toLowerCase().includes(q) ||
      (d.clients as { name: string } | null)?.name.toLowerCase().includes(q)
    )
  }, [documents, search])

  const visibleRequests = useMemo(() => {
    let result = showArchived ? requests : requests.filter(r => r.status !== 'archived')
    if (!search) return result
    const q = search.toLowerCase()
    return result.filter(r =>
      r.title.toLowerCase().includes(q) ||
      (r.clients as { name: string } | null)?.name.toLowerCase().includes(q)
    )
  }, [requests, search, showArchived])

  function toggleDocType(type: string) {
    setForm(f => ({
      ...f,
      document_types: f.document_types.includes(type)
        ? f.document_types.filter(t => t !== type)
        : [...f.document_types, type],
    }))
  }

  async function handleCreateRequest() {
    if (!form.client_id || !form.title || form.document_types.length === 0) return
    setSaving(true)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + parseInt(form.expires_days))

    const { data, error } = await supabase.from('document_requests').insert({
      client_id: form.client_id,
      created_by: currentUserId,
      title: form.title,
      description: form.description || null,
      document_types: form.document_types,
      expires_at: expiresAt.toISOString(),
      status: 'pending',
    }).select('*, clients(name), profiles!document_requests_created_by_fkey(full_name)').single()

    setSaving(false)
    if (!error && data) {
      setRequests(prev => [data, ...prev])
      setForm({ client_id: '', title: '', description: '', document_types: [], expires_days: '30' })
      setShowForm(false)
      setActiveTab('sollicituds')
      setMsg({ ok: true, text: 'Sol·licitud creada. Copia el link i envia\'l al client.' })
      setTimeout(() => setMsg(null), 4000)
    }
  }

  async function handleArchiveRequest(id: string) {
    if (!confirm('Arxivar aquesta sol·licitud?')) return
    await supabase.from('document_requests').update({ status: 'archived' }).eq('id', id)
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'archived' } : r))
    setMsg({ ok: true, text: 'Sol·licitud arxivada.' })
    setTimeout(() => setMsg(null), 2000)
  }

  function getPortalUrl(token: string): string {
    return `${window.location.origin}/portal/doc/${token}`
  }

  async function copyLink(token: string) {
    await navigator.clipboard.writeText(getPortalUrl(token))
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  function getDaysLeft(expiresAt: string): number {
    return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000)
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length
  const archivedCount = requests.filter(r => r.status === 'archived').length

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Capçalera */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Gestió documental i sol·licituds als clients
          </p>
        </div>
        {isAdmin && (
          <Button variant="tramit" size="sm" onClick={() => setShowForm(true)} className="flex items-center gap-1.5">
            <Send className="h-3.5 w-3.5" />Sol·licitar documents al client
          </Button>
        )}
      </div>

      {msg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${msg.ok ? 'bg-green-50 text-green-700 dark:bg-green-900/20' : 'bg-red-50 text-red-700'}`}>
          {msg.ok ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          {msg.text}
        </div>
      )}

      {/* Formulari sol·licitud */}
      {showForm && isAdmin && (
        <Card className="border-tramit-blue/40">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="h-4 w-4 text-tramit-blue" />
                Nova sol·licitud de documentació
              </CardTitle>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground p-1">
                <X className="h-4 w-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Client *</Label>
                <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="">Selecciona un client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Títol de la sol·licitud *</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Ex: Documents per a la declaració de Renda 2025" autoFocus />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Descripció (opcional)</Label>
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Instruccions addicionals per al client..." />
              </div>
              <div className="space-y-1.5">
                <Label>Link vàlid durant</Label>
                <select value={form.expires_days} onChange={e => setForm(f => ({ ...f, expires_days: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="7">7 dies</option>
                  <option value="15">15 dies</option>
                  <option value="30">30 dies</option>
                  <option value="60">60 dies</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Documents que necessites *</Label>
              <div className="flex flex-wrap gap-2">
                {DOC_TYPES.map(type => (
                  <button key={type} type="button" onClick={() => toggleDocType(type)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                      form.document_types.includes(type)
                        ? 'bg-tramit-blue text-white border-tramit-blue'
                        : 'border-border text-muted-foreground hover:border-tramit-blue/50'
                    }`}>
                    {form.document_types.includes(type) ? '✓ ' : ''}{type}
                  </button>
                ))}
              </div>
              {form.document_types.length > 0 && (
                <p className="text-xs text-muted-foreground">{form.document_types.length} documents seleccionats</p>
              )}
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3">
              <p className="text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
                <Link2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                Es generarà un link segur i únic que pots enviar al client per email o WhatsApp.
                El client podrà pujar els documents sense necessitat de compte.
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="tramit" onClick={handleCreateRequest}
                disabled={saving || !form.client_id || !form.title || form.document_types.length === 0}>
                <Send className="h-3.5 w-3.5 mr-1.5" />
                {saving ? 'Creant...' : 'Crear sol·licitud'}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel·lar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit flex-wrap">
        {([
          { id: 'historial' as TabId,    label: 'Historial',    icon: <FolderOpen className="h-3.5 w-3.5" /> },
          { id: 'sollicituds' as TabId,  label: 'Sol·licituds', icon: <Send className="h-3.5 w-3.5" />, count: pendingCount },
          { id: 'ocr' as TabId,          label: '✨ Anàlisi IA', icon: <Sparkles className="h-3.5 w-3.5" /> },
        ]).map(tab => (
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

      {/* Cerca */}
      {activeTab !== 'ocr' && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cercar per nom o client..." value={search}
            onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      )}

      {/* TAB: HISTORIAL */}
      {activeTab === 'historial' && (
        <div className="space-y-3">
          {filteredDocs.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Cap document registrat</p>
            </CardContent></Card>
          ) : filteredDocs.map(doc => {
            const clientName = (doc.clients as { name: string } | null)?.name
            const uploaderName = (doc.profiles as { full_name: string } | null)?.full_name
            return (
              <Card key={doc.id}>
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg shrink-0 ${
                      doc.ocr_status === 'done' ? 'bg-green-100 dark:bg-green-900/20' :
                      doc.ocr_status === 'error' ? 'bg-red-100 dark:bg-red-900/20' : 'bg-muted'
                    }`}>
                      {doc.ocr_status === 'done'
                        ? <CheckCircle className="h-4 w-4 text-green-600" />
                        : doc.ocr_status === 'error'
                        ? <AlertTriangle className="h-4 w-4 text-red-500" />
                        : <FileText className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.name}</p>
                      {doc.ocr_summary && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{doc.ocr_summary}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                        {clientName && <span>📁 {clientName}</span>}
                        {uploaderName && <span>· {uploaderName.split(' ')[0]}</span>}
                        <span>· {new Date(doc.created_at).toLocaleDateString('ca-ES')}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* TAB: SOL·LICITUDS */}
      {activeTab === 'sollicituds' && (
        <div className="space-y-3">
          {/* Botó mostrar arxivades */}
          {archivedCount > 0 && (
            <button onClick={() => setShowArchived(!showArchived)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5">
              <Archive className="h-3.5 w-3.5" />
              {showArchived ? 'Amagar arxivades' : `Mostrar arxivades (${archivedCount})`}
            </button>
          )}

          {visibleRequests.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <Send className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Cap sol·licitud enviada</p>
              {isAdmin && (
                <button onClick={() => setShowForm(true)}
                  className="text-xs text-tramit-blue hover:underline mt-2 block mx-auto">
                  Crear la primera sol·licitud
                </button>
              )}
            </CardContent></Card>
          ) : visibleRequests.map(req => {
            const clientName = (req.clients as { name: string } | null)?.name
            const creatorName = (req.profiles as { full_name: string } | null)?.full_name
            const daysLeft = getDaysLeft(req.expires_at)
            const isExpired = daysLeft <= 0
            const isArchived = req.status === 'archived'
            const statusKey = isArchived ? 'archived' : isExpired && req.status === 'pending' ? 'expired' : req.status
            const statusConf = STATUS_CONFIG[statusKey] || STATUS_CONFIG.pending
            const StatusIcon = statusConf.icon

            return (
              <Card key={req.id} className={`${req.status === 'pending' && !isExpired ? 'border-amber-200 dark:border-amber-800' : ''} ${isArchived ? 'opacity-60' : ''}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{req.title}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${statusConf.style}`}>
                          <StatusIcon className="h-3 w-3" />
                          {statusConf.label}
                        </span>
                      </div>
                      {clientName && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Users className="h-3 w-3" />{clientName}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {req.document_types.map(type => (
                          <span key={type} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {type}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                        {creatorName && <span>Creat per {creatorName.split(' ')[0]}</span>}
                        {!isArchived && (
                          <>
                            <span>·</span>
                            {isExpired ? (
                              <span className="text-red-500">Link caducat</span>
                            ) : (
                              <span className={daysLeft <= 5 ? 'text-amber-600' : ''}>
                                Caduca en {daysLeft} dies
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Botons */}
                    {!isArchived && (
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <button onClick={() => copyLink(req.token)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            copied === req.token
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'border-border text-muted-foreground hover:border-tramit-blue hover:text-tramit-blue'
                          }`}>
                          {copied === req.token ? <CheckCircle className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          {copied === req.token ? 'Copiat!' : 'Copiar link'}
                        </button>
                        <a href={getPortalUrl(req.token)} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:border-tramit-blue hover:text-tramit-blue transition-colors">
                          <ExternalLink className="h-3.5 w-3.5" />
                          Veure portal
                        </a>
                        {isAdmin && (
                          <button onClick={() => handleArchiveRequest(req.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:border-red-300 hover:text-red-500 transition-colors">
                            <Archive className="h-3.5 w-3.5" />
                            Arxivar
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {req.description && (
                    <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">{req.description}</p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* TAB: ANÀLISI IA / OCR */}
      {activeTab === 'ocr' && (
        <div className="space-y-4">
          <div className="bg-tramit-blue-light/30 dark:bg-blue-900/10 border border-tramit-blue/20 rounded-xl px-4 py-3">
            <p className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-tramit-blue" />
              Anàlisi intel·ligent de documents
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Puja un PDF o imatge i l&apos;IA extraurà automàticament: tipus de document, dates, imports, NIF, número de factura i anomalies.
            </p>
          </div>
          <DocumentOCR />
        </div>
      )}
    </div>
  )
}
