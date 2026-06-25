'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Plus, X, Pencil, Trash2, CheckCircle, AlertTriangle,
  UserCircle, KeyRound, Eye, EyeOff
} from 'lucide-react'

interface Profile {
  id: string
  email: string
  full_name: string
  role: string
  phone: string | null
  language: string
  active: boolean
  color: string | null
}

const PRESET_COLORS = [
  '#2272A3', '#1A5F8A', '#E74C3C', '#C0392B',
  '#2ECC71', '#27AE60', '#9B59B6', '#8E44AD',
  '#F39C12', '#E67E22', '#1ABC9C', '#16A085',
  '#3498DB', '#2980B9', '#E91E63', '#C2185B',
  '#FF5722', '#795548', '#607D8B', '#455A64',
]

const DEFAULT_PASSWORD = 'Tramit2026!'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administradora',
  supervisor: 'Supervisor',
  worker: 'Treballador/a',
}

const ROLE_STYLES: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  supervisor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  worker: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export function UsuarisClient({ profiles }: { profiles: Profile[] }) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [showResetModal, setShowResetModal] = useState<Profile | null>(null)
  const [newPassword, setNewPassword] = useState(DEFAULT_PASSWORD)
  const [showPassword, setShowPassword] = useState(false)
  const [useCustomPassword, setUseCustomPassword] = useState(false)

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    role: 'worker',
    color: '#2272A3',
    password: DEFAULT_PASSWORD,
  })

  const supabase = createClient()
  const workers = profiles.filter(p => p.role === 'worker')
  const admins = profiles.filter(p => p.role === 'admin' || p.role === 'supervisor')

  function startEdit(profile: Profile) {
    setEditingId(profile.id)
    setForm({
      full_name: profile.full_name,
      email: profile.email,
      phone: profile.phone || '',
      role: profile.role,
      color: profile.color || '#2272A3',
      password: DEFAULT_PASSWORD,
    })
    setShowForm(true)
    setError(null)
  }

  function resetForm() {
    setForm({ full_name: '', email: '', phone: '', role: 'worker', color: '#2272A3', password: DEFAULT_PASSWORD })
    setEditingId(null)
    setShowForm(false)
    setError(null)
  }

  function showSuccess(msg: string) {
    setSuccess(msg)
    setTimeout(() => {
      setSuccess(null)
      window.location.reload()
    }, 2000)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading('save')

    try {
      if (editingId) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            full_name: form.full_name,
            phone: form.phone || null,
            role: form.role,
            color: form.color,
          })
          .eq('id', editingId)

        if (updateError) throw updateError
        showSuccess('Usuari actualitzat correctament')
      } else {
        const res = await fetch('/api/admin/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: form.email,
            password: form.password,
            full_name: form.full_name,
            phone: form.phone,
            role: form.role,
            color: form.color,
          }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error creant usuari')
        showSuccess(`Usuari creat. Contrasenya: ${form.password}`)
      }

      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : "S'ha produït un error")
    } finally {
      setLoading(null)
    }
  }

  async function handleDelete(profileId: string) {
    setLoading(profileId)
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profileId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      showSuccess('Usuari eliminat correctament')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error eliminant usuari')
    } finally {
      setLoading(null)
      setDeleteConfirm(null)
    }
  }

  async function handleResetPassword() {
    if (!showResetModal) return
    setLoading('reset')
    try {
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: showResetModal.id, password: newPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setShowResetModal(null)
      showSuccess(`Contrasenya restablerta a: ${newPassword}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error restablint contrasenya')
    } finally {
      setLoading(null)
    }
  }

  async function handleColorChange(profileId: string, color: string) {
    await supabase.from('profiles').update({ color }).eq('id', profileId)
    window.location.reload()
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Usuaris</h1>
          <p className="text-muted-foreground mt-1">Gestió de treballadors i administradores</p>
        </div>
        {!showForm && (
          <Button variant="tramit" onClick={() => { resetForm(); setShowForm(true) }} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nou usuari
          </Button>
        )}
      </div>

      {success && (
        <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-900/20 px-4 py-3 rounded-lg">
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm font-medium">{success}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-lg">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Modal restablir contrasenya */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  Restablir contrasenya
                </CardTitle>
                <button onClick={() => setShowResetModal(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Restablint contrasenya de <strong>{showResetModal.full_name}</strong> ({showResetModal.email})
              </p>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="custom-pwd"
                  checked={useCustomPassword}
                  onChange={e => {
                    setUseCustomPassword(e.target.checked)
                    if (!e.target.checked) setNewPassword(DEFAULT_PASSWORD)
                  }}
                  className="rounded"
                />
                <label htmlFor="custom-pwd" className="text-sm">Usar contrasenya personalitzada</label>
              </div>

              <div className="space-y-1.5">
                <Label>Nova contrasenya</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    disabled={!useCustomPassword}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {!useCustomPassword && (
                  <p className="text-xs text-muted-foreground">
                    S&apos;usarà la contrasenya estàndard: <strong>{DEFAULT_PASSWORD}</strong>
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="tramit"
                  onClick={handleResetPassword}
                  disabled={loading === 'reset' || newPassword.length < 6}
                >
                  {loading === 'reset' ? 'Restablint...' : 'Restablir contrasenya'}
                </Button>
                <Button variant="outline" onClick={() => setShowResetModal(null)}>
                  Cancel·lar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Formulari nou/editar usuari */}
      {showForm && (
        <Card className="border-tramit-blue/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{editingId ? 'Editar usuari' : 'Nou usuari'}</CardTitle>
              <button onClick={resetForm} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Nom complet *</Label>
                  <Input
                    value={form.full_name}
                    onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                    placeholder="Nom i cognoms"
                    required
                  />
                </div>

                {!editingId && (
                  <div className="space-y-1.5">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="nom@tramiteconomistes.com"
                      required
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Telèfon</Label>
                  <Input
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="600 000 000"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Rol *</Label>
                  <select
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="worker">Treballador/a</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="admin">Administradora</option>
                  </select>
                </div>

                {!editingId && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Contrasenya inicial</Label>
                    <div className="relative max-w-xs">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                        placeholder="Mínim 6 caràcters"
                        required
                        minLength={6}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Per defecte: <strong>{DEFAULT_PASSWORD}</strong> — l&apos;usuari la podrà canviar des del seu perfil
                    </p>
                  </div>
                )}
              </div>

              {/* Color */}
              <div className="space-y-2">
                <Label>Color al calendari</Label>
                <div className="flex items-center gap-3 flex-wrap">
                  <div
                    className="h-10 w-10 rounded-full border-4 border-white shadow-md shrink-0 flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: form.color }}
                  >
                    {form.full_name ? getInitials(form.full_name) : '?'}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {PRESET_COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, color }))}
                        className="h-7 w-7 rounded-full transition-transform hover:scale-110 focus:outline-none"
                        style={{
                          backgroundColor: color,
                          outline: form.color === color ? '3px solid #1A5F8A' : 'none',
                          outlineOffset: '2px',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" variant="tramit" disabled={loading === 'save'}>
                  {loading === 'save' ? 'Desant...' : editingId ? 'Desar canvis' : 'Crear usuari'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel·lar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Treballadors */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Treballadors ({workers.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {workers.map(profile => (
              <div key={profile.id} className={`flex items-center gap-3 px-6 py-4 ${!profile.active ? 'opacity-50' : ''}`}>
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ backgroundColor: profile.color || '#2272A3' }}
                >
                  {getInitials(profile.full_name)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{profile.full_name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_STYLES[profile.role]}`}>
                      {ROLE_LABELS[profile.role]}
                    </span>
                    {!profile.active && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Inactiu</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{profile.email}</p>
                  {profile.phone && <p className="text-xs text-muted-foreground">{profile.phone}</p>}
                </div>

                {/* Selector de color ràpid */}
                <div className="relative group shrink-0">
                  <div
                    className="h-6 w-6 rounded-full cursor-pointer hover:scale-110 transition-transform border-2 border-white shadow"
                    style={{ backgroundColor: profile.color || '#2272A3' }}
                    title="Canviar color"
                  />
                  <div className="absolute right-0 top-8 hidden group-hover:flex flex-wrap gap-1 bg-background border border-border rounded-lg p-2 shadow-xl z-10 w-36">
                    {PRESET_COLORS.map(color => (
                      <button
                        key={color}
                        onClick={() => handleColorChange(profile.id, color)}
                        className="h-5 w-5 rounded-full hover:scale-110 transition-transform"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Accions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(profile)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Editar"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => { setShowResetModal(profile); setNewPassword(DEFAULT_PASSWORD); setUseCustomPassword(false) }}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-tramit-blue hover:bg-tramit-blue-light transition-colors"
                    title="Restablir contrasenya"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                  </button>
                  {deleteConfirm === profile.id ? (
                    <div className="flex items-center gap-1 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-md">
                      <span className="text-xs text-red-700 dark:text-red-400">Eliminar?</span>
                      <button
                        onClick={() => handleDelete(profile.id)}
                        disabled={loading === profile.id}
                        className="text-xs text-red-600 font-bold hover:underline"
                      >
                        Sí
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="text-xs text-muted-foreground hover:underline"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(profile.id)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Eliminar usuari"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Admins */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Administradores i supervisors ({admins.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {admins.map(profile => (
              <div key={profile.id} className="flex items-center gap-3 px-6 py-4">
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ backgroundColor: profile.color || '#1A5F8A' }}
                >
                  {getInitials(profile.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{profile.full_name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_STYLES[profile.role]}`}>
                      {ROLE_LABELS[profile.role]}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{profile.email}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startEdit(profile)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => { setShowResetModal(profile); setNewPassword(DEFAULT_PASSWORD); setUseCustomPassword(false) }}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-tramit-blue hover:bg-tramit-blue-light transition-colors"
                    title="Restablir contrasenya"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground flex items-center gap-1.5 pb-4">
        <UserCircle className="h-3.5 w-3.5" />
        Els usuaris poden canviar la seva contrasenya des de &quot;El meu perfil&quot; al sidebar.
      </p>
    </div>
  )
}
