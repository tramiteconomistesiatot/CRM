'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Users, Settings, Shield, Plus, X,
  CheckCircle, AlertTriangle, Pencil, Eye, EyeOff,
  ChevronDown, ChevronUp, Download, Search,
  Activity, Lock, Server, Calendar,
} from 'lucide-react'
import { SettingsClient } from './settings-client'
import { CalendariFiscalClient } from './calendari-fiscal-client'

interface ProfileData {
  id: string; full_name: string; email: string; role: string
  phone: string | null; color: string | null; active: boolean
}
interface Setting { id: string; key: string; value: string; description: string | null; category: string | null }
interface Holiday { id: string; date: string; name: string; calendar_type: string; year: number }
interface Closure { id: string; date: string; name: string; year: number; deducts_vacation: boolean }
interface FiscalDeadline {
  id: string; date: string; name: string; model: string | null
  description: string | null; year: number; color: string | null
  is_official: boolean | null; recurring: boolean | null; source_url: string | null
}
interface AuditLog {
  id: string; action: string; entity_type: string | null; created_at: string
  description?: string | null; ip_address?: string | null
  profiles?: { full_name: string; email?: string } | null
  new_values?: Record<string, unknown> | null
  old_values?: Record<string, unknown> | null
}
interface AccessLog {
  id: string; user_id: string | null; email: string | null
  ip_address: string | null; user_agent: string | null
  action: string; created_at: string
  profiles?: { full_name: string } | null
}

const PRESET_COLORS = [
  '#2272A3','#1A5F8A','#E74C3C','#2ECC71',
  '#9B59B6','#F39C12','#1ABC9C','#E91E63',
  '#FF5722','#607D8B',
]

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administradora', supervisor: 'Supervisor', worker: 'Treballador/a',
}

const ACTION_STYLES: Record<string, string> = {
  create: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  approve: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  insert: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  update: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  modify: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  edit: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  delete: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  reject: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  cancel: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  login: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  download: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  view: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
}

function getActionStyle(action: string): string {
  const key = Object.keys(ACTION_STYLES).find(k => action.toLowerCase().includes(k))
  return key ? ACTION_STYLES[key] : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + date.toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' })
}

function downloadCSV(filename: string, headers: string[], rows: (string | number | null)[]) {
  const csv = [headers.map(h => `"${h}"`).join(','), ...rows].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename + '.csv'; a.click()
  URL.revokeObjectURL(url)
}

type TabId = 'usuaris' | 'configuracio' | 'fiscal' | 'auditoria' | 'accessos' | 'sistema'

