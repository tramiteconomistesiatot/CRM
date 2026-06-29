'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  FilePen, Upload, Send, Download, Eye, RefreshCw,
  CheckCircle2, Clock, XCircle, AlertCircle, FileText,
  User, Mail, Phone, MessageSquare, X, Search,
  Building2, ChevronRight, FolderOpen, PenLine,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Client {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
}

interface SigningDocument {
  id: string
  file_name: string
  status: 'pending' | 'sent' | 'signed' | 'rejected' | 'expired'
  client_id: string | null
  client_name: string | null
  client_email: string | null
  client_phone: string | null
  created_at: string
  sent_at: string | null
  signed_at: string | null
  signed_file_url: string | null
  audit_pdf_url: string | null
  file_hash: string
  client?: Client | null
}

interface Props {
  initialDocuments: SigningDocument[]
  initialClients: Client[]
  userId: string
}

const STATUS_CONFIG = {
  pending: { label: 'Pendent d\'assignar', icon: Clock, color: 'text-amber-600 bg-amber-50 border-amber-200', dot: 'bg-amber-400' },
  sent: { label: 'Esperant firma', icon: Send, color: 'text-blue-600 bg-blue-50 border-blue-200', dot: 'bg-blue-500' },
  signed: { label: 'Signat', icon: CheckCircle2, color: 'text-green-600 bg-green-50 border-green-200', dot: 'bg-green-500' },
  rejected: { label: 'Rebutjat', icon: XCircle, color: 'text-red-600 bg-red-50 border-red-200', dot: 'bg-red-400' },
  expired: { label: 'Caducat', icon: AlertCircle, color: 'text-gray-500 bg-gray-50 border-gray-200', dot: 'bg-gray-300' },
}

type TabKey = 'pending' | 'sent' | 'signed'

