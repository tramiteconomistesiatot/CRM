'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Download, FileText, Table, Calendar,
  User, BarChart3, CheckCircle
} from 'lucide-react'

interface Balance {
  id: string
  user_id: string
  year: number
  total_days: number
  used_days: number
  pending_days: number
  profiles?: { full_name: string; email: string } | null
}

interface Request {
  id: string
  user_id: string
  type: string
  start_date: string
  end_date: string
  working_days: number
  status: string
  created_at: string
  profiles?: { full_name: string; email: string } | null
}

interface Profile {
  id: string
  full_name: string
  email: string
}

interface Props {
  balances: Balance[]
  requests: Request[]
  profiles: Profile[]
  currentYear: number
}

const TYPE_LABELS: Record<string, string> = {
  vacation: 'Vacances',
  sick_leave: 'Baixa mèdica',
  permission: 'Permís',
  other: 'Altre',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendent',
  approved: 'Aprovada',
  rejected: 'Rebutjada',
  cancelled: 'Cancel·lada',
}

function getProfileName(profiles: Balance['profiles']): string {
  if (!profiles) return '—'
  if (Array.isArray(profiles)) return (profiles as { full_name: string }[])[0]?.full_name || '—'
  return (profiles as { full_name: string }).full_name || '—'
}

function getProfileEmail(profiles: Balance['profiles']): string {
  if (!profiles) return '—'
  if (Array.isArray(profiles)) return (profiles as { email: string }[])[0]?.email || '—'
  return (profiles as { email: string }).email || '—'
}

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [
    headers.map(h => `"${h}"`).join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  const bom = '\uFEFF' // BOM per Excel
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function InformesClient({ balances, requests, profiles, currentYear }: Props) {
  const [downloaded, setDownloaded] = useState<string | null>(null)
  const [filterYear, setFilterYear] = useState(currentYear)
  const [filterUser, setFilterUser] = useState('')

  function showSuccess(key: string) {
    setDownloaded(key)
    setTimeout(() => setDownloaded(null), 3000)
  }

  // Informe 1: Saldos de vacances per treballador
  function exportSaldos() {
    const headers = ['Treballador', 'Email', 'Any', 'Dies totals', 'Dies usats', 'Dies pendents', 'Dies restants']
    const rows = balances
      .filter(b => b.year === filterYear)
      .map(b => [
        getProfileName(b.profiles),
        getProfileEmail(b.profiles),
        b.year,
        b.total_days,
        b.used_days,
        b.pending_days,
        b.total_days - b.used_days,
      ])
    downloadCSV(`saldos-vacances-${filterYear}.csv`, headers, rows)
    showSuccess('saldos')
  }

  // Informe 2: Totes les absències
  function exportAbsencies() {
    const filteredRequests = requests.filter(r => {
      const matchYear = r.start_date.startsWith(String(filterYear))
      const matchUser = !filterUser || r.user_id === filterUser
      return matchYear && matchUser
    })

    const headers = ['Treballador', 'Email', 'Tipus', 'Data inici', 'Data fi', 'Dies laborables', 'Estat', 'Data sol·licitud']
    const rows = filteredRequests.map(r => [
      getProfileName(r.profiles),
      getProfileEmail(r.profiles),
      TYPE_LABELS[r.type] || r.type,
      r.start_date,
      r.end_date,
      r.working_days,
      STATUS_LABELS[r.status] || r.status,
      new Date(r.created_at).toLocaleDateString('ca-ES'),
    ])
    downloadCSV(`absencies-${filterYear}.csv`, headers, rows)
    showSuccess('absencies')
  }

  // Informe 3: Vacances aprovades
  function exportVacancesAprovades() {
    const approved = requests.filter(r => {
      const matchYear = r.start_date.startsWith(String(filterYear))
      const matchUser = !filterUser || r.user_id === filterUser
      return r.type === 'vacation' && r.status === 'approved' && matchYear && matchUser
    })

    const headers = ['Treballador', 'Data inici', 'Data fi', 'Dies laborables']
    const rows = approved.map(r => [
      getProfileName(r.profiles),
      r.start_date,
      r.end_date,
      r.working_days,
    ])
    downloadCSV(`vacances-aprovades-${filterYear}.csv`, headers, rows)
    showSuccess('vacances')
  }

  // Informe 4: Resum per treballador
  function exportResumTreballador(userId: string) {
    const profile = profiles.find(p => p.id === userId)
    const userRequests = requests.filter(r => r.user_id === userId && r.start_date.startsWith(String(filterYear)))
    const userBalance = balances.find(b => b.user_id === userId && b.year === filterYear)

    const headers = ['Tipus', 'Data inici', 'Data fi', 'Dies laborables', 'Estat']
    const rows = userRequests.map(r => [
      TYPE_LABELS[r.type] || r.type,
      r.start_date,
      r.end_date,
      r.working_days,
      STATUS_LABELS[r.status] || r.status,
    ])

    // Afegir resum al final
    if (userBalance) {
      rows.push(['', '', '', '', ''])
      rows.push(['RESUM', '', '', '', ''])
      rows.push(['Dies totals', String(userBalance.total_days), '', '', ''])
      rows.push(['Dies usats', String(userBalance.used_days), '', '', ''])
      rows.push(['Dies restants', String(userBalance.total_days - userBalance.used_days), '', '', ''])
    }

    const filename = `resum-${profile?.full_name.replace(' ', '-').toLowerCase()}-${filterYear}.csv`
    downloadCSV(filename, headers, rows)
    showSuccess(`worker-${userId}`)
  }

  // Informe 5: Baixes mèdiques
  function exportBaixes() {
    const baixes = requests.filter(r => {
      const matchYear = r.start_date.startsWith(String(filterYear))
      return r.type === 'sick_leave' && matchYear
    })

    const headers = ['Treballador', 'Data inici', 'Data fi', 'Dies', 'Estat']
    const rows = baixes.map(r => [
      getProfileName(r.profiles),
      r.start_date,
      r.end_date,
      r.working_days,
      STATUS_LABELS[r.status] || r.status,
    ])
    downloadCSV(`baixes-mediques-${filterYear}.csv`, headers, rows)
    showSuccess('baixes')
  }

  // Estadístiques ràpides
  const yearRequests = requests.filter(r => r.start_date.startsWith(String(filterYear)))
  const totalVacationDays = yearRequests.filter(r => r.type === 'vacation' && r.status === 'approved').reduce((sum, r) => sum + r.working_days, 0)
  const totalSickDays = yearRequests.filter(r => r.type === 'sick_leave' && r.status === 'approved').reduce((sum, r) => sum + r.working_days, 0)
  const pendingCount = yearRequests.filter(r => r.status === 'pending').length
  const totalRemainingDays = balances.filter(b => b.year === filterYear).reduce((sum, b) => sum + (b.total_days - b.used_days), 0)

  const REPORTS = [
    {
      key: 'saldos',
      title: 'Saldos de vacances',
      description: `Resum de dies totals, usats i restants de tots els treballadors per a ${filterYear}`,
      icon: BarChart3,
      color: 'text-tramit-blue',
      bg: 'bg-tramit-blue-light dark:bg-blue-900/20',
      action: exportSaldos,
    },
    {
      key: 'vacances',
      title: 'Vacances aprovades',
      description: `Totes les vacances aprovades de ${filterYear} amb dates i dies`,
      icon: Calendar,
      color: 'text-green-600',
      bg: 'bg-green-50 dark:bg-green-900/20',
      action: exportVacancesAprovades,
    },
    {
      key: 'absencies',
      title: 'Totes les absències',
      description: `Vacances, permisos i baixes de ${filterYear} amb tots els estats`,
      icon: FileText,
      color: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      action: exportAbsencies,
    },
    {
      key: 'baixes',
      title: 'Baixes mèdiques',
      description: `Registre de baixes mèdiques de ${filterYear}`,
      icon: FileText,
      color: 'text-red-500',
      bg: 'bg-red-50 dark:bg-red-900/20',
      action: exportBaixes,
    },
  ]

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Informes</h1>
        <p className="text-muted-foreground mt-1">Exportació de dades en format CSV (compatible amb Excel)</p>
      </div>

      {/* Filtres globals */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Any:</label>
              <select
                value={filterYear}
                onChange={e => setFilterYear(Number(e.target.value))}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Treballador:</label>
              <select
                value={filterUser}
                onChange={e => setFilterUser(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Tots</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estadístiques ràpides */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Dies vacances aprovats', value: totalVacationDays, color: 'text-tramit-blue' },
          { label: 'Dies de baixa', value: totalSickDays, color: 'text-red-500' },
          { label: 'Sol·licituds pendents', value: pendingCount, color: 'text-amber-500' },
          { label: 'Dies restants (equip)', value: totalRemainingDays, color: 'text-green-600' },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="pt-4 pb-3 text-center">
              <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Informes generals */}
      <div>
        <h2 className="text-base font-semibold mb-3">Informes generals</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {REPORTS.map(report => {
            const Icon = report.icon
            const isDownloaded = downloaded === report.key
            return (
              <Card key={report.key} className="hover:border-tramit-blue/30 transition-colors">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-lg ${report.bg} shrink-0`}>
                      <Icon className={`h-5 w-5 ${report.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{report.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{report.description}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Button
                      size="sm"
                      variant={isDownloaded ? 'outline' : 'tramit'}
                      onClick={report.action}
                      className="flex items-center gap-1.5 w-full justify-center"
                    >
                      {isDownloaded ? (
                        <><CheckCircle className="h-3.5 w-3.5 text-green-600" /><span className="text-green-600">Descarregat!</span></>
                      ) : (
                        <><Download className="h-3.5 w-3.5" />Descarregar CSV</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Informes per treballador */}
      <div>
        <h2 className="text-base font-semibold mb-3">Informe individual per treballador</h2>
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {profiles.map(profile => {
                const balance = balances.find(b => b.user_id === profile.id && b.year === filterYear)
                const userReqs = requests.filter(r => r.user_id === profile.id && r.start_date.startsWith(String(filterYear)))
                const approved = userReqs.filter(r => r.status === 'approved')
                const isDownloaded = downloaded === `worker-${profile.id}`

                return (
                  <div key={profile.id} className="flex items-center gap-4 px-5 py-3">
                    <div className="h-8 w-8 rounded-full bg-tramit-blue-light dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-tramit-blue" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{profile.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {balance ? `${balance.total_days - balance.used_days} dies restants · ` : ''}
                        {approved.length} absències aprovades
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={isDownloaded ? 'outline' : 'outline'}
                      onClick={() => exportResumTreballador(profile.id)}
                      className={`flex items-center gap-1.5 shrink-0 ${isDownloaded ? 'text-green-600 border-green-300' : ''}`}
                    >
                      {isDownloaded ? (
                        <><CheckCircle className="h-3.5 w-3.5" />Descarregat</>
                      ) : (
                        <><Download className="h-3.5 w-3.5" />CSV</>
                      )}
                    </Button>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground text-center pb-4">
        Els fitxers CSV s&apos;obren directament amb Excel, LibreOffice Calc o Google Sheets.
      </p>
    </div>
  )
}
