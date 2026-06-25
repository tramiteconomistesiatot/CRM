'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Umbrella, ClipboardList, X, Clock, User, MapPin, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NovaCitaButton } from './nova-cita-button'

interface Absence {
  id: string
  user_id: string
  type: string
  start_date: string
  end_date: string
  status: string
  profiles?: { full_name: string; color: string | null } | null
}

interface Appointment {
  id: string
  start_time: string
  end_time: string
  topic: string
  channel: string
  status: string
  priority: string
  location: string | null
  internal_notes: string | null
  main_attendee_id: string
  created_by: string
  profiles?: { full_name: string; color: string | null } | null
  clients?: { name: string } | null
  appointment_attendees?: {
    user_id: string
    is_main: boolean
    status: string
    profiles?: { full_name: string; color: string | null } | null
  }[]
}

interface Profile {
  id: string
  full_name: string
  color: string | null
  role: string
}

interface Holiday { date: string; name: string }
interface Closure { date: string; name: string }
interface FiscalDeadline {
  id: string
  date: string
  name: string
  model: string | null
}

const DAYS_CA = ['Dl', 'Dt', 'Dc', 'Dj', 'Dv', 'Ds', 'Dg']
const DAYS_FULL_CA = ['Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte', 'Diumenge']
const MONTHS_CA = ['Gener', 'Febrer', 'Març', 'Abril', 'Maig', 'Juny', 'Juliol', 'Agost', 'Setembre', 'Octubre', 'Novembre', 'Desembre']
const HOURS = Array.from({ length: 11 }, (_, i) => i + 7)

const TOPIC_LABELS: Record<string, string> = {
  fiscal: 'Fiscal', labor: 'Laboral', accounting: 'Comptable',
  income_tax: 'Renda', freelance: 'Autònoms', companies: 'Societats',
  internal_meeting: 'Reunió interna', client_query: 'Consulta client',
  documentation: 'Documentació', other: 'Altre',
}

const CHANNEL_LABELS: Record<string, string> = {
  in_person: 'Presencial', phone: 'Telèfon',
  video: 'Videotrucada', email: 'Email', other: 'Altre',
}

const STATUS_STYLES: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  pending:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmada', pending: 'Pendent', cancelled: 'Cancel·lada',
}

type ViewMode = 'mes' | 'setmana' | 'dia'

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function toLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(12, 0, 0, 0)
  return d
}

