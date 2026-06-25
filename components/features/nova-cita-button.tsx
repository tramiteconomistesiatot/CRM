'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, X, CheckCircle, AlertTriangle, Search, UserPlus } from 'lucide-react'

interface Profile {
  id: string
  full_name: string
  role: string
  color?: string | null
}

interface Client {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
}

const TOPIC_OPTIONS = [
  { value: 'fiscal', label: 'Fiscal' },
  { value: 'labor', label: 'Laboral' },
  { value: 'accounting', label: 'Comptable' },
  { value: 'income_tax', label: 'Renda' },
  { value: 'freelance', label: 'Autònoms' },
  { value: 'companies', label: 'Societats' },
  { value: 'internal_meeting', label: 'Reunió interna' },
  { value: 'client_query', label: 'Consulta client' },
  { value: 'documentation', label: 'Documentació' },
  { value: 'other', label: 'Altre' },
]

const CHANNEL_OPTIONS = [
  { value: 'in_person', label: 'Presencial' },
  { value: 'phone', label: 'Telèfon' },
  { value: 'video', label: 'Videotrucada' },
  { value: 'email', label: 'Email' },
  { value: 'other', label: 'Altre' },
]

const PRIORITY_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgent' },
]

interface NovaCitaButtonProps {
  profiles: Profile[]
  currentUserId: string
  currentUserRole: string
  initialDate?: string
  initialTime?: string
  onClose?: () => void
  forceOpen?: boolean
}

