/**
 * Calcula els dies laborables entre dues dates, excloent caps de setmana, festius i tancaments.
 */
export function calculateWorkingDays(
  startDate: string,
  endDate: string,
  holidays: string[] = [],
  closures: string[] = []
): number {
  const nonWorking = new Set([...holidays, ...closures])
  let count = 0
  const current = new Date(startDate + 'T12:00:00')
  const end = new Date(endDate + 'T12:00:00')
  while (current <= end) {
    const day = current.getDay()
    const dateStr = current.toISOString().split('T')[0]
    if (day !== 0 && day !== 6 && !nonWorking.has(dateStr)) count++
    current.setDate(current.getDate() + 1)
  }
  return count
}

/**
 * Comprova si un rang de dates es solapa amb altres sol·licituds aprovades
 */
export function hasOverlap(
  startDate: string,
  endDate: string,
  existingRequests: { start_date: string; end_date: string }[]
): boolean {
  return existingRequests.some(req =>
    startDate <= req.end_date && endDate >= req.start_date
  )
}

/**
 * Formata una data ISO a format llegible en català
 */
export function formatDateCA(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('ca-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