export function FirmaDigitalClient({ initialDocuments, initialClients, userId }: Props) {
  const [documents, setDocuments] = useState<SigningDocument[]>(initialDocuments)
  const [clients] = useState<Client[]>(initialClients)
  const [selected, setSelected] = useState<SigningDocument | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('pending')
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [showSendForm, setShowSendForm] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [sendForm, setSendForm] = useState({ clientEmail: '', clientPhone: '', message: '' })

  // Filtered documents by tab
  const byTab: Record<TabKey, SigningDocument[]> = {
    pending: documents.filter(d => d.status === 'pending'),
    sent: documents.filter(d => d.status === 'sent'),
    signed: documents.filter(d => d.status === 'signed' || d.status === 'rejected' || d.status === 'expired'),
  }

  const tabConfig: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'pending', label: 'Per enviar', icon: Clock },
    { key: 'sent', label: 'Pendents de firma', icon: PenLine },
    { key: 'signed', label: 'Signats', icon: CheckCircle2 },
  ]

  // Client search filter
  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.company || '').toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(clientSearch.toLowerCase())
  ).slice(0, 8)

  // Dropzone
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Només es permeten fitxers PDF')
      return
    }
    setUploading(true)
    setError(null)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('uploaded_by', userId)
    if (selectedClient) {
      formData.append('client_id', selectedClient.id)
      formData.append('client_name', selectedClient.name)
      formData.append('client_email', selectedClient.email || '')
      formData.append('client_phone', selectedClient.phone || '')
    }
    try {
      const res = await fetch('/api/firma/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error pujant el fitxer')
      setDocuments(prev => [data.document, ...prev])
      setSelected(data.document)
      setActiveTab('pending')
      setSuccessMsg(`"${file.name}" pujat correctament!`)
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setUploading(false)
    }
  }, [userId, selectedClient])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    disabled: uploading,
  })

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/firma/documents')
      if (res.ok) {
        const data = await res.json()
        setDocuments(data.documents || [])
        if (selected) {
          const updated = (data.documents || []).find((d: SigningDocument) => d.id === selected.id)
          if (updated) setSelected(updated)
          else setSelected(null)
        }
      }
    } finally {
      setRefreshing(false)
    }
  }

  const handleDelete = async () => {
    if (!selected || !confirmDelete) return
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/firma/${selected.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error eliminant')
      setDocuments(prev => prev.filter(d => d.id !== selected.id))
      setSelected(null)
      setConfirmDelete(false)
      setSuccessMsg('Document eliminat correctament')
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error eliminant el document')
      setConfirmDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return
    const clientName = selectedClient?.name || selected.client_name || ''
    const clientEmail = sendForm.clientEmail || selectedClient?.email || selected.client_email || ''
    if (!clientName || !clientEmail) {
      setError('Cal indicar el client i l\'email per enviar')
      return
    }
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/firma/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: selected.id,
          clientId: selectedClient?.id || selected.client_id,
          clientName,
          clientEmail,
          clientPhone: sendForm.clientPhone || selectedClient?.phone || selected.client_phone || null,
          message: sendForm.message || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error enviant')
      const updatedDoc: SigningDocument = {
        ...selected,
        status: 'sent',
        client_name: clientName,
        client_email: clientEmail,
        client_phone: sendForm.clientPhone || selected.client_phone,
        sent_at: new Date().toISOString(),
      }
      setDocuments(prev => prev.map(d => d.id === selected.id ? updatedDoc : d))
      setSelected(updatedDoc)
      setShowSendForm(false)
      setActiveTab('sent')
      setSendForm({ clientEmail: '', clientPhone: '', message: '' })
      setSuccessMsg(data.warning || `Document enviat a ${clientEmail} ✅`)
      setTimeout(() => setSuccessMsg(null), 6000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setSending(false)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('ca-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const formatDateShort = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }

  return (
    <div className="flex gap-5 h-full min-h-0">

      {/* ───── LEFT COLUMN: Upload + Tabs + List ───── */}
      <div className="w-96 shrink-0 flex flex-col gap-4 min-h-0">

        {/* Upload area */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-3">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Pujar document</h2>

          {/* Client selector */}
          <div className="relative">
            <Label className="text-xs text-gray-600 mb-1 block">Assignar a client (opcional)</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Cercar client..."
                value={selectedClient ? selectedClient.name : clientSearch}
                onChange={e => {
                  setClientSearch(e.target.value)
                  setSelectedClient(null)
                  setShowClientDropdown(true)
                }}
                onFocus={() => setShowClientDropdown(true)}
                className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              {selectedClient && (
                <button onClick={() => { setSelectedClient(null); setClientSearch('') }} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
            {showClientDropdown && !selectedClient && clientSearch.length > 0 && filteredClients.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {filteredClients.map(c => (
                  <button
                    key={c.id}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-50 text-left transition-colors"
                    onClick={() => { setSelectedClient(c); setClientSearch(''); setShowClientDropdown(false) }}
                  >
                    <Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{c.name}</p>
                      {c.company && <p className="text-xs text-gray-400">{c.company}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedClient && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-sm">
              <Building2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-medium text-blue-800">{selectedClient.name}</span>
                {selectedClient.email && <span className="text-blue-500 text-xs ml-2">{selectedClient.email}</span>}
              </div>
            </div>
          )}

          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200 ${
              isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
            } ${uploading ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <input {...getInputProps()} />
            <Upload className={`h-6 w-6 mx-auto mb-2 ${isDragActive ? 'text-blue-500' : 'text-gray-400'}`} />
            {uploading ? (
              <p className="text-sm text-gray-500 flex items-center justify-center gap-2"><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Pujant...</p>
            ) : isDragActive ? (
              <p className="text-sm text-blue-600 font-medium">Deixa el PDF aquí</p>
            ) : (
              <>
                <p className="text-sm text-gray-600 font-medium">Arrossega el PDF aquí</p>
                <p className="text-xs text-gray-400 mt-0.5">o fes clic per seleccionar · Màx. 20 MB</p>
              </>
            )}
          </div>

          {/* Alerts */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-700">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)}><X className="h-3 w-3" /></button>
            </div>
          )}
          {successMsg && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-2.5 text-xs text-green-700">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-0 flex-1">
          <div className="flex border-b border-gray-100">
            {tabConfig.map(tab => {
              const count = byTab[tab.key].length
              const TabIcon = tab.icon
              return (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTab(tab.key); setSelected(null) }}
                  className={`flex-1 flex flex-col items-center py-3 text-center text-[11px] font-medium transition-colors border-b-2 gap-0.5 ${
                    activeTab === tab.key
                      ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                      : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <TabIcon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                  <span className={`text-base font-bold leading-none ${activeTab === tab.key ? 'text-blue-600' : 'text-gray-500'}`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Document list */}
          <div className="overflow-y-auto flex-1">
            {byTab[activeTab].length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <FolderOpen className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-xs">
                  {activeTab === 'pending' ? 'Puja un PDF per començar' :
                   activeTab === 'sent' ? 'Cap document esperant firma' :
                   'Encara no hi ha documents signats'}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {byTab[activeTab].map(doc => {
                  const cfg = STATUS_CONFIG[doc.status]
                  const isSelected = selected?.id === doc.id
                  return (
                    <li key={doc.id}>
                      <button
                        onClick={() => { setSelected(doc); setShowSendForm(false) }}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                          isSelected ? 'bg-blue-50 border-l-2 border-blue-500' : 'border-l-2 border-transparent'
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full shrink-0 ${cfg.dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{doc.file_name}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            {doc.client_name && (
                              <span className="text-xs text-gray-500 truncate">{doc.client_name}</span>
                            )}
                            {doc.client?.company && (
                              <span className="text-xs text-gray-400">· {doc.client.company}</span>
                            )}
                            {!doc.client_name && (
                              <span className="text-xs text-amber-500 italic">Sense client</span>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {activeTab === 'sent' ? `Enviat ${formatDateShort(doc.sent_at)}` :
                             activeTab === 'signed' ? `Signat ${formatDateShort(doc.signed_at)}` :
                             `Pujat ${formatDateShort(doc.created_at)}`}
                          </p>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Refresh */}
          <div className="border-t border-gray-100 px-4 py-2">
            <button onClick={handleRefresh} disabled={refreshing} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
              <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
              Actualitzar
            </button>
          </div>
        </div>
      </div>

      {/* ───── RIGHT COLUMN: Document detail ───── */}
      <div className="flex-1 min-w-0">
        {!selected ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-300 bg-white border border-gray-100 rounded-2xl shadow-sm">
            <FilePen className="h-14 w-14 mb-3 opacity-20" />
            <p className="text-sm text-gray-400">Selecciona un document per veure els detalls</p>
            <p className="text-xs text-gray-300 mt-1">o puja un nou PDF des de la columna esquerra</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm flex flex-col overflow-hidden h-full">

            {/* Header */}
            <div className="flex items-start gap-3 px-6 py-4 border-b border-gray-100">
              <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-gray-900 truncate">{selected.file_name}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  {selected.client_name && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Building2 className="h-3 w-3" />{selected.client_name}
                    </span>
                  )}
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border flex items-center gap-1 ${STATUS_CONFIG[selected.status].color}`}>
                    {(() => { const Icon = STATUS_CONFIG[selected.status].icon; return <Icon className="h-2.5 w-2.5" /> })()}
                    {STATUS_CONFIG[selected.status].label}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              {/* Client card */}
              {selected.client_name ? (
                <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Client</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-3.5 w-3.5 text-gray-400" />
                      <span className="font-medium text-gray-800">{selected.client_name}</span>
                    </div>
                    {selected.client?.company && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Building2 className="h-3.5 w-3.5 text-gray-400" />
                        {selected.client.company}
                      </div>
                    )}
                    {selected.client_email && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Mail className="h-3.5 w-3.5 text-gray-400" />
                        {selected.client_email}
                      </div>
                    )}
                    {selected.client_phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Phone className="h-3.5 w-3.5 text-gray-400" />
                        {selected.client_phone}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-700 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Aquest document no té cap client assignat. Assigna&apos;l a continuació per poder-lo enviar.</span>
                </div>
              )}

              {/* Timeline */}
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Historial</h3>
                <div className="relative pl-4 space-y-3 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-px before:bg-gray-100">
                  <div className="flex items-start gap-3 text-sm relative">
                    <span className="absolute -left-3 mt-1.5 h-2 w-2 rounded-full bg-blue-400 border-2 border-white ring-1 ring-blue-200" />
                    <div>
                      <p className="text-gray-700 font-medium">Pujat al CRM</p>
                      <p className="text-xs text-gray-400">{formatDate(selected.created_at)}</p>
                    </div>
                  </div>
                  {selected.sent_at && (
                    <div className="flex items-start gap-3 text-sm relative">
                      <span className="absolute -left-3 mt-1.5 h-2 w-2 rounded-full bg-amber-400 border-2 border-white ring-1 ring-amber-200" />
                      <div>
                        <p className="text-gray-700 font-medium">Enviat a {selected.client_email}</p>
                        <p className="text-xs text-gray-400">{formatDate(selected.sent_at)}</p>
                      </div>
                    </div>
                  )}
                  {selected.signed_at && (
                    <div className="flex items-start gap-3 text-sm relative">
                      <span className="absolute -left-3 mt-1.5 h-2 w-2 rounded-full bg-green-500 border-2 border-white ring-1 ring-green-200" />
                      <div>
                        <p className="text-gray-700 font-bold text-green-700">✅ Document signat!</p>
                        <p className="text-xs text-gray-400">{formatDate(selected.signed_at)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Downloads for signed */}
              {selected.status === 'signed' && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Descarregar</h3>
                  {selected.signed_file_url ? (
                    <a href={selected.signed_file_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-xl px-4 py-3 transition-colors">
                      <Download className="h-4 w-4" />
                      PDF signat (document oficial)
                    </a>
                  ) : (
                    <p className="text-xs text-gray-400 italic">El PDF signat s&apos;està processant, torna a actualitzar en uns instants.</p>
                  )}
                  {selected.audit_pdf_url && (
                    <a href={selected.audit_pdf_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2.5 text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-xl px-4 py-3 transition-colors">
                      <Eye className="h-4 w-4" />
                      Certificat d&apos;auditoria oficial (Yousign)
                    </a>
                  )}
                </div>
              )}

              {/* Integrity */}
              <div className="bg-gray-50 rounded-xl border border-gray-100 p-3">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Integritat del document</h3>
                <p className="text-[10px] text-gray-400 font-mono break-all leading-relaxed">{selected.file_hash}</p>
                <p className="text-[10px] text-gray-300 mt-1">Hash SHA-256 · Empremta digital que garanteix que el fitxer no ha estat modificat</p>
              </div>

              {/* SEND FORM */}
              {selected.status === 'pending' && (
                <>
                  {!showSendForm ? (
                    <Button onClick={() => setShowSendForm(true)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 text-sm font-medium flex items-center gap-2 rounded-xl shadow-sm shadow-blue-200">
                      <Send className="h-4 w-4" />
                      Enviar a firmar via Yousign (AES)
                    </Button>
                  ) : (
                    <form onSubmit={handleSend} className="space-y-3 bg-blue-50 border border-blue-100 rounded-2xl p-5">
                      <h3 className="text-sm font-bold text-blue-800 flex items-center gap-2 mb-1">
                        <Send className="h-3.5 w-3.5" /> Enviar a firmar
                      </h3>

                      {!selected.client_name && (
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-600">Nom del client *</Label>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Cercar client del CRM..."
                              value={selectedClient ? selectedClient.name : clientSearch}
                              onChange={e => { setClientSearch(e.target.value); setSelectedClient(null); setShowClientDropdown(true) }}
                              onFocus={() => setShowClientDropdown(true)}
                              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                              required={!selectedClient}
                            />
                          </div>
                          {showClientDropdown && !selectedClient && clientSearch.length > 0 && filteredClients.length > 0 && (
                            <div className="w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden mt-1">
                              {filteredClients.map(c => (
                                <button key={c.id} type="button"
                                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-50 text-left"
                                  onClick={() => { setSelectedClient(c); setClientSearch(''); setShowClientDropdown(false) }}>
                                  <Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                  <div>
                                    <p className="text-sm font-medium text-gray-800">{c.name}</p>
                                    {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                          {selectedClient && (
                            <div className="flex items-center gap-2 bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm">
                              <Building2 className="h-3.5 w-3.5 text-blue-500" />
                              <span className="font-medium text-blue-800">{selectedClient.name}</span>
                              <button type="button" onClick={() => setSelectedClient(null)} className="ml-auto"><X className="h-3 w-3 text-gray-400" /></button>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="space-y-1">
                        <Label className="text-xs text-gray-600">Email del firmant *</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                          <Input type="email" value={sendForm.clientEmail || selectedClient?.email || selected.client_email || ''}
                            onChange={e => setSendForm(f => ({ ...f, clientEmail: e.target.value }))}
                            placeholder="client@example.com"
                            className="pl-9 h-9 text-sm bg-white" required />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs text-gray-600">
                          Telèfon mòbil <span className="text-blue-600 font-medium">(recomanat → OTP SMS → Firma AES)</span>
                        </Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                          <Input type="tel" value={sendForm.clientPhone || selectedClient?.phone || selected.client_phone || ''}
                            onChange={e => setSendForm(f => ({ ...f, clientPhone: e.target.value }))}
                            placeholder="+34 600 000 000"
                            className="pl-9 h-9 text-sm bg-white" />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs text-gray-600">Missatge personalitzat (opcional)</Label>
                        <div className="relative">
                          <MessageSquare className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
                          <textarea value={sendForm.message} onChange={e => setSendForm(f => ({ ...f, message: e.target.value }))}
                            placeholder="Hola, us enviem el document per a la seva firma..."
                            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg resize-none h-16 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
                        </div>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <Button type="button" variant="outline" onClick={() => setShowSendForm(false)} className="flex-1 h-9 text-sm">
                          Cancel·lar
                        </Button>
                        <Button type="submit" disabled={sending}
                          className="flex-1 h-9 text-sm bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-1.5">
                          {sending ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Enviant...</> : <><Send className="h-3.5 w-3.5" /> Enviar ara</>}
                        </Button>
                      </div>
                    </form>
                  )}
                </>
              )}\n\n              {/* ── Delete button ─────────────────────────────── */}
              {selected.status !== 'signed' && (
                <div className="border-t border-gray-100 pt-4">
                  {!confirmDelete ? (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="w-full flex items-center justify-center gap-2 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 border border-red-100 hover:border-red-200 rounded-xl px-4 py-2.5 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                      Eliminar document
                    </button>
                  ) : (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
                      <p className="text-xs text-red-700 font-medium text-center">
                        ⚠️ Segur que vols eliminar aquest document?
                      </p>
                      <p className="text-[10px] text-red-500 text-center">
                        S&apos;eliminarà permanentment del sistema
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmDelete(false)}
                          className="flex-1 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50 transition-colors"
                        >
                          Cancel·lar
                        </button>
                        <button
                          onClick={handleDelete}
                          disabled={deleting}
                          className="flex-1 text-xs text-white bg-red-600 hover:bg-red-700 rounded-lg py-1.5 font-medium transition-colors flex items-center justify-center gap-1"
                        >
                          {deleting
                            ? <><RefreshCw className="h-3 w-3 animate-spin" /> Eliminant...</>
                            : 'Sí, eliminar'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {selected.status === 'signed' && (
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-[10px] text-gray-400 text-center">
                    🔒 Els documents signats no es poden eliminar (registre legal obligatori)
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