function formatTime(isoStr: string): string {
  const d = new Date(isoStr)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function AgendaClient({
  absences,
  profiles,
  holidays,
  closures,
  currentUserId,
  currentUserRole,
  fiscalDeadlines = [],
  appointments = [],
}: {
  absences: Absence[]
  profiles: Profile[]
  holidays: Holiday[]
  closures: Closure[]
  currentUserId: string
  currentUserRole: string
  fiscalDeadlines?: FiscalDeadline[]
  appointments?: Appointment[]
}) {
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const todayStr = toLocalDateStr(today)
  const router = useRouter()

  const activeAppointments = (appointments || []).filter(
    apt => apt.status !== 'cancelled' && apt.status !== 'rejected'
  )

  const [viewMode, setViewMode] = useState<ViewMode>('mes')
  const [currentDate, setCurrentDate] = useState(new Date(today))
  const [filterUser, setFilterUser] = useState<string>('all')
  const [calendarScope, setCalendarScope] = useState<'personal' | 'shared'>('shared')
  const [showFiscal, setShowFiscal] = useState(false)
  const [newCitaDate, setNewCitaDate] = useState<string | null>(null)
  const [newCitaTime, setNewCitaTime] = useState<string | null>(null)
  const [showNovaCita, setShowNovaCita] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)

  const holidayDates = new Map(holidays.map(h => [h.date, h.name]))
  const closureDates = new Map(closures.map(c => [c.date, c.name]))
  const fiscalDates = new Map(fiscalDeadlines.map(d => [d.date, d]))

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  function isSpecialDay(date: Date) {
    const dateStr = toLocalDateStr(date)
    const holidayName = holidayDates.get(dateStr)
    const closureName = closureDates.get(dateStr)
    return {
      holiday: !!holidayName,
      closure: !!closureName,
      name: holidayName || closureName || null,
    }
  }

  function getAbsencesForDay(date: Date): Absence[] {
    const dateStr = toLocalDateStr(date)
    return absences.filter(abs => {
      if (calendarScope === 'personal') {
        if (abs.user_id !== currentUserId) return false
      } else {
        if (filterUser !== 'all' && abs.user_id !== filterUser) return false
      }
      return dateStr >= abs.start_date && dateStr <= abs.end_date
    })
  }

  function getAppointmentsForDay(date: Date): Appointment[] {
    const dateStr = toLocalDateStr(date)
    return activeAppointments.filter(apt => {
      if (calendarScope === 'personal') {
        const isMain = apt.main_attendee_id === currentUserId
        const isAttendee = apt.appointment_attendees?.some(aa => aa.user_id === currentUserId)
        if (!isMain && !isAttendee) return false
      } else {
        if (filterUser !== 'all' && apt.main_attendee_id !== filterUser) return false
      }
      return apt.start_time.startsWith(dateStr)
    })
  }

  function openNovaCita(dateStr: string, time = '09:00') {
    const d = new Date(dateStr + 'T12:00:00')
    if (d.getDay() === 0 || d.getDay() === 6) return
    setNewCitaDate(dateStr)
    setNewCitaTime(time)
    setShowNovaCita(true)
  }

  function handleDayClick(dateStr: string) {
    const d = new Date(dateStr + 'T12:00:00')
    if (d.getDay() === 0 || d.getDay() === 6) return
    setSelectedDay(prev => prev === dateStr ? null : dateStr)
    setSelectedAppointment(null)
  }

  function navigate(direction: number) {
    if (viewMode === 'mes') {
      setCurrentDate(new Date(year, month + direction, 1, 12))
      setSelectedDay(null)
    } else if (viewMode === 'setmana') {
      const monday = getMondayOfWeek(currentDate)
      monday.setDate(monday.getDate() + direction * 7)
      setCurrentDate(new Date(monday))
    } else {
      const d = new Date(currentDate)
      d.setDate(d.getDate() + direction)
      setCurrentDate(d)
    }
  }

  function goToday() {
    const now = new Date()
    now.setHours(12, 0, 0, 0)
    setCurrentDate(now)
    setSelectedDay(todayStr)
  }

  function getHeaderTitle(): string {
    if (viewMode === 'mes') return `${MONTHS_CA[month]} ${year}`
    if (viewMode === 'setmana') {
      const monday = getMondayOfWeek(currentDate)
      const sunday = new Date(monday)
      sunday.setDate(sunday.getDate() + 6)
      return `${monday.getDate()} ${MONTHS_CA[monday.getMonth()]} — ${sunday.getDate()} ${MONTHS_CA[sunday.getMonth()]} ${sunday.getFullYear()}`
    }
    return `${currentDate.getDate()} ${MONTHS_CA[currentDate.getMonth()]} ${currentDate.getFullYear()}`
  }

  const workers = profiles.filter(p =>
    p.role === 'worker' || p.role === 'admin' || p.role === 'supervisor'
  )

  // ── Panell lateral del dia ─────────────────────────────────
  function DayPanel({ dateStr }: { dateStr: string }) {
    const date = new Date(dateStr + 'T12:00:00')
    const dayAbsences = getAbsencesForDay(date)
    const dayAppointments = getAppointmentsForDay(date)
    const special = isSpecialDay(date)
    const dayName = DAYS_FULL_CA[date.getDay() === 0 ? 6 : date.getDay() - 1]
    const isWeekend = date.getDay() === 0 || date.getDay() === 6
    const isToday = dateStr === todayStr

    return (
      <div className="w-72 shrink-0 border border-border rounded-xl bg-background overflow-hidden">
        {/* Capçalera */}
        <div className={`px-4 py-3 border-b border-border flex items-center justify-between ${isToday ? 'bg-tramit-blue text-white' : 'bg-muted/50'}`}>
          <div>
            <p className={`text-sm font-semibold ${isToday ? 'text-white' : ''}`}>
              {dayName}, {date.getDate()} {MONTHS_CA[date.getMonth()]}
            </p>
            {special.name && (
              <p className={`text-xs mt-0.5 ${isToday ? 'text-white/80' : 'text-amber-600'}`}>
                🎌 {special.name}
              </p>
            )}
          </div>
          <button onClick={() => setSelectedDay(null)}
            className={`p-1 rounded-md transition-colors ${isToday ? 'hover:bg-white/20 text-white' : 'hover:bg-muted text-muted-foreground'}`}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-3 space-y-4 max-h-[600px] overflow-y-auto">

          {/* Cites */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Cites {dayAppointments.length > 0 ? `(${dayAppointments.length})` : ''}
            </p>
            {dayAppointments.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Cap cita</p>
            ) : dayAppointments.map(apt => {
              const p = apt.profiles as { full_name: string; color: string | null } | null
              const clientName = (apt.clients as { name: string } | null)?.name
              const color = p?.color || '#2272A3'
              return (
                <button key={apt.id}
                  onClick={() => setSelectedAppointment(apt)}
                  className="w-full text-left p-2.5 rounded-lg border border-border hover:border-tramit-blue/50 hover:bg-tramit-blue-light/20 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-xs font-medium">{formatTime(apt.start_time)}–{formatTime(apt.end_time)}</span>
                    <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[apt.status] || ''}`}>
                      {STATUS_LABELS[apt.status] || apt.status}
                    </span>
                  </div>
                  <p className="text-xs font-medium mt-1">{TOPIC_LABELS[apt.topic] || apt.topic}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {p?.full_name?.split(' ')[0]}{clientName ? ` · ${clientName}` : ''}
                  </p>
                </button>
              )
            })}
          </div>

          {/* Absències */}
          {dayAbsences.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Absències ({dayAbsences.length})
              </p>
              {dayAbsences.map(abs => {
                const profile = abs.profiles as { full_name: string; color: string | null } | null
                const color = profile?.color || '#2272A3'
                return (
                  <div key={abs.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <div className="h-6 w-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                      style={{ backgroundColor: color }}>
                      {getInitials(profile?.full_name || '?')}
                    </div>
                    <div>
                      <p className="text-xs font-medium">{profile?.full_name?.split(' ')[0]}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {abs.type === 'vacation' ? 'Vacances' : 'Absència'}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Botó nova cita */}
          {!isWeekend && !special.holiday && !special.closure && (
            <button
              onClick={() => { setSelectedDay(null); openNovaCita(dateStr) }}
              className="w-full py-2 rounded-lg border-2 border-dashed border-border text-xs text-muted-foreground hover:border-tramit-blue hover:text-tramit-blue transition-colors">
              + Nova cita
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Modal detall cita ──────────────────────────────────────
  function AppointmentModal({ apt }: { apt: Appointment }) {
    const mainProfile = apt.profiles as { full_name: string; color: string | null } | null
    const clientName = (apt.clients as { name: string } | null)?.name
    const attendees = apt.appointment_attendees || []

    const [loading, setLoading] = useState(false)
    const [modalError, setModalError] = useState<string | null>(null)

    const isAdmin = currentUserRole === 'admin' || currentUserRole === 'supervisor'
    const isCreator = apt.created_by === currentUserId
    const isMain = apt.main_attendee_id === currentUserId
    const isAttendee = attendees.some(aa => aa.user_id === currentUserId)
    const canManage = isCreator || isMain || isAttendee || isAdmin

    async function handleConfirm(action: 'confirm' | 'reject') {
      let reason = ''
      if (action === 'reject') {
        const input = prompt('Introduïu el motiu de la cancel·lació (opcional):')
        if (input === null) return // user cancelled prompt
        reason = input.trim()
      }

      setLoading(true)
      setModalError(null)
      try {
        const res = await fetch('/api/appointments/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appointmentId: apt.id,
            action,
            reason,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error en gestionar la cita')
        router.refresh()
        setSelectedAppointment(null)
      } catch (err) {
        setModalError(err instanceof Error ? err.message : 'Error desconegut')
      } finally {
        setLoading(false)
      }
    }

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{TOPIC_LABELS[apt.topic] || apt.topic}</CardTitle>
              <button onClick={() => setSelectedAppointment(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{formatTime(apt.start_time)} — {formatTime(apt.end_time)}</span>
              <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[apt.status] || ''}`}>
                {STATUS_LABELS[apt.status] || apt.status}
              </span>
            </div>
            {clientName && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{clientName}</span>
              </div>
            )}
            {apt.location && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{apt.location}</span>
              </div>
            )}
            <div className="text-sm">
              <span className="text-muted-foreground">Canal: </span>
              {CHANNEL_LABELS[apt.channel] || apt.channel}
            </div>
            {attendees.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Assistents</p>
                {attendees.map((att, i) => {
                  const p = att.profiles as { full_name: string; color: string | null } | null
                  const color = p?.color || '#2272A3'
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full flex items-center justify-center text-white shrink-0"
                        style={{ backgroundColor: color, fontSize: '9px', fontWeight: 700 }}>
                        {getInitials(p?.full_name || '?')}
                      </div>
                      <span className="text-sm">{p?.full_name || '—'}</span>
                      {att.is_main && <span className="text-xs text-muted-foreground">(principal)</span>}
                    </div>
                  )
                })}
              </div>
            )}
            {apt.internal_notes && (
              <div className="bg-muted/50 rounded-lg px-3 py-2">
                <p className="text-xs text-muted-foreground">{apt.internal_notes}</p>
              </div>
            )}

            {modalError && (
              <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg mt-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {modalError}
              </div>
            )}

            {canManage && (apt.status === 'pending' || apt.status === 'confirmed') && (
              <div className="flex gap-2 pt-3 border-t border-border mt-3">
                {apt.status === 'pending' && (
                  <>
                    {apt.created_by !== currentUserId && (
                      <button
                        disabled={loading}
                        onClick={() => handleConfirm('confirm')}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        {loading ? 'Processant...' : 'Acceptar'}
                      </button>
                    )}
                    <button
                      disabled={loading}
                      onClick={() => handleConfirm('reject')}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 dark:hover:bg-red-950/20 disabled:opacity-50 transition-colors"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Rebutjar
                    </button>
                  </>
                )}
                {apt.status === 'confirmed' && (
                  <button
                    disabled={loading}
                    onClick={() => handleConfirm('reject')}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 dark:hover:bg-red-950/20 disabled:opacity-50 transition-colors"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    {loading ? 'Processant...' : 'Cancel·lar cita'}
                  </button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Vista MES ──────────────────────────────────────────────
  function renderMes() {
    const firstDay = new Date(year, month, 1, 12)
    const lastDay = new Date(year, month + 1, 0, 12)
    let startDow = firstDay.getDay() - 1
    if (startDow < 0) startDow = 6
    const totalCells = Math.ceil((startDow + lastDay.getDate()) / 7) * 7
    const days: (Date | null)[] = []
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - startDow + 1
      if (dayNum < 1 || dayNum > lastDay.getDate()) {
        days.push(null)
      } else {
        days.push(new Date(year, month, dayNum, 12))
      }
    }

    return (
      <div className={`flex gap-4 items-start ${selectedDay ? '' : ''}`}>
        {/* Calendari */}
        <div className="flex-1 min-w-0">
          <Card>
            <CardContent className="p-0 overflow-hidden">
              <div className="grid grid-cols-7 border-b border-border">
                {DAYS_CA.map((day, i) => (
                  <div key={day} className={`py-2 text-center text-xs font-semibold ${i >= 5 ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {days.map((date, idx) => {
                  if (!date) return (
                    <div key={`empty-${idx}`} className="min-h-[80px] border-b border-r border-border bg-muted/20" />
                  )
                  const dateStr = toLocalDateStr(date)
                  const isToday = dateStr === todayStr
                  const isSelected = dateStr === selectedDay
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6
                  const special = isSpecialDay(date)
                  const dayAbsences = getAbsencesForDay(date)
                  const dayAppointments = getAppointmentsForDay(date)
                  const fiscal = fiscalDates.get(dateStr)

                  return (
                    <div key={dateStr}
                      onClick={() => !isWeekend && handleDayClick(dateStr)}
                      className={`min-h-[80px] border-b border-r border-border p-1 transition-colors
                        ${isWeekend ? 'bg-muted/30 cursor-default' : 'cursor-pointer hover:bg-tramit-blue-light/30 dark:hover:bg-blue-900/10'}
                        ${special.holiday || special.closure ? 'bg-amber-50 dark:bg-amber-900/10' : ''}
                        ${isSelected ? 'ring-2 ring-inset ring-tramit-blue bg-tramit-blue-light/20' : ''}
                        ${isToday && !isSelected ? 'ring-1 ring-inset ring-tramit-blue' : ''}
                      `}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                          isToday ? 'bg-tramit-blue text-white' : isWeekend ? 'text-muted-foreground/50' : 'text-foreground'
                        }`}>
                          {date.getDate()}
                        </span>
                        {fiscal && showFiscal && (
                          <span title={`${fiscal.name}${fiscal.model ? ` · M.${fiscal.model}` : ''}`}
                            className="text-[8px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-1 rounded">
                            {fiscal.model ? `M${fiscal.model}` : '📋'}
                          </span>
                        )}
                      </div>
                      {special.name && (
                        <div className="text-[9px] text-amber-700 dark:text-amber-400 leading-tight mb-0.5 truncate" title={special.name}>
                          {special.name}
                        </div>
                      )}
                      <div className="space-y-0.5">
                        {dayAppointments.slice(0, 2).map(apt => {
                          const p = apt.profiles as { full_name: string; color: string | null } | null
                          const color = p?.color || '#2272A3'
                          const isPending = apt.status === 'pending'
                          return (
                            <div key={apt.id} className="flex items-center gap-1 rounded px-1 py-0.5"
                              style={{
                                backgroundColor: isPending ? color + '15' : color + '30',
                                borderLeft: isPending ? `2px dashed ${color}` : `2px solid ${color}`,
                                opacity: isPending ? 0.6 : 1,
                              }}>
                              <span className="text-[9px] truncate font-medium flex items-center gap-0.5" style={{ color }}>
                                {isPending && <span title="Pendent de confirmació">⏳</span>}
                                {formatTime(apt.start_time)} {TOPIC_LABELS[apt.topic]?.slice(0, 5)}
                              </span>
                            </div>
                          )
                        })}
                        {dayAbsences.slice(0, 2).map(abs => {
                          const profile = abs.profiles as { full_name: string; color: string | null } | null
                          const color = profile?.color || '#2272A3'
                          const name = profile?.full_name || '—'
                          return (
                            <div key={abs.id} className="flex items-center gap-1 rounded px-1 py-0.5"
                              style={{ backgroundColor: color + '25', borderLeft: `2px solid ${color}` }}>
                              <div className="h-3.5 w-3.5 rounded-full flex items-center justify-center text-white shrink-0"
                                style={{ backgroundColor: color, fontSize: '7px', fontWeight: 700 }}>
                                {getInitials(name)}
                              </div>
                              <span className="text-[9px] truncate font-medium" style={{ color }}>
                                {name.split(' ')[0]}
                              </span>
                            </div>
                          )
                        })}
                        {(dayAppointments.length + dayAbsences.length) > 4 && (
                          <div className="text-[9px] text-muted-foreground pl-1">
                            +{dayAppointments.length + dayAbsences.length - 4} més
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Panell lateral del dia seleccionat */}
        {selectedDay && <DayPanel dateStr={selectedDay} />}
      </div>
    )
  }

  // ── Vista SETMANA ──────────────────────────────────────────
  function renderSetmana() {
    const monday = getMondayOfWeek(currentDate)
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(d.getDate() + i)
      d.setHours(12, 0, 0, 0)
      return d
    })

    return (
      <div className="flex gap-4 items-start">
        <div className="flex-1 min-w-0">
          <Card>
            <CardContent className="p-0 overflow-auto">
              <div className="min-w-[600px]">
                <div className="grid grid-cols-8 border-b border-border">
                  <div className="py-2 px-2 text-xs text-muted-foreground" />
                  {weekDays.map(d => {
                    const dateStr = toLocalDateStr(d)
                    const isToday = dateStr === todayStr
                    const isSelected = dateStr === selectedDay
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6
                    const special = isSpecialDay(d)
                    const fiscal = fiscalDates.get(dateStr)
                    return (
                      <div key={dateStr}
                        onClick={() => !isWeekend && handleDayClick(dateStr)}
                        className={`py-2 text-center border-l border-border cursor-pointer hover:bg-muted/30 transition-colors
                          ${isWeekend ? 'bg-muted/30' : ''}
                          ${special.holiday || special.closure ? 'bg-amber-50 dark:bg-amber-900/10' : ''}
                          ${isSelected ? 'bg-tramit-blue-light/30 ring-1 ring-tramit-blue/50' : ''}
                        `}>
                        <p className={`text-xs font-medium ${isWeekend ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                          {DAYS_FULL_CA[d.getDay() === 0 ? 6 : d.getDay() - 1]}
                        </p>
                        <p className={`text-sm font-bold mt-0.5 mx-auto w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-tramit-blue text-white' : ''}`}>
                          {d.getDate()}
                        </p>
                        {special.name && <p className="text-[9px] text-amber-600 truncate px-1">{special.name}</p>}
                        {fiscal && showFiscal && <p className="text-[9px] text-amber-600 font-bold">{fiscal.model ? `M.${fiscal.model}` : '📋'}</p>}
                      </div>
                    )
                  })}
                </div>

                <div className="grid grid-cols-8 border-b border-border bg-muted/10">
                  <div className="px-2 py-2 text-xs text-muted-foreground self-center">Tot el dia</div>
                  {weekDays.map(d => {
                    const dateStr = toLocalDateStr(d)
                    const dayAbsences = getAbsencesForDay(d)
                    return (
                      <div key={dateStr} className="border-l border-border p-1 min-h-[40px]">
                        {dayAbsences.map(abs => {
                          const profile = abs.profiles as { full_name: string; color: string | null } | null
                          const color = profile?.color || '#2272A3'
                          return (
                            <div key={abs.id} className="flex items-center gap-1 rounded px-1 py-0.5 mb-0.5"
                              style={{ backgroundColor: color + '25', borderLeft: `2px solid ${color}` }}>
                              <span className="text-[9px] font-medium truncate" style={{ color }}>
                                {profile?.full_name?.split(' ')[0]}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>

                {HOURS.map(hour => (
                  <div key={hour} className="grid grid-cols-8 border-b border-border">
                    <div className="px-2 py-2 text-xs text-muted-foreground text-right">{hour}:00</div>
                    {weekDays.map(d => {
                      const dateStr = toLocalDateStr(d)
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6
                      const hourApts = activeAppointments.filter(apt => {
                        if (filterUser !== 'all' && apt.main_attendee_id !== filterUser) return false
                        const aptDate = new Date(apt.start_time)
                        return toLocalDateStr(aptDate) === dateStr && aptDate.getHours() === hour
                      })
                      return (
                        <div key={dateStr + hour}
                          onClick={() => !isWeekend && openNovaCita(dateStr, `${String(hour).padStart(2, '0')}:00`)}
                          className={`border-l border-border min-h-[48px] p-0.5 transition-colors ${
                            isWeekend ? 'bg-muted/20 cursor-default' : 'cursor-pointer hover:bg-tramit-blue-light/30 dark:hover:bg-blue-900/10'
                          }`}>
                          {hourApts.map(apt => {
                            const p = apt.profiles as { full_name: string; color: string | null } | null
                            const color = p?.color || '#2272A3'
                            const isPending = apt.status === 'pending'
                            return (
                              <div key={apt.id}
                                onClick={e => { e.stopPropagation(); setSelectedAppointment(apt) }}
                                className="rounded px-1 py-0.5 mb-0.5 cursor-pointer hover:opacity-80"
                                style={{
                                  backgroundColor: isPending ? color + '15' : color + '30',
                                  borderLeft: isPending ? `2px dashed ${color}` : `2px solid ${color}`,
                                  opacity: isPending ? 0.6 : 1,
                                }}>
                                <span className="text-[9px] font-medium truncate block" style={{ color }}>
                                  {isPending && '⏳ '}{TOPIC_LABELS[apt.topic]?.slice(0, 8)}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        {selectedDay && <DayPanel dateStr={selectedDay} />}
      </div>
    )
  }

  // ── Vista DIA ──────────────────────────────────────────────
  function renderDia() {
    const dateStr = toLocalDateStr(currentDate)
    const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6
    const special = isSpecialDay(currentDate)
    const dayAbsences = getAbsencesForDay(currentDate)
    const dayAppointments = getAppointmentsForDay(currentDate)
    const isToday = dateStr === todayStr
    const fiscal = fiscalDates.get(dateStr)

    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className={`h-14 w-14 rounded-2xl flex items-center justify-center text-white text-2xl font-bold ${isToday ? 'bg-tramit-blue' : 'bg-muted-foreground'}`}>
                {currentDate.getDate()}
              </div>
              <div>
                <p className="font-semibold text-lg">
                  {DAYS_FULL_CA[currentDate.getDay() === 0 ? 6 : currentDate.getDay() - 1]},{' '}
                  {currentDate.getDate()} {MONTHS_CA[currentDate.getMonth()]} {currentDate.getFullYear()}
                </p>
                {special.name && <p className="text-sm text-amber-600 dark:text-amber-400">🎌 {special.name}</p>}
                {fiscal && showFiscal && <p className="text-sm text-amber-600">📋 {fiscal.name}</p>}
                {isWeekend && <p className="text-sm text-muted-foreground">Cap de setmana</p>}
              </div>
              {dayAbsences.length > 0 && (
                <div className="ml-auto flex gap-2 flex-wrap">
                  {dayAbsences.map(abs => {
                    const profile = abs.profiles as { full_name: string; color: string | null } | null
                    const color = profile?.color || '#2272A3'
                    return (
                      <div key={abs.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
                        style={{ backgroundColor: color + '20', color }}>
                        <div className="h-5 w-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                          style={{ backgroundColor: color }}>
                          {getInitials(profile?.full_name || '?')}
                        </div>
                        {profile?.full_name?.split(' ')[0]}
                        {abs.type === 'vacation' ? ' · Vacances' : ' · Absència'}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {HOURS.map(hour => {
                const hourApts = dayAppointments.filter(apt => new Date(apt.start_time).getHours() === hour)
                return (
                  <div key={hour}
                    onClick={() => !isWeekend && !special.holiday && !special.closure && openNovaCita(dateStr, `${String(hour).padStart(2, '0')}:00`)}
                    className={`flex items-stretch min-h-[48px] transition-colors ${
                      isWeekend || special.holiday || special.closure
                        ? 'bg-muted/20 cursor-default'
                        : 'cursor-pointer hover:bg-tramit-blue-light/30 dark:hover:bg-blue-900/10'
                    }`}>
                    <div className="w-16 px-3 py-3 text-xs text-muted-foreground text-right shrink-0 border-r border-border">
                      {hour}:00
                    </div>
                    <div className="flex-1 px-3 py-2 space-y-1">
                      {hourApts.map(apt => {
                        const p = apt.profiles as { full_name: string; color: string | null } | null
                        const clientName = (apt.clients as { name: string } | null)?.name
                        const color = p?.color || '#2272A3'
                        const isPending = apt.status === 'pending'
                        return (
                          <div key={apt.id}
                            onClick={e => { e.stopPropagation(); setSelectedAppointment(apt) }}
                            className="flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                            style={{
                              backgroundColor: isPending ? color + '10' : color + '20',
                              borderLeft: isPending ? `3px dashed ${color}` : `3px solid ${color}`,
                              opacity: isPending ? 0.65 : 1,
                            }}>
                            <div>
                              <p className="text-xs font-semibold" style={{ color }}>
                                {isPending && '⏳ '}{formatTime(apt.start_time)}–{formatTime(apt.end_time)} · {TOPIC_LABELS[apt.topic] || apt.topic}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {p?.full_name?.split(' ')[0]}{clientName ? ` · ${clientName}` : ''} · {CHANNEL_LABELS[apt.channel]}
                              </p>
                            </div>
                            <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[apt.status] || ''}`}>
                              {STATUS_LABELS[apt.status] || apt.status}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Resum del mes ──────────────────────────────────────────
  function renderResumMes() {
    const monthAbsences = absences.filter(abs => {
      const start = new Date(abs.start_date + 'T12:00:00')
      const end = new Date(abs.end_date + 'T12:00:00')
      const monthStart = new Date(year, month, 1, 12)
      const monthEnd = new Date(year, month + 1, 0, 12)
      if (calendarScope === 'personal') {
        if (abs.user_id !== currentUserId) return false
      } else {
        if (filterUser !== 'all' && abs.user_id !== filterUser) return false
      }
      return start <= monthEnd && end >= monthStart
    })
    if (monthAbsences.length === 0) return null
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Absències del mes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {monthAbsences.map(abs => {
              const profile = abs.profiles as { full_name: string; color: string | null } | null
              const color = profile?.color || '#2272A3'
              return (
                <div key={abs.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                  <div className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: color }}>
                    {getInitials(profile?.full_name || '?')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{profile?.full_name || '—'}</p>
                    <p className="text-xs text-muted-foreground">{abs.start_date} → {abs.end_date}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {abs.type === 'vacation'
                      ? <Umbrella className="h-3.5 w-3.5 text-tramit-blue" />
                      : <ClipboardList className="h-3.5 w-3.5 text-slate-500" />
                    }
                    <span className="text-xs text-muted-foreground">
                      {abs.type === 'vacation' ? 'Vacances' : 'Absència'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    )
  }

  // ── RENDER PRINCIPAL ───────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="text-base font-semibold min-w-[200px] text-center">{getHeaderTitle()}</h2>
          <button onClick={() => navigate(1)} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button onClick={goToday}
            className="ml-1 px-3 py-1.5 rounded-lg bg-tramit-blue text-white text-sm font-medium hover:bg-tramit-blue/90 transition-colors">
            Avui
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-muted p-1 rounded-lg">
            {(['mes', 'setmana', 'dia'] as ViewMode[]).map(mode => (
              <button key={mode} onClick={() => { setViewMode(mode); setSelectedDay(null) }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === mode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}>
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground shrink-0">Filtrar:</span>
            <select
              value={calendarScope === 'personal' ? 'personal' : filterUser}
              onChange={e => {
                const val = e.target.value
                if (val === 'personal') {
                  setCalendarScope('personal')
                  setFilterUser('all')
                } else if (val === 'all') {
                  setCalendarScope('shared')
                  setFilterUser('all')
                } else {
                  setCalendarScope('shared')
                  setFilterUser(val)
                }
                setSelectedDay(null)
              }}
              className="h-9 rounded-lg border border-input bg-background px-3 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="personal">La meva agenda (Personal)</option>
              <option value="all">Tot l'equip (Compartida)</option>
              {workers.map(p => (
                <option key={p.id} value={p.id}>Agenda de: {p.full_name}</option>
              ))}
            </select>
          </div>

          {fiscalDeadlines.length > 0 && (
            <button onClick={() => setShowFiscal(!showFiscal)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                showFiscal ? 'bg-amber-500 text-white border-amber-500' : 'border-border text-muted-foreground hover:text-foreground'
              }`}>
              📋 {showFiscal ? 'Amagar terminis' : 'Terminis fiscals'}
            </button>
          )}
        </div>
      </div>

      {/* Llegenda */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs border-t border-border/60 pt-4 mt-2 select-none">
        <span className="text-muted-foreground font-semibold">Equip:</span>
        {workers.map(p => {
          const userColor = p.color || '#2272A3'
          return (
            <div key={p.id} className="flex items-center gap-1.5 hover:opacity-85 transition-opacity cursor-default">
              <span className="h-2 w-2 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: userColor }} />
              <span className="text-muted-foreground font-medium">{p.full_name.split(' ')[0]}</span>
            </div>
          )
        })}
        <div className="flex items-center gap-1.5 hover:opacity-85 transition-opacity cursor-default">
          <span className="h-2 w-2 rounded bg-amber-500 shrink-0" />
          <span className="text-muted-foreground font-medium">Festiu / Tancament</span>
        </div>
        <div className="ml-auto text-muted-foreground italic hidden sm:block">
          Clica un dia per veure detalls
        </div>
      </div>

      {/* Panell terminis fiscals */}
      {showFiscal && fiscalDeadlines.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-3">
            Propers terminis fiscals
          </p>
          <div className="space-y-2">
            {fiscalDeadlines.map(d => {
              const daysLeft = Math.ceil((new Date(d.date + 'T00:00:00').getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
              const isUrgent = daysLeft <= 7
              return (
                <div key={d.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{d.name}</p>
                    {d.model && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700">M.{d.model}</span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium">
                      {new Date(d.date + 'T00:00:00').toLocaleDateString('ca-ES', { day: 'numeric', month: 'short' })}
                    </p>
                    <p className={`text-[10px] ${isUrgent ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>
                      {daysLeft === 0 ? 'Avui!' : daysLeft === 1 ? 'Demà' : `${daysLeft} dies`}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Contingut */}
      {viewMode === 'mes' && renderMes()}
      {viewMode === 'setmana' && renderSetmana()}
      {viewMode === 'dia' && renderDia()}
      {viewMode === 'mes' && !selectedDay && renderResumMes()}

      {/* Modal detall cita */}
      {selectedAppointment && <AppointmentModal apt={selectedAppointment} />}

      {/* Modal nova cita */}
      {showNovaCita && newCitaDate && (
        <NovaCitaButton
          profiles={profiles}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          initialDate={newCitaDate}
          initialTime={newCitaTime || '09:00'}
          forceOpen={true}
          onClose={() => {
            setShowNovaCita(false)
            setNewCitaDate(null)
            setNewCitaTime(null)
          }}
        />
      )}
    </div>
  )
}