export function NovaCitaButton({
  profiles,
  currentUserId,
  currentUserRole,
  initialDate,
  initialTime,
  onClose,
  forceOpen = false,
}: NovaCitaButtonProps) {
  const [showForm, setShowForm] = useState(forceOpen)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [clientSearch, setClientSearch] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [filteredClients, setFilteredClients] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [creatingNewClient, setCreatingNewClient] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([])
  const [externalAttendees, setExternalAttendees] = useState<{ name: string; email: string }[]>([])
  const [extName, setExtName] = useState('')
  const [extEmail, setExtEmail] = useState('')
  const [showExternal, setShowExternal] = useState(false)
  const [showNotes, setShowNotes] = useState(false)

  function addExternalAttendee() {
    if (!extName.trim() || !extEmail.trim()) return
    if (!extEmail.includes('@')) {
      alert('Introduïu una adreça de correu vàlida')
      return
    }
    setExternalAttendees(prev => [...prev, { name: extName.trim(), email: extEmail.trim() }])
    setExtName('')
    setExtEmail('')
  }

  function removeExternalAttendee(index: number) {
    setExternalAttendees(prev => prev.filter((_, i) => i !== index))
  }

  const supabase = createClient()

  const [form, setForm] = useState({
    main_attendee_id: currentUserId,
    start_date: initialDate || '',
    start_time: initialTime || '09:00',
    end_time: initialTime ? `${String(Number(initialTime.split(':')[0]) + 1).padStart(2, '0')}:00` : '10:00',
    topic: 'fiscal',
    channel: 'in_person',
    priority: 'normal',
    location: '',
    internal_notes: '',
  })

  useEffect(() => {
    if (forceOpen) setShowForm(true)
  }, [forceOpen])

  useEffect(() => {
    if (initialDate) setForm(f => ({ ...f, start_date: initialDate }))
    if (initialTime) {
      const hour = Number(initialTime.split(':')[0])
      setForm(f => ({
        ...f,
        start_time: initialTime,
        end_time: `${String(hour + 1).padStart(2, '0')}:00`,
      }))
    }
  }, [initialDate, initialTime])

  useEffect(() => {
    async function loadClients() {
      const { data } = await supabase
        .from('clients')
        .select('id, name, company, email, phone')
        .order('name')
      setClients(data || [])
    }
    if (showForm) loadClients()
  }, [showForm])

  useEffect(() => {
    if (!clientSearch) {
      setFilteredClients(clients.slice(0, 5))
    } else {
      const q = clientSearch.toLowerCase()
      setFilteredClients(
        clients.filter(c =>
          c.name.toLowerCase().includes(q) ||
          c.company?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q)
        ).slice(0, 5)
      )
    }
  }, [clientSearch, clients])

  const workers = profiles.filter(p => p.role === 'worker' || p.role === 'admin' || p.role === 'supervisor')

  function getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  function handleWorkerClick(userId: string) {
    if (userId === form.main_attendee_id) {
      // If deselecting main attendee, set next selected attendee as main
      if (selectedAttendees.length > 0) {
        const newMain = selectedAttendees[0]
        setForm(f => ({ ...f, main_attendee_id: newMain }))
        setSelectedAttendees(prev => prev.filter(id => id !== newMain))
      } else {
        // Can't deselect the only attendee, but we can set main_attendee_id to null or empty?
        // Wait, main_attendee_id cannot be null in database. So we need at least one.
        alert("Hi ha d'haver almenys un treballador responsable de la cita.")
      }
    } else if (selectedAttendees.includes(userId)) {
      setSelectedAttendees(prev => prev.filter(id => id !== userId))
    } else {
      setSelectedAttendees(prev => [...prev, userId])
    }
  }

  function setMainAttendee(userId: string) {
    if (userId === form.main_attendee_id) return
    const oldMain = form.main_attendee_id
    setForm(f => ({ ...f, main_attendee_id: userId }))
    setSelectedAttendees(prev => {
      const filtered = prev.filter(id => id !== userId)
      return [...filtered, oldMain]
    })
  }

  function handleClose() {
    resetForm()
    if (onClose) onClose()
  }

  function resetForm() {
    setForm({
      main_attendee_id: currentUserId,
      start_date: initialDate || '',
      start_time: '09:00',
      end_time: '10:00',
      topic: 'fiscal',
      channel: 'in_person',
      priority: 'normal',
      location: '',
      internal_notes: '',
    })
    setSelectedClient(null)
    setClientSearch('')
    setCreatingNewClient(false)
    setNewClientName('')
    setSelectedAttendees([])
    setExternalAttendees([])
    setExtName('')
    setExtEmail('')
    setShowExternal(false)
    setShowNotes(false)
    setShowForm(false)
    setError(null)
    if (onClose) onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.start_date) {
      setError('Cal seleccionar una data.')
      return
    }
    if (!form.start_time) {
      setError("Cal seleccionar una hora d'inici.")
      return
    }
    if (!form.end_time) {
      setError("Cal seleccionar una hora de fi.")
      return
    }
    if (form.start_time >= form.end_time) {
      setError("L'hora de fi ha de ser posterior a l'hora d'inici.")
      return
    }
    if (!form.main_attendee_id) {
      setError("Cal seleccionar el treballador principal.")
      return
    }

    setSaving(true)
    try {
      let clientId = selectedClient?.id || null

      if (creatingNewClient && newClientName.trim()) {
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert({
            name: newClientName.trim(),
            origin: 'appointment',
            responsible_id: form.main_attendee_id,
          })
          .select()
          .single()

        if (clientError) throw clientError
        clientId = newClient.id
      }

      const startTime = `${form.start_date}T${form.start_time}:00`
      const endTime = `${form.start_date}T${form.end_time}:00`

      const res = await fetch('/api/appointments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          main_attendee_id: form.main_attendee_id,
          client_id: clientId,
          start_time: startTime,
          end_time: endTime,
          topic: form.topic,
          channel: form.channel,
          priority: form.priority,
          location: form.location || null,
          internal_notes: form.internal_notes || null,
          additionalAttendeeIds: selectedAttendees,
          externalAttendees,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error creant la cita')

      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        resetForm()
        window.location.reload()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "S'ha produït un error.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {!showForm && !forceOpen && (
        <Button
          variant="tramit"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Nova cita
        </Button>
      )}

      {(showForm || forceOpen) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="pb-2 sticky top-0 bg-background z-10 border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold">Nova cita</CardTitle>
                <button onClick={handleClose} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {success ? (
                <div className="text-center py-8 space-y-3">
                  <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                    <CheckCircle className="h-7 w-7 text-green-600" />
                  </div>
                  <p className="font-semibold text-lg">Cita creada!</p>
                  <p className="text-sm text-muted-foreground">Els assistents han rebut la notificació per email.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 items-start">
                    
                    {/* Columna Esquerra: Detalls de la cita */}
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1.5 col-span-1">
                          <Label className="text-sm">Data *</Label>
                          <Input
                            type="date"
                            value={form.start_date}
                            onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                            min={new Date().toISOString().split('T')[0]}
                            required
                            className="h-10 text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-sm">Inici *</Label>
                          <Input
                            type="time"
                            value={form.start_time}
                            onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                            min="08:00"
                            max="17:00"
                            className="h-10 text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-sm">Fi *</Label>
                          <Input
                            type="time"
                            value={form.end_time}
                            onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                            min="08:00"
                            max="17:00"
                            className="h-10 text-sm"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                          <Label className="text-sm">Temàtica *</Label>
                          <select
                            value={form.topic}
                            onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {TOPIC_OPTIONS.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-sm">Canal *</Label>
                          <select
                            value={form.channel}
                            onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {CHANNEL_OPTIONS.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                          <Label className="text-sm">Prioritat</Label>
                          <select
                            value={form.priority}
                            onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {PRIORITY_OPTIONS.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-sm">Lloc / Enllaç</Label>
                          <Input
                            value={form.location}
                            onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                            placeholder="Sala, telèfon, meet..."
                            className="h-10 text-sm"
                          />
                        </div>
                      </div>

                      {showNotes ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm">Notes internes</Label>
                            <button type="button" onClick={() => setShowNotes(false)} className="text-xs text-red-500 hover:underline">
                              Amagar
                            </button>
                          </div>
                          <textarea
                            value={form.internal_notes}
                            onChange={e => setForm(f => ({ ...f, internal_notes: e.target.value }))}
                            placeholder="Notes visibles només per a l'equip..."
                            rows={2}
                            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                          />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowNotes(true)}
                          className="text-xs text-tramit-blue hover:underline font-semibold"
                        >
                          + Afegir notes internes
                        </button>
                      )}
                    </div>

                    {/* Columna Dreta: Assistents i Convocatòria */}
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-sm flex justify-between items-baseline">
                          <span>Client <span className="text-muted-foreground font-normal text-xs">(opcional)</span></span>
                        </Label>
                        {selectedClient ? (
                          <div className="flex items-center justify-between bg-tramit-blue-light dark:bg-blue-900/20 border border-tramit-blue/30 rounded-lg px-3 py-2">
                            <div className="truncate flex-1 mr-2">
                              <p className="text-sm font-semibold truncate">{selectedClient.name}</p>
                              {selectedClient.company && (
                                <p className="text-xs text-muted-foreground truncate">{selectedClient.company}</p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => { setSelectedClient(null); setClientSearch('') }}
                              className="text-muted-foreground hover:text-foreground shrink-0"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : creatingNewClient ? (
                          <div className="flex gap-2 items-center">
                            <Input
                              placeholder="Nom del nou client..."
                              value={newClientName}
                              onChange={e => setNewClientName(e.target.value)}
                              className="h-10 text-sm"
                              autoFocus
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setCreatingNewClient(false)}
                              className="h-10 text-sm"
                            >
                              Enrere
                            </Button>
                          </div>
                        ) : (
                          <div className="relative">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                placeholder="Cercar client existent..."
                                value={clientSearch}
                                onChange={e => {
                                  setClientSearch(e.target.value)
                                  setShowClientDropdown(true)
                                }}
                                onFocus={() => setShowClientDropdown(true)}
                                className="pl-9 h-10 text-sm"
                              />
                            </div>
                            {showClientDropdown && (
                              <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-xl z-20 overflow-hidden max-h-[140px] overflow-y-auto">
                                {filteredClients.length > 0 && (
                                  <div>
                                    {filteredClients.map(client => (
                                      <button
                                        key={client.id}
                                        type="button"
                                        onClick={() => {
                                          setSelectedClient(client)
                                          setShowClientDropdown(false)
                                          setClientSearch('')
                                        }}
                                        className="w-full text-left px-3 py-2 hover:bg-muted transition-colors border-b border-border last:border-0"
                                      >
                                        <p className="text-sm font-semibold">{client.name}</p>
                                        {client.company && (
                                          <p className="text-xs text-muted-foreground">{client.company}</p>
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCreatingNewClient(true)
                                    setShowClientDropdown(false)
                                    setNewClientName(clientSearch)
                                  }}
                                  className="w-full text-left px-3 py-2.5 hover:bg-muted transition-colors flex items-center gap-2 text-tramit-blue text-sm font-medium"
                                >
                                  <UserPlus className="h-4 w-4" />
                                  <span>
                                    {clientSearch ? `Crear "${clientSearch}"` : 'Crear nou client'}
                                  </span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-sm block">Convocats de l'equip *</Label>
                        <div className="grid grid-cols-2 gap-1.5 max-h-[110px] overflow-y-auto p-1.5 border rounded-lg bg-muted/20">
                          {workers.map(p => {
                            const isMain = p.id === form.main_attendee_id
                            const isAdditional = selectedAttendees.includes(p.id)
                            const isSelected = isMain || isAdditional

                            return (
                              <div
                                key={p.id}
                                onClick={() => handleWorkerClick(p.id)}
                                className={`flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium border transition-all cursor-pointer select-none ${
                                  isSelected
                                    ? 'bg-tramit-blue/10 border-tramit-blue text-tramit-blue dark:bg-blue-900/30'
                                    : 'bg-background border-border text-muted-foreground hover:border-tramit-blue/50'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <div className="h-5 w-5 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                                    style={{ backgroundColor: p.color || '#2272A3', fontSize: '9px' }}>
                                    {getInitials(p.full_name)}
                                  </div>
                                  <span className="truncate text-xs">{p.full_name.split(' ')[0]}</span>
                                </div>
                                
                                {isSelected && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setMainAttendee(p.id)
                                    }}
                                    className="p-0.5 hover:scale-110 transition-transform shrink-0"
                                    title={isMain ? "Responsable principal" : "Fer responsable"}
                                  >
                                    {isMain ? (
                                      <span className="text-amber-500 text-sm">⭐</span>
                                    ) : (
                                      <span className="text-muted-foreground/30 hover:text-amber-500 text-sm">☆</span>
                                    )}
                                  </button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                        {(selectedAttendees.length > 0 || form.main_attendee_id) && (
                          <p className="text-xs text-muted-foreground leading-tight truncate">
                            <strong>Resp:</strong> {workers.find(p => p.id === form.main_attendee_id)?.full_name.split(' ')[0]}
                            {selectedAttendees.length > 0 && ` | +${selectedAttendees.length} convocats`}
                          </p>
                        )}
                      </div>

                      {showExternal ? (
                        <div className="space-y-1.5 border-t border-border/40 pt-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm">Assistents externs</Label>
                            <button type="button" onClick={() => setShowExternal(false)} className="text-xs text-red-500 hover:underline">
                              Amagar
                            </button>
                          </div>
                          <div className="flex gap-1.5">
                            <Input
                              placeholder="Nom"
                              value={extName}
                              onChange={e => setExtName(e.target.value)}
                              className="h-10 text-sm flex-1"
                            />
                            <Input
                              placeholder="Email"
                              value={extEmail}
                              onChange={e => setExtEmail(e.target.value)}
                              className="h-10 text-sm flex-1"
                            />
                            <Button type="button" variant="outline" size="sm" onClick={addExternalAttendee} className="h-10 px-3 text-sm shrink-0">
                              +
                            </Button>
                          </div>

                          {externalAttendees.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5 max-h-[60px] overflow-y-auto p-1 bg-muted/30 rounded border">
                              {externalAttendees.map((ext, idx) => (
                                <div key={idx} className="flex items-center gap-1.5 bg-background border rounded-full px-2.5 py-1 text-xs text-muted-foreground font-medium">
                                  <span className="truncate max-w-[120px]">{ext.name}</span>
                                  <button type="button" onClick={() => removeExternalAttendee(idx)} className="text-muted-foreground hover:text-red-500 font-bold">
                                    &times;
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => setShowExternal(true)}
                            className="text-xs text-tramit-blue hover:underline font-semibold"
                          >
                            + Afegir assistents externs
                          </button>
                        </div>
                      )}
                    </div>

                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      {error}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2 border-t border-border">
                    <Button type="submit" variant="tramit" disabled={saving} className="flex-1 h-10 text-sm">
                      {saving ? 'Creant...' : 'Crear cita'}
                    </Button>
                    <Button type="button" variant="outline" onClick={handleClose} className="h-10 text-sm">
                      Cancel·lar
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
