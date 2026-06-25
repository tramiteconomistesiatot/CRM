'use client'

import { useState } from 'react'
import { TramitLogo } from '@/components/layout/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle, AlertTriangle, Send } from 'lucide-react'

export default function ContactePage() {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', subject: '', message: ''
  })
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setError(null)

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "S'ha produït un error")
    } finally {
      setSending(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-tramit-blue-light via-white to-slate-50 p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold">Missatge enviat!</h2>
          <p className="text-muted-foreground text-sm">
            Hem rebut la teva consulta. Et respondrem en les pròximes 24 hores.
          </p>
          <button
            onClick={() => { setSuccess(false); setForm({ name: '', email: '', phone: '', subject: '', message: '' }) }}
            className="text-tramit-blue hover:underline text-sm"
          >
            Enviar una altra consulta
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-tramit-blue-light via-white to-slate-50 p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex justify-center">
          <TramitLogo size="md" />
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-100 dark:border-slate-700">
          <div className="mb-6">
            <h1 className="text-xl font-bold">Contacta amb nosaltres</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Omple el formulari i et respondrem en 24 hores
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label>Nom *</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="El teu nom"
                  required
                />
              </div>
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label>Telèfon</Label>
                <Input
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="600 000 000"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="correu@exemple.com"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Assumpte *</Label>
              <select
                value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Selecciona un assumpte</option>
                <option value="Declaració de la Renda">Declaració de la Renda</option>
                <option value="IVA trimestral">IVA trimestral</option>
                <option value="Alta d'autònom">Alta d&apos;autònom</option>
                <option value="Constitució d'empresa">Constitució d&apos;empresa</option>
                <option value="Assessoria laboral">Assessoria laboral</option>
                <option value="Comptabilitat">Comptabilitat</option>
                <option value="Consulta general">Consulta general</option>
                <option value="Altra consulta">Altra consulta</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Missatge *</Label>
              <textarea
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                placeholder="Descriu la teva consulta..."
                rows={4}
                required
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              variant="tramit"
              disabled={sending}
              className="w-full flex items-center gap-2 h-11"
            >
              <Send className="h-4 w-4" />
              {sending ? 'Enviant...' : 'Enviar consulta'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Les teves dades estan protegides d&apos;acord amb el RGPD.
          <br />
          Tràmit Economistes · Sant Feliu de Guíxols
        </p>
      </div>
    </div>
  )
}
