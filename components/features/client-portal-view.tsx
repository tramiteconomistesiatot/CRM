'use client'

import { TramitLogo } from '@/components/layout/logo'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Phone, Mail, MapPin, Clock, CheckCircle } from 'lucide-react'

interface Client {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  nif_cif: string | null
}

interface Appointment {
  id: string
  start_time: string
  end_time: string
  topic: string
  channel: string
  status: string
  location: string | null
}

const TOPIC_LABELS: Record<string, string> = {
  fiscal: 'Fiscal',
  labor: 'Laboral',
  accounting: 'Comptable',
  income_tax: 'Renda',
  freelance: 'Autònoms',
  companies: 'Societats',
  internal_meeting: 'Reunió interna',
  client_query: 'Consulta client',
  documentation: 'Documentació',
  other: 'Altre',
}

const CHANNEL_LABELS: Record<string, string> = {
  in_person: 'Presencial',
  phone: 'Telèfon',
  video: 'Videotrucada',
  email: 'Email',
  other: 'Altre',
}

export function ClientPortalView({
  client,
  appointments,
  tokenEmail,
}: {
  client: Client
  appointments: Appointment[]
  tokenEmail: string
}) {
  const initials = client.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="min-h-screen bg-gradient-to-br from-tramit-blue-light via-white to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <header className="bg-tramit-blue-dark text-white py-4 px-6">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <TramitLogo size="sm" />
          <div className="ml-2">
            <p className="text-sm text-white/70">Portal del client</p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="h-16 w-16 rounded-full bg-tramit-blue flex items-center justify-center text-white text-2xl font-bold mx-auto">
            {initials}
          </div>
          <h1 className="text-2xl font-bold">
            Benvingut/da, {client.name.split(' ')[0]}
          </h1>
          <p className="text-muted-foreground text-sm">
            Accedint amb {tokenEmail}
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Les teves dades</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {client.company && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{client.company}</span>
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <a href={`mailto:${client.email}`} className="text-tramit-blue hover:underline">
                  {client.email}
                </a>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <a href={`tel:${client.phone}`} className="hover:text-tramit-blue">
                  {client.phone}
                </a>
              </div>
            )}
            {client.nif_cif && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>NIF/CIF: {client.nif_cif}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-tramit-blue" />
              Les teves properes cites
            </CardTitle>
          </CardHeader>
          <CardContent>
            {appointments.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Cap cita pròxima programada</p>
                <p className="text-xs mt-1">Contacta amb nosaltres per concertar una cita</p>
              </div>
            ) : (
              <div className="space-y-3">
                {appointments.map(apt => {
                  const start = new Date(apt.start_time)
                  const end = new Date(apt.end_time)
                  return (
                    <div
                      key={apt.id}
                      className="p-4 rounded-xl bg-tramit-blue-light dark:bg-blue-900/20 border border-tramit-blue/20"
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-center bg-tramit-blue text-white rounded-lg p-2 min-w-[48px]">
                          <p className="text-lg font-bold leading-none">{start.getDate()}</p>
                          <p className="text-[10px] mt-0.5 opacity-80">
                            {start.toLocaleDateString('ca-ES', { month: 'short' })}
                          </p>
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-sm">
                            {TOPIC_LABELS[apt.topic] || apt.topic}
                          </p>
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {start.toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' })}
                            {' — '}
                            {end.toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {CHANNEL_LABELS[apt.channel] || apt.channel}
                            {apt.location && ` · ${apt.location}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4 text-center space-y-3">
            <p className="text-sm font-medium">
              Necessites ajuda o vols concertar una cita?
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <a
                href="tel:+34972000000"
                className="flex items-center gap-2 bg-tramit-blue text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-tramit-blue-dark transition-colors"
              >
                <Phone className="h-4 w-4" />
                Trucar
              </a>
              <a
                href="mailto:info@tramiteconomistes.com"
                className="flex items-center gap-2 border border-tramit-blue text-tramit-blue px-4 py-2 rounded-lg text-sm font-medium hover:bg-tramit-blue-light transition-colors"
              >
                <Mail className="h-4 w-4" />
                Email
              </a>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground pb-4">
          Tràmit Economistes · Accés segur i confidencial
          <br />
          Aquest link caduca automàticament per la teva seguretat
        </p>
      </div>
    </div>
  )
}
