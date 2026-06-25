'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Mail, Phone, Clock, User,
  ChevronDown, ChevronUp, UserPlus
} from 'lucide-react'

interface ContactForm {
  id: string
  name: string
  email: string
  phone: string | null
  subject: string
  message: string
  status: string
  assigned_to: string | null
  client_id: string | null
  source: string
  created_at: string
  profiles?: { full_name: string } | null
}

interface Profile {
  id: string
  full_name: string
}

const STATUS_CONFIG: Record<string, { label: string; style: string }> = {
  new: { label: 'Nou', style: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  read: { label: 'Llegit', style: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
  assigned: { label: 'Assignat', style: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  closed: { label: 'Tancat', style: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 1000)
  if (diff < 3600) return `Fa ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `Fa ${Math.floor(diff / 3600)}h`
  return `Fa ${Math.floor(diff / 86400)} dies`
}

export function ContactesClient({
  forms,
  profiles,
}: {
  forms: ContactForm[]
  profiles: Profile[]
}) {
  const [filter, setFilter] = useState<'all' | 'new' | 'assigned' | 'closed'>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)

  const supabase = createClient()

  const filtered = forms.filter(f => filter === 'all' || f.status === filter)
  const newCount = forms.filter(f => f.status === 'new').length

  async function updateStatus(id: string, status: string) {
    setLoading(id)
    await supabase.from('contact_forms').update({ status }).eq('id', id)
    setLoading(null)
    window.location.reload()
  }

  async function assign(id: string, userId: string) {
    setLoading(id)
    await supabase
      .from('contact_forms')
      .update({ assigned_to: userId, status: 'assigned' })
      .eq('id', id)
    setLoading(null)
    window.location.reload()
  }

  async function convertToClient(form: ContactForm) {
    setLoading(form.id)
    const { data: newClient } = await supabase
      .from('clients')
      .insert({
        name: form.name,
        email: form.email,
        phone: form.phone || null,
        origin: 'other',
        status: 'lead',
      })
      .select()
      .single()

    if (newClient) {
      await supabase
        .from('contact_forms')
        .update({ client_id: newClient.id, status: 'closed' })
        .eq('id', form.id)

      await supabase.from('client_activity').insert({
        client_id: newClient.id,
        type: 'other',
        title: 'Creat des de formulari de contacte',
        body: `Consulta original: ${form.subject}`,
      })
    }
    setLoading(null)
    window.location.reload()
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Formularis de contacte</h1>
          <p className="text-muted-foreground mt-1">
            Sol·licituds rebudes des de la web
            {newCount > 0 && (
              <span className="ml-2 text-blue-600 font-medium">· {newCount} nous</span>
            )}
          </p>
        </div>
        <a
          href="/contacte"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-tramit-blue hover:underline"
        >
          Veure formulari públic →
        </a>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['all', 'new', 'assigned', 'closed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              filter === f
                ? 'bg-tramit-blue text-white'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {f === 'all' ? 'Tots' : STATUS_CONFIG[f]?.label}
            {f === 'new' && newCount > 0 && ` (${newCount})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Mail className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>Cap formulari en aquest estat</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(form => {
            const isExpanded = expanded === form.id
            const assignedName = (form.profiles as { full_name: string } | null)?.full_name

            return (
              <Card
                key={form.id}
                className={form.status === 'new' ? 'border-blue-200 dark:border-blue-800' : ''}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{form.name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CONFIG[form.status]?.style}`}>
                          {STATUS_CONFIG[form.status]?.label}
                        </span>
                        {form.client_id && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                            Client creat
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-muted-foreground mt-0.5">
                        {form.subject}
                      </p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />{form.email}
                        </span>
                        {form.phone && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />{form.phone}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />{timeAgo(form.created_at)}
                        </span>
                        {assignedName && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="h-3 w-3" />{assignedName}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setExpanded(isExpanded ? null : form.id)}
                      className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    >
                      {isExpanded
                        ? <ChevronUp className="h-4 w-4" />
                        : <ChevronDown className="h-4 w-4" />
                      }
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t space-y-4">
                      <div className="bg-muted/50 rounded-lg px-4 py-3">
                        <p className="text-sm leading-relaxed">{form.message}</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">
                            Assignar a
                          </label>
                          <select
                            defaultValue={form.assigned_to || ''}
                            onChange={e => e.target.value && assign(form.id, e.target.value)}
                            disabled={loading === form.id}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <option value="">Selecciona treballador</option>
                            {profiles.map(p => (
                              <option key={p.id} value={p.id}>{p.full_name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">
                            Canviar estat
                          </label>
                          <div className="flex gap-1.5 flex-wrap">
                            {(['read', 'assigned', 'closed'] as const).map(s => (
                              <button
                                key={s}
                                onClick={() => updateStatus(form.id, s)}
                                disabled={form.status === s || loading === form.id}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                                  form.status === s
                                    ? STATUS_CONFIG[s].style + ' ring-2 ring-offset-1 ring-tramit-blue'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                }`}
                              >
                                {STATUS_CONFIG[s].label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        <a href={`mailto:${form.email}?subject=Re: ${form.subject}`}>
                          <Button
                            size="sm"
                            variant="tramit"
                            className="flex items-center gap-1.5"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            Respondre per email
                          </Button>
                        </a>
                        {!form.client_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => convertToClient(form)}
                            disabled={loading === form.id}
                            className="flex items-center gap-1.5"
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            Convertir a client
                          </Button>
                        )}
                        {form.phone && (
                          <a href={`tel:${form.phone}`}>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex items-center gap-1.5"
                            >
                              <Phone className="h-3.5 w-3.5" />
                              Trucar
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
