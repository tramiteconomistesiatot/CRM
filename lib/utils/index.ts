import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formata una data en català
 */
export function formatDateCA(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('ca-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Formata una data curta en català
 */
export function formatDateShortCA(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('ca-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * Formata una hora (HH:MM)
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString('ca-ES', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Retorna la salutació en català segons l'hora del dia
 */
export function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bon dia'
  if (hour < 18) return 'Bona tarda'
  return 'Bona nit'
}

/**
 * Comprova si una data és dia laborable (dilluns-divendres)
 * No té en compte festius ni tancaments (aquests es comproven per separat)
 */
export function isWeekday(date: Date): boolean {
  const day = date.getDay()
  return day !== 0 && day !== 6
}

/**
 * Calcula els dies laborables entre dues dates
 * Exclou caps de setmana. Festius i tancaments s'han de passar com a array de strings 'YYYY-MM-DD'
 */
export function calculateWorkingDays(
  startDate: Date,
  endDate: Date,
  holidays: string[] = [],
  closures: string[] = []
): number {
  let count = 0
  const current = new Date(startDate)
  const nonWorkingDays = new Set([...holidays, ...closures])

  while (current <= endDate) {
    const dayOfWeek = current.getDay()
    const dateStr = current.toISOString().split('T')[0]

    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !nonWorkingDays.has(dateStr)) {
      count++
    }

    current.setDate(current.getDate() + 1)
  }

  return count
}

/**
 * Retorna el nom del dia de la setmana en català
 */
export function getDayNameCA(date: Date): string {
  return date.toLocaleDateString('ca-ES', { weekday: 'long' })
}

/**
 * Retorna el nom del mes en català
 */
export function getMonthNameCA(month: number): string {
  const date = new Date(2024, month, 1)
  return date.toLocaleDateString('ca-ES', { month: 'long' })
}

/**
 * Trunca un text amb el·lipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

/**
 * Retorna les inicials d'un nom
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/**
 * Colors per estat d'absència
 */
export const statusColors = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  rescheduled: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  confirmed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
}

/**
 * Traducció d'estats al català
 */
export const statusLabelsCA: Record<string, string> = {
  pending: 'Pendent',
  approved: 'Aprovada',
  rejected: 'Rebutjada',
  cancelled: 'Cancel·lada',
  completed: 'Completada',
  rescheduled: 'Reprogramada',
  confirmed: 'Confirmada',
  proposed_new_time: 'Nova hora proposada',
}

/**
 * Traducció de tipus d'absència al català
 */
export const absenceTypeLabelsCA: Record<string, string> = {
  vacation: 'Vacances',
  sick_leave: 'Baixa mèdica',
  permission: 'Permís',
  other: 'Altre',
}

/**
 * Traducció de temes de cita al català
 */
export const appointmentTopicLabelsCA: Record<string, string> = {
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

/**
 * Traducció de canal al català
 */
export const channelLabelsCA: Record<string, string> = {
  in_person: 'Presencial',
  phone: 'Telèfon',
  video: 'Videotrucada',
  email: 'Email',
  other: 'Altre',
}
