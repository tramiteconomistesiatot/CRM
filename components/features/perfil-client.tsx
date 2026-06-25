'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  CheckCircle, AlertTriangle, Eye, EyeOff,
  KeyRound, User, Bell, Globe, Palette
} from 'lucide-react'
import { PushNotifications } from './push-notifications'

interface Profile {
  id: string
  full_name: string
  email: string
  phone: string | null
  color: string | null
  role: string
  language: string
  telegram_chat_id: string | null
  email_notifications?: boolean | null
}

const PRESET_COLORS = [
  '#2272A3', '#1A5F8A', '#E74C3C', '#C0392B',
  '#2ECC71', '#27AE60', '#9B59B6', '#8E44AD',
  '#F39C12', '#E67E22', '#1ABC9C', '#16A085',
  '#3498DB', '#2980B9', '#E91E63', '#C2185B',
  '#FF5722', '#795548', '#607D8B', '#455A64',
]

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

type Tab = 'perfil' | 'seguretat' | 'preferencies' | 'notificacions'

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'perfil', label: 'Perfil', icon: User },
  { id: 'seguretat', label: 'Seguretat', icon: KeyRound },
  { id: 'preferencies', label: 'Preferències', icon: Globe },
  { id: 'notificacions', label: 'Notificacions', icon: Bell },
]

