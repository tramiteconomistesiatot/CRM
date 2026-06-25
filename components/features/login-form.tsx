'use client'

import { useState } from 'react'
import { Eye, EyeOff, Sun, Moon, Loader2 } from 'lucide-react'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TramitLogo } from '@/components/layout/logo'
import { cn } from '@/lib/utils'

export function LoginForm() {
  const { theme, setTheme } = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showReset, setShowReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [language, setLanguage] = useState<'ca' | 'es'>('ca')

  const t = language === 'ca' ? {
    subtitle: 'Plataforma interna de gestió',
    emailLabel: 'Correu electrònic',
    emailPlaceholder: 'nom@exemple.com',
    passwordLabel: 'Contrasenya',
    loginButton: 'Entrar',
    forgotPassword: 'He oblidat la contrasenya',
    resetTitle: 'Recuperar accés',
    resetDesc: "T'enviarem un correu per restablir la contrasenya.",
    sendReset: 'Enviar correu',
    backToLogin: '← Tornar',
    resetSent: "Correu enviat! Revisa la teva safata d'entrada.",
    errorInvalid: 'Credencials incorrectes.',
    errorGeneral: "S'ha produït un error. Torna-ho a intentar.",
  } : {
    subtitle: 'Plataforma interna de gestión',
    emailLabel: 'Correo electrónico',
    emailPlaceholder: 'nombre@ejemplo.com',
    passwordLabel: 'Contraseña',
    loginButton: 'Entrar',
    forgotPassword: 'He olvidado la contraseña',
    resetTitle: 'Recuperar acceso',
    resetDesc: 'Te enviaremos un correo para restablecer la contraseña.',
    sendReset: 'Enviar correo',
    backToLogin: '← Volver',
    resetSent: '¡Correo enviado! Revisa tu bandeja de entrada.',
    errorInvalid: 'Credenciales incorrectas.',
    errorGeneral: 'Se ha producido un error. Inténtalo de nuevo.',
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (authError || !data.user) {
      setError(t.errorInvalid)
      setLoading(false)
      return
    }

    // Esperar un moment perquè la cookie es propagui
    await new Promise(resolve => setTimeout(resolve, 500))

    // Redirecció forçada amb recàrrega completa
    window.location.replace('/dashboard')
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      setResetSent(true)
    } catch {
      setError(t.errorGeneral)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-tramit-blue-light via-white to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">

      <div className="absolute top-4 right-4">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </div>

      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <TramitLogo size="lg" />
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-100 dark:border-slate-700">

          {!showReset ? (
            <>
              <div className="mb-6">
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center">{t.subtitle}</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">{t.emailLabel}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t.emailPlaceholder}
                    required
                    autoComplete="email"
                    className="h-11"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">{t.passwordLabel}</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                      className="h-11 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2.5">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  variant="tramit"
                  className="w-full h-11 text-base font-semibold"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.loginButton}
                </Button>
              </form>

              <div className="mt-4 text-center">
                <button
                  onClick={() => { setShowReset(true); setError(null) }}
                  className="text-sm text-tramit-blue hover:text-tramit-blue-dark underline-offset-4 hover:underline transition-colors"
                >
                  {t.forgotPassword}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{t.resetTitle}</h2>
                <p className="text-sm text-slate-500 mt-1">{t.resetDesc}</p>
              </div>

              {resetSent ? (
                <div className="rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 px-4 py-3">
                  <p className="text-sm text-green-700 dark:text-green-400">{t.resetSent}</p>
                </div>
              ) : (
                <form onSubmit={handleReset} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="reset-email">{t.emailLabel}</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t.emailPlaceholder}
                      required
                      className="h-11"
                    />
                  </div>
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <Button type="submit" variant="tramit" className="w-full h-11" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.sendReset}
                  </Button>
                </form>
              )}

              <div className="mt-4 text-center">
                <button
                  onClick={() => { setShowReset(false); setError(null); setResetSent(false) }}
                  className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
                >
                  {t.backToLogin}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 mt-6">
          <button onClick={() => setLanguage('ca')} className={cn('text-sm font-medium px-2 py-1 rounded transition-colors', language === 'ca' ? 'text-tramit-blue font-semibold' : 'text-slate-400 hover:text-slate-600')}>CAT</button>
          <span className="text-slate-300">|</span>
          <button onClick={() => setLanguage('es')} className={cn('text-sm font-medium px-2 py-1 rounded transition-colors', language === 'es' ? 'text-tramit-blue font-semibold' : 'text-slate-400 hover:text-slate-600')}>ESP</button>
        </div>
      </div>
    </div>
  )
}
