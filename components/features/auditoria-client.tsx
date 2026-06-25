'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Search,
  ChevronDown,
  ChevronUp,
  Download,
  Shield,
  TrendingUp,
  Clock,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Log {
  id: string
  user_id: string
  action: string
  entity_type: string
  entity_id: string
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
  profiles?: { full_name: string; email: string } | null
}

interface Profile {
  id: string
  full_name: string
}

const ACTION_STYLES: Record<string, string> = {
  create: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  approve: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  insert: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  update: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  modify: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  edit: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  delete: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  reject: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  cancel: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  login: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  download: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  view: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
}

const ENTITY_LABELS: Record<string, string> = {
  absence_request: 'Vacança / Absència',
  appointment: 'Cita',
  client: 'Client',
  profile: 'Usuari',
  file: 'Document',
  settings: 'Configuració',
  vacation_balance: 'Saldo vacances',
}

function getActionStyle(action: string): string {
  const key = Object.keys(ACTION_STYLES).find(k => action.toLowerCase().includes(k))
  return key ? ACTION_STYLES[key] : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('ca-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }) + ' ' + date.toLocaleTimeString('ca-ES', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function exportToCSV(logs: Log[]) {
  const headers = ['Data', 'Usuari', 'Acció', 'Entitat', 'ID Entitat', 'IP']
  const rows = logs.map(log => [
    formatDate(log.created_at),
    (log.profiles as { full_name: string } | null)?.full_name || log.user_id,
    log.action,
    ENTITY_LABELS[log.entity_type] || log.entity_type,
    log.entity_id,
    log.ip_address || '—',
  ])
  const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `auditoria-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function AuditoriaClient({ logs, profiles }: { logs: Log[]; profiles: Profile[] }) {
  const [search, setSearch] = useState('')
  const [filterUser, setFilterUser] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterEntity, setFilterEntity] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const todayCount = logs.filter(l => l.created_at.startsWith(today)).length
  const weekCount = logs.filter(l => new Date(l.created_at) >= sevenDaysAgo).length

  const topUser = useMemo(() => {
    const counts: Record<string, { name: string; count: number }> = {}
    logs.forEach(l => {
      const name = (l.profiles as { full_name: string } | null)?.full_name || l.user_id
      if (!counts[l.user_id]) counts[l.user_id] = { name, count: 0 }
      counts[l.user_id].count++
    })
    return Object.values(counts).sort((a, b) => b.count - a.count)[0]
  }, [logs])

  const actionTypes = useMemo(() => {
    const seen: Record<string, boolean> = {}
    logs.forEach(l => { seen[l.action] = true })
    return Object.keys(seen).sort()
  }, [logs])

  const entityTypes = useMemo(() => {
    const seen: Record<string, boolean> = {}
    logs.forEach(l => { seen[l.entity_type] = true })
    return Object.keys(seen).sort()
  }, [logs])

  const filtered = useMemo(() => {
    return logs.filter(log => {
      const name = (log.profiles as { full_name: string } | null)?.full_name || ''
      const matchSearch = !search ||
        name.toLowerCase().includes(search.toLowerCase()) ||
        log.action.toLowerCase().includes(search.toLowerCase()) ||
        log.entity_type.toLowerCase().includes(search.toLowerCase()) ||
        log.entity_id.toLowerCase().includes(search.toLowerCase())
      const matchUser = !filterUser || log.user_id === filterUser
      const matchAction = !filterAction || log.action === filterAction
      const matchEntity = !filterEntity || log.entity_type === filterEntity
      const matchFrom = !filterDateFrom || log.created_at >= filterDateFrom
      const matchTo = !filterDateTo || log.created_at <= filterDateTo + 'T23:59:59'
      return matchSearch && matchUser && matchAction && matchEntity && matchFrom && matchTo
    })
  }, [logs, search, filterUser, filterAction, filterEntity, filterDateFrom, filterDateTo])

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Auditoria</h1>
          <p className="text-muted-foreground mt-1">Registre complet de totes les accions del sistema</p>
        </div>
        <Button
          variant="outline"
          onClick={() => exportToCSV(filtered)}
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Resum estadístic */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total registres', value: logs.length, icon: Shield, color: 'text-tramit-blue', bg: 'bg-tramit-blue-light dark:bg-blue-900/20' },
          { label: 'Accions avui', value: todayCount, icon: Clock, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
          { label: 'Últims 7 dies', value: weekCount, icon: TrendingUp, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
          { label: 'Usuari més actiu', value: topUser?.name?.split(' ')[0] || '—', icon: User, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
        ].map(card => {
          const Icon = card.icon
          return (
            <Card key={card.label}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
                    <p className="text-2xl font-bold truncate max-w-[120px]">{card.value}</p>
                  </div>
                  <div className={`p-2 rounded-lg ${card.bg}`}>
                    <Icon className={`h-4 w-4 ${card.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Filtres */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cercar..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <select
              value={filterUser}
              onChange={e => setFilterUser(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Tots els usuaris</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>

            <select
              value={filterAction}
              onChange={e => setFilterAction(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Totes les accions</option>
              {actionTypes.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>

            <select
              value={filterEntity}
              onChange={e => setFilterEntity(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Totes les entitats</option>
              {entityTypes.map(e => (
                <option key={e} value={e}>{ENTITY_LABELS[e] || e}</option>
              ))}
            </select>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Des de</p>
              <Input
                type="date"
                value={filterDateFrom}
                onChange={e => setFilterDateFrom(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Fins a</p>
              <Input
                type="date"
                value={filterDateTo}
                onChange={e => setFilterDateTo(e.target.value)}
              />
            </div>
          </div>

          {(search || filterUser || filterAction || filterEntity || filterDateFrom || filterDateTo) && (
            <button
              onClick={() => {
                setSearch('')
                setFilterUser('')
                setFilterAction('')
                setFilterEntity('')
                setFilterDateFrom('')
                setFilterDateTo('')
              }}
              className="mt-3 text-xs text-tramit-blue hover:underline"
            >
              Netejar filtres
            </button>
          )}
        </CardContent>
      </Card>

      {/* Resultats */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Registres
            </CardTitle>
            <span className="text-sm text-muted-foreground">
              {filtered.length} de {logs.length}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Cap registre coincideix amb els filtres</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(log => {
                const userName = (log.profiles as { full_name: string } | null)?.full_name || log.user_id
                const isExpanded = expanded === log.id
                const hasDetails = log.old_values || log.new_values

                return (
                  <div key={log.id} className="px-6 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {/* Data */}
                        <div className="text-xs text-muted-foreground whitespace-nowrap mt-0.5 w-32 shrink-0">
                          {formatDate(log.created_at)}
                        </div>

                        {/* Contingut */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{userName}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getActionStyle(log.action)}`}>
                              {log.action}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {ENTITY_LABELS[log.entity_type] || log.entity_type}
                            </span>
                          </div>
                          {log.ip_address && (
                            <p className="text-xs text-muted-foreground mt-0.5">IP: {log.ip_address}</p>
                          )}
                        </div>
                      </div>

                      {/* Botó detall */}
                      {hasDetails && (
                        <button
                          onClick={() => setExpanded(isExpanded ? null : log.id)}
                          className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
                        >
                          {isExpanded
                            ? <ChevronUp className="h-4 w-4" />
                            : <ChevronDown className="h-4 w-4" />
                          }
                        </button>
                      )}
                    </div>

                    {/* Detall expandit */}
                    {isExpanded && hasDetails && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {log.old_values && (
                          <div className="rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 p-3">
                            <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-2">Valors anteriors</p>
                            <pre className="text-xs text-red-800 dark:text-red-300 overflow-auto max-h-32 whitespace-pre-wrap">
                              {JSON.stringify(log.old_values, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.new_values && (
                          <div className="rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 p-3">
                            <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-2">Valors nous</p>
                            <pre className="text-xs text-green-800 dark:text-green-300 overflow-auto max-h-32 whitespace-pre-wrap">
                              {JSON.stringify(log.new_values, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center pb-4">
        Mostrant els últims 200 registres. Usa els filtres per cercar registres més antics.
      </p>
    </div>
  )
}