export function PerfilClient({ profile, takenColors = [] }: { profile: Profile; takenColors?: string[] }) {
  const [activeTab, setActiveTab] = useState<Tab>('perfil')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Perfil
  const [fullName, setFullName] = useState(profile.full_name || '')
  const [phone, setPhone] = useState(profile.phone || '')
  const [color, setColor] = useState(profile.color || '#2272A3')
  const [telegramId, setTelegramId] = useState(profile.telegram_chat_id || '')

  // Seguretat
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)

  // Preferències
  const [language, setLanguage] = useState(profile.language || 'ca')

  // Notificacions app
  const [notifApp, setNotifApp] = useState(true)
  const [notifTelegram, setNotifTelegram] = useState(!!profile.telegram_chat_id)
  const [notifEmail, setNotifEmail] = useState(profile.email_notifications !== false)

  const supabase = createClient()

  function showMsg(msg: string, isError = false) {
    if (isError) {
      setError(msg)
      setTimeout(() => setError(null), 4000)
    } else {
      setSuccess(msg)
      setTimeout(() => setSuccess(null), 3000)
    }
  }

  async function saveProfile() {
    if (!fullName.trim()) {
      showMsg('El nom complet no pot estar buit.', true)
      return
    }
    setSaving(true)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        phone: phone || null,
        color,
        telegram_chat_id: telegramId || null,
        email_notifications: notifEmail,
      })
      .eq('id', profile.id)

    setSaving(false)
    if (updateError) showMsg(updateError.message, true)
    else {
      showMsg('Perfil actualitzat correctament')
      setTimeout(() => window.location.reload(), 1000)
    }
  }

  async function savePassword() {
    if (newPassword.length < 6) {
      showMsg('La contrasenya ha de tenir mínim 6 caràcters.', true)
      return
    }
    if (newPassword !== confirmPassword) {
      showMsg('Les contrasenyes no coincideixen.', true)
      return
    }

    setSaving(true)

    // Re-autenticar amb la contrasenya actual per seguretat i per comprovar-la
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: currentPassword,
    })

    if (authError) {
      setSaving(false)
      showMsg('La contrasenya actual és incorrecta.', true)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    setSaving(false)

    if (updateError) {
      showMsg(updateError.message, true)
    } else {
      showMsg('Contrasenya canviada correctament')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  async function savePreferences() {
    setSaving(true)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ language })
      .eq('id', profile.id)

    setSaving(false)
    if (updateError) showMsg(updateError.message, true)
    else showMsg('Preferències guardades')
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Avatar i nom */}
      <div className="flex items-center gap-4">
        <div
          className="h-16 w-16 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0"
          style={{ backgroundColor: color }}
        >
          {getInitials(fullName)}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{fullName}</h1>
          <p className="text-muted-foreground text-sm">{profile.email}</p>
          <span className="text-xs bg-muted px-2 py-0.5 rounded-full mt-1 inline-block">
            {profile.role === 'admin'
              ? 'Administradora'
              : profile.role === 'supervisor'
              ? 'Supervisor'
              : 'Treballador/a'}
          </span>
        </div>
      </div>

      {/* Missatges d'estat */}
      {success && (
        <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3 rounded-lg">
          <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
          <p className="text-sm font-medium text-green-700 dark:text-green-400">{success}</p>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg flex-wrap">
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ── Tab: Perfil ───────────────────────────────────────── */}
      {activeTab === 'perfil' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Informació personal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nom complet</Label>
              <Input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Nom complet"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={profile.email} disabled className="bg-muted" />
            </div>

            <div className="space-y-1.5">
              <Label>Telèfon</Label>
              <Input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="600 000 000"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Telegram Chat ID</Label>
              <Input
                value={telegramId}
                onChange={e => setTelegramId(e.target.value)}
                placeholder="Ex: 123456789"
              />
              <p className="text-xs text-muted-foreground">
                Per rebre notificacions a Telegram. Escriu /start al bot i copia el teu ID.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Color identificatiu al calendari</Label>
              <div className="flex items-center gap-3 flex-wrap">
                <div
                  className="h-10 w-10 rounded-full border-4 border-white shadow-md shrink-0 flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: color }}
                >
                  {getInitials(fullName)}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_COLORS.filter(
                    c => !takenColors.some(tc => tc.toLowerCase() === c.toLowerCase())
                  ).map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className="h-7 w-7 rounded-full transition-transform hover:scale-110"
                      style={{
                        backgroundColor: c,
                        outline: color === c ? '3px solid #1A5F8A' : 'none',
                        outlineOffset: '2px',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <Button variant="tramit" onClick={saveProfile} disabled={saving}>
              {saving ? 'Desant...' : 'Desar canvis'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Tab: Seguretat ────────────────────────────────────── */}
      {activeTab === 'seguretat' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              Canviar contrasenya
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Contrasenya actual</Label>
              <div className="relative">
                <Input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Nova contrasenya</Label>
              <div className="relative">
                <Input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Mínim 6 caràcters"
                  minLength={6}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Confirmar nova contrasenya</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeteix la contrasenya"
              />
            </div>

            {/* Indicador de força */}
            {newPassword && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map(level => (
                    <div
                      key={level}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        newPassword.length >= level * 2
                          ? level <= 1
                            ? 'bg-red-400'
                            : level <= 2
                            ? 'bg-amber-400'
                            : level <= 3
                            ? 'bg-yellow-400'
                            : 'bg-green-500'
                          : 'bg-muted'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {newPassword.length < 6
                    ? 'Massa curta'
                    : newPassword.length < 8
                    ? 'Feble'
                    : newPassword.length < 12
                    ? 'Acceptable'
                    : 'Forta ✓'}
                </p>
              </div>
            )}

            <Button
              variant="tramit"
              onClick={savePassword}
              disabled={saving || !currentPassword || !newPassword || !confirmPassword}
            >
              {saving ? 'Canviant...' : 'Canviar contrasenya'}
            </Button>

            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                🔒 La teva contrasenya és privada. Ni l&apos;administradora la pot veure.
                Pots canviar-la quan vulguis sense notificar a ningú.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Tab: Preferències ─────────────────────────────────── */}
      {activeTab === 'preferencies' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Preferències
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Idioma de la interfície</Label>
              <div className="flex gap-2">
                {[
                  { value: 'ca', label: '🇨🇦 Català' },
                  { value: 'es', label: '🇪🇸 Castellà' },
                ].map(lang => (
                  <button
                    key={lang.value}
                    onClick={() => setLanguage(lang.value)}
                    className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                      language === lang.value
                        ? 'border-tramit-blue bg-tramit-blue text-white'
                        : 'border-border hover:border-tramit-blue/50'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Tema visual</Label>
              <div className="flex items-center gap-2 bg-muted/50 px-4 py-3 rounded-lg">
                <Palette className="h-4 w-4 text-muted-foreground shrink-0" />
                <p className="text-sm text-muted-foreground">
                  Canvia entre mode clar i fosc des de la icona a la capçalera superior dreta.
                </p>
              </div>
            </div>

            <Button variant="tramit" onClick={savePreferences} disabled={saving}>
              {saving ? 'Desant...' : 'Desar preferències'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Tab: Notificacions ────────────────────────────────── */}
      {activeTab === 'notificacions' && (
        <div className="space-y-4">
          {/* Notificacions push */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Notificacions push
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PushNotifications />
            </CardContent>
          </Card>

          {/* Notificacions app i Telegram */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Altres notificacions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                {
                  id: 'app',
                  label: "Notificacions a l'app",
                  description: "Rebre avisos dins de l'aplicació (campana superior)",
                  value: notifApp,
                  onChange: setNotifApp,
                  disabled: false,
                  disabledMsg: undefined,
                },
                {
                  id: 'email',
                  label: 'Notificacions per Email',
                  description: "Rebre avisos al teu correu electrònic quan s'aproven vacances o tens cites",
                  value: notifEmail,
                  onChange: setNotifEmail,
                  disabled: false,
                  disabledMsg: undefined,
                },
                {
                  id: 'telegram',
                  label: 'Notificacions per Telegram',
                  description: 'Rebre missatges al teu Telegram quan s\'aproven vacances o tens cites',
                  value: notifTelegram,
                  onChange: setNotifTelegram,
                  disabled: !profile.telegram_chat_id,
                  disabledMsg: !profile.telegram_chat_id
                    ? 'Cal configurar el Telegram Chat ID a la pestanya Perfil'
                    : undefined,
                },
              ].map(item => (
                <div
                  key={item.id}
                  className={`flex items-start justify-between p-4 rounded-lg border ${
                    item.disabled ? 'opacity-50 bg-muted/30' : 'bg-muted/20'
                  }`}
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                    {item.disabled && item.disabledMsg && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        {item.disabledMsg}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => !item.disabled && item.onChange(!item.value)}
                    disabled={item.disabled}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ml-4 ${
                      item.value && !item.disabled
                        ? 'bg-tramit-blue'
                        : 'bg-muted-foreground/30'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        item.value && !item.disabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}

              <Button variant="tramit" onClick={saveProfile} disabled={saving} className="w-full mt-2">
                {saving ? 'Desant...' : 'Desar preferències de notificació'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
