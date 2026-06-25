'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle, AlertTriangle, Eye, EyeOff, KeyRound } from 'lucide-react'

interface Profile {
  id: string
  full_name: string
  email: string
  phone: string | null
  color: string | null
  role: string
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export function PerfilWorkerClient({ profile }: { profile: Profile }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 6) {
      setError('La contrasenya ha de tenir mínim 6 caràcters.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Les contrasenyes noves no coincideixen.')
      return
    }

    setLoading(true)

    try {
      // Canviar contrasenya directament per a evitar problemes amb cookies de sessió i re-autenticacions
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) throw updateError

      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setSuccess(false), 4000)
    } catch {
      setError("S'ha produït un error. Torna-ho a intentar.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold">El meu perfil</h1>
        <p className="text-muted-foreground mt-1">Informació del teu compte</p>
      </div>

      {/* Info personal */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 mb-4">
            <div
              className="h-16 w-16 rounded-full flex items-center justify-center text-white text-xl font-bold"
              style={{ backgroundColor: profile.color || '#2272A3' }}
            >
              {getInitials(profile.full_name)}
            </div>
            <div>
              <p className="text-lg font-semibold">{profile.full_name}</p>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
              {profile.phone && (
                <p className="text-sm text-muted-foreground">{profile.phone}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Canviar contrasenya */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Canviar contrasenya
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Contrasenya actual</Label>
              <div className="relative">
                <Input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
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
                  required
                  minLength={6}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
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
                required
              />
            </div>

            {success && (
              <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Contrasenya canviada correctament</span>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <Button type="submit" variant="tramit" disabled={loading}>
              {loading ? 'Canviant...' : 'Canviar contrasenya'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