export function AdminClient({
  profiles, settings, holidays, closures, auditLogs, accessLogs = [],
  currentYear = new Date().getFullYear(), fiscalDeadlines = [],
}: {
  profiles: ProfileData[]; settings: Setting[]; holidays: Holiday[]
  closures: Closure[]; auditLogs: AuditLog[]; accessLogs?: AccessLog[]
  currentYear?: number; fiscalDeadlines?: FiscalDeadline[]
}) {
  const [activeTab, setActiveTab] = useState<TabId>('usuaris')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingUser, setEditingUser] = useState<ProfileData | null>(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedLog, setExpandedLog] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [auditSearch, setAuditSearch] = useState('')
  const [auditFilterAction, setAuditFilterAction] = useState('')
  const [auditFilterUser, setAuditFilterUser] = useState('')
  const [auditDateFrom, setAuditDateFrom] = useState('')
  const [auditDateTo, setAuditDateTo] = useState('')

  const [userForm, setUserForm] = useState({
    full_name: '', email: '', password: '', role: 'worker', phone: '', color: '#2272A3',
  })

  const supabase = createClient()

  const filteredLogs = useMemo(() => {
    let result = auditLogs
    if (auditSearch) {
      const q = auditSearch.toLowerCase()
      result = result.filter(l =>
        l.action?.toLowerCase().includes(q) ||
        l.entity_type?.toLowerCase().includes(q) ||
        (l.profiles as { full_name: string } | null)?.full_name?.toLowerCase().includes(q)
      )
    }
    if (auditFilterAction) result = result.filter(l => l.action?.toLowerCase().includes(auditFilterAction))
    if (auditFilterUser) result = result.filter(l => {
      const name = (l.profiles as { full_name: string } | null)?.full_name || ''
      return name.toLowerCase().includes(auditFilterUser.toLowerCase())
    })
    if (auditDateFrom) result = result.filter(l => l.created_at >= auditDateFrom)
    if (auditDateTo) result = result.filter(l => l.created_at <= auditDateTo + 'T23:59:59')
    return result
  }, [auditLogs, auditSearch, auditFilterAction, auditFilterUser, auditDateFrom, auditDateTo])

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSuccess('Usuari creat correctament')
      setShowCreateForm(false)
      setUserForm({ full_name: '', email: '', password: '', role: 'worker', phone: '', color: '#2272A3' })
      setTimeout(() => { setSuccess(null); window.location.reload() }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creant l'usuari")
    } finally { setSaving(false) }
  }

  async function handleUpdateUser(e: React.FormEvent) {
    e.preventDefault()
    if (!editingUser) return
    setSaving(true); setError(null)
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: userForm.full_name, role: userForm.role,
        phone: userForm.phone || null, color: userForm.color,
        active: editingUser.active,
      }).eq('id', editingUser.id)
      if (error) throw error
      setSuccess('Usuari actualitzat correctament')
      setEditingUser(null)
      setTimeout(() => { setSuccess(null); window.location.reload() }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error actualitzant l'usuari")
    } finally { setSaving(false) }
  }

  async function handleDeleteUser(userId: string, userName: string) {
    if (!confirm(`Segur que vols esborrar l'usuari "${userName}"? Aquesta acció no es pot desfer.`)) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSuccess('Usuari esborrat correctament')
      setTimeout(() => { setSuccess(null); window.location.reload() }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error esborrant l'usuari")
    } finally { setSaving(false) }
  }

  async function toggleUserActive(userId: string, active: boolean) {
    await supabase.from('profiles').update({ active: !active }).eq('id', userId)
    window.location.reload()
  }

  function startEdit(profile: ProfileData) {
    setUserForm({ full_name: profile.full_name, email: profile.email, password: '', role: profile.role, phone: profile.phone || '', color: profile.color || '#2272A3' })
    setEditingUser(profile)
    setShowCreateForm(false)
  }

  const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'usuaris',      label: 'Usuaris',        icon: Users },
    { id: 'configuracio', label: 'Configuració',   icon: Settings },
    { id: 'fiscal',       label: 'Cal. Fiscal',    icon: Calendar },
    { id: 'auditoria',    label: 'Auditoria',      icon: Shield },
    { id: 'accessos',     label: 'Accessos',       icon: Lock },
    { id: 'sistema',      label: 'Sistema',        icon: Server },
  ]

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Administració</h1>
        <p className="text-muted-foreground mt-1 text-sm">Gestió d&apos;usuaris, configuració i registres del sistema</p>
      </div>

      {success && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-green-50 text-green-700 dark:bg-green-900/20 text-sm">
          <CheckCircle className="h-4 w-4 shrink-0" />{success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 text-red-700 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit flex-wrap">
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}>
              <Icon className="h-4 w-4" />{tab.label}
            </button>
          )
        })}
      </div>

      {/* ── USUARIS ── */}
      {activeTab === 'usuaris' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="tramit" size="sm"
              onClick={() => { setShowCreateForm(true); setEditingUser(null); setUserForm({ full_name: '', email: '', password: '', role: 'worker', phone: '', color: '#2272A3' }) }}
              className="flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" />Nou usuari
            </Button>
          </div>

          {(showCreateForm || editingUser) && (
            <Card className="border-tramit-blue/30">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{editingUser ? `Editar: ${editingUser.full_name}` : 'Nou usuari'}</CardTitle>
                  <button onClick={() => { setShowCreateForm(false); setEditingUser(null) }} className="text-muted-foreground hover:text-foreground p-1">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Nom complet *</Label>
                      <Input value={userForm.full_name} onChange={e => setUserForm(f => ({ ...f, full_name: e.target.value }))} required />
                    </div>
                    {!editingUser && (
                      <>
                        <div className="space-y-1.5">
                          <Label>Email *</Label>
                          <Input type="email" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} required />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Contrasenya *</Label>
                          <div className="relative">
                            <Input type={showPassword ? 'text' : 'password'} value={userForm.password}
                              onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} required minLength={8} className="pr-10" />
                            <button type="button" onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                    <div className="space-y-1.5">
                      <Label>Rol</Label>
                      <select value={userForm.role} onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Telèfon</Label>
                      <Input value={userForm.phone} onChange={e => setUserForm(f => ({ ...f, phone: e.target.value }))} placeholder="600 000 000" />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Color d&apos;identificació</Label>
                      <div className="flex gap-2 flex-wrap">
                        {PRESET_COLORS.map(c => (
                          <button key={c} type="button" onClick={() => setUserForm(f => ({ ...f, color: c }))}
                            className={`w-8 h-8 rounded-full transition-all ${userForm.color === c ? 'ring-2 ring-offset-2 ring-tramit-blue scale-110' : 'hover:scale-105'}`}
                            style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" variant="tramit" disabled={saving}>{saving ? 'Desant...' : editingUser ? 'Actualitzar' : 'Crear usuari'}</Button>
                    <Button type="button" variant="outline" onClick={() => { setShowCreateForm(false); setEditingUser(null) }}>Cancel·lar</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {profiles.map(profile => (
              <Card key={profile.id} className={!profile.active ? 'opacity-60' : ''}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ backgroundColor: profile.color || '#2272A3' }}>
                      {profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{profile.full_name}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{ROLE_LABELS[profile.role] || profile.role}</span>
                        {!profile.active && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/20">Inactiu</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{profile.email}</p>
                      {profile.phone && <p className="text-xs text-muted-foreground">{profile.phone}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => startEdit(profile)}
                        className="p-1.5 text-muted-foreground hover:text-tramit-blue hover:bg-tramit-blue-light rounded-md transition-colors"
                        title="Editar usuari">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => toggleUserActive(profile.id, profile.active)}
                        className={`p-1.5 rounded-md transition-colors ${profile.active ? 'text-muted-foreground hover:text-amber-600 hover:bg-amber-50' : 'text-green-600 hover:bg-green-50'}`}
                        title={profile.active ? 'Desactivar usuari' : 'Activar usuari'}>
                        {profile.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <button onClick={() => handleDeleteUser(profile.id, profile.full_name)}
                        className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                        title="Esborrar usuari">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── CONFIGURACIÓ ── */}
      {activeTab === 'configuracio' && (
        <SettingsClient settings={settings} holidays={holidays} closures={closures} />
      )}

      {activeTab === 'fiscal' && (
        <CalendariFiscalClient
          deadlines={fiscalDeadlines}
          currentYear={currentYear}
          isAdmin={true}
        />
      )}

      {/* ── AUDITORIA ── */}
      {activeTab === 'auditoria' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="relative sm:col-span-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Cercar per acció, entitat o usuari..."
                    value={auditSearch} onChange={e => setAuditSearch(e.target.value)} className="pl-8 h-8 text-sm" />
                </div>
                <div>
                  <select value={auditFilterAction} onChange={e => setAuditFilterAction(e.target.value)}
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <option value="">Totes les accions</option>
                    <option value="create">Creació</option>
                    <option value="update">Modificació</option>
                    <option value="delete">Eliminació</option>
                    <option value="approve">Aprovació</option>
                    <option value="reject">Rebuig</option>
                    <option value="login">Accés</option>
                  </select>
                </div>
                <div>
                  <Input placeholder="Filtrar per usuari..." value={auditFilterUser}
                    onChange={e => setAuditFilterUser(e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Des de</label>
                  <Input type="date" value={auditDateFrom} onChange={e => setAuditDateFrom(e.target.value)} className="h-8 text-xs mt-0.5" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Fins a</label>
                  <Input type="date" value={auditDateTo} onChange={e => setAuditDateTo(e.target.value)} className="h-8 text-xs mt-0.5" />
                </div>
                <div className="flex items-end gap-2">
                  {(auditSearch || auditFilterAction || auditFilterUser || auditDateFrom || auditDateTo) && (
                    <button onClick={() => { setAuditSearch(''); setAuditFilterAction(''); setAuditFilterUser(''); setAuditDateFrom(''); setAuditDateTo('') }}
                      className="text-xs text-tramit-blue hover:underline">
                      Netejar filtres
                    </button>
                  )}
                  <Button variant="outline" size="sm" className="ml-auto flex items-center gap-1.5 h-8"
                    onClick={() => downloadCSV('auditoria', ['Data', 'Usuari', 'Acció', 'Entitat', 'IP'],
                      filteredLogs.map(l => `"${formatDate(l.created_at)}","${(l.profiles as { full_name: string } | null)?.full_name || '—'}","${l.action}","${l.entity_type || '—'}","${l.ip_address || '—'}"`)
                    )}>
                    <Download className="h-3.5 w-3.5" />CSV
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{filteredLogs.length} registres</p>
            </CardContent>
          </Card>

          <div className="space-y-1">
            {filteredLogs.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground">
                <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Cap registre d&apos;auditoria</p>
              </CardContent></Card>
            ) : filteredLogs.map(log => {
              const isExpanded = expandedLog === log.id
              const profile = log.profiles as { full_name: string } | null
              const hasDetails = log.old_values || log.new_values
              return (
                <div key={log.id} className="border border-border rounded-lg overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => hasDetails && setExpandedLog(isExpanded ? null : log.id)}>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${getActionStyle(log.action)}`}>
                      {log.action}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{profile?.full_name || '—'}</p>
                        {log.entity_type && <span className="text-xs text-muted-foreground">· {log.entity_type}</span>}
                        {log.description && <span className="text-xs text-muted-foreground">· {log.description}</span>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span>{formatDate(log.created_at)}</span>
                        {log.ip_address && <span>IP: {log.ip_address}</span>}
                      </div>
                    </div>
                    {hasDetails && (
                      <button className="text-muted-foreground p-1 shrink-0">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                  {isExpanded && hasDetails && (
                    <div className="border-t border-border px-4 py-3 bg-muted/20 space-y-2">
                      {log.old_values && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Valors anteriors:</p>
                          <pre className="text-xs bg-muted rounded-lg px-3 py-2 overflow-auto max-h-32">
                            {JSON.stringify(log.old_values, null, 2)}
                          </pre>
                        </div>
                      )}
                      {log.new_values && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Valors nous:</p>
                          <pre className="text-xs bg-muted rounded-lg px-3 py-2 overflow-auto max-h-32">
                            {JSON.stringify(log.new_values, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── ACCESSOS ── */}
      {activeTab === 'accessos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{accessLogs.length} accessos registrats</p>
            <Button variant="outline" size="sm" onClick={() => downloadCSV('accessos',
              ['Data', 'Usuari', 'Email', 'Acció', 'IP', 'Dispositiu'],
              accessLogs.map(l => `"${formatDate(l.created_at)}","${(l.profiles as { full_name: string } | null)?.full_name || '—'}","${l.email || '—'}","${l.action}","${l.ip_address || '—'}","${(l.user_agent || '').substring(0, 50)}"`)
            )} className="flex items-center gap-1.5">
              <Download className="h-3.5 w-3.5" />Exportar CSV
            </Button>
          </div>

          {accessLogs.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              <Lock className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sense registres d&apos;accés</p>
              <p className="text-xs mt-1 opacity-70">Els accessos es registren automàticament en fer login</p>
            </CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        {['Data i hora', 'Usuari', 'Acció', 'Adreça IP', 'Dispositiu'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {accessLogs.map(log => {
                        const profile = log.profiles as { full_name: string } | null
                        const isMobile = log.user_agent?.toLowerCase().includes('mobile')
                        return (
                          <tr key={log.id} className="hover:bg-muted/30">
                            <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDate(log.created_at)}</td>
                            <td className="px-4 py-2.5 font-medium">{profile?.full_name || log.email || '—'}</td>
                            <td className="px-4 py-2.5">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                log.action === 'login' ? 'bg-green-100 text-green-700 dark:bg-green-900/20' :
                                log.action === 'logout' ? 'bg-slate-100 text-slate-600 dark:bg-slate-800' :
                                'bg-amber-100 text-amber-700 dark:bg-amber-900/20'
                              }`}>{log.action}</span>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">{log.ip_address || '—'}</td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">
                              {isMobile ? '📱 Mòbil' : '💻 Escriptori'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              ⚖️ <strong>RGPD:</strong> El registre d&apos;accessos és obligatori per compliment normatiu.
              Conserva les dades durant 12 mesos. Pots exportar-les en qualsevol moment.
            </p>
          </div>
        </div>
      )}

      {/* ── SISTEMA ── */}
      {activeTab === 'sistema' && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="h-4 w-4 text-tramit-blue" />
                Estat del sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              {[
                { label: 'Base de dades', value: 'Supabase PostgreSQL · Europa (Frankfurt)', status: 'ok' },
                { label: 'Autenticació', value: 'Supabase Auth · Email + contrasenya', status: 'ok' },
                { label: 'RLS activat', value: 'Sí — totes les taules protegides per rol', status: 'ok' },
                { label: 'Còpies de seguretat', value: 'Automàtiques diàries per Supabase', status: 'ok' },
                { label: 'Desplegament', value: 'Vercel · HTTPS obligatori', status: 'ok' },
                { label: 'Email transaccional', value: 'Resend · Domini verificat', status: 'ok' },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center py-3 border-b last:border-0 text-sm">
                  <span className="text-muted-foreground">{row.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-right">{row.value}</span>
                    <div className={`w-2 h-2 rounded-full shrink-0 ${row.status === 'ok' ? 'bg-green-500' : 'bg-red-500'}`} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-tramit-blue" />
                Estadístiques de la base de dades
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: 'Usuaris', value: profiles.length },
                { label: "Registres d'auditoria", value: auditLogs.length },
                { label: "Registres d'accés", value: accessLogs.length },
                { label: 'Festius configurats', value: holidays.length },
                { label: 'Tancaments', value: closures.length },
                { label: 'Terminis fiscals', value: fiscalDeadlines.length },
              ].map(s => (
                <div key={s.label} className="text-center p-3 rounded-xl bg-muted/50">
                  <p className="text-2xl font-bold text-tramit-blue">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
            <p className="text-xs text-green-800 dark:text-green-300">
              Totes les dades es transmeten de forma xifrada (HTTPS/TLS).
              Les contrasenyes mai s&apos;emmagatzemen en text pla.
              Compliment RGPD activat.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
