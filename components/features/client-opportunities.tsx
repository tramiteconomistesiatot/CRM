'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sparkles, TrendingUp, AlertCircle, Loader2, ChevronRight } from 'lucide-react'

interface Opportunity {
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  type: string
  action: string
}

interface Alert {
  title: string
  description: string
  urgency: 'urgent' | 'soon' | 'info'
}

interface AnalysisResult {
  opportunities: Opportunity[]
  alerts: Alert[]
  summary: string
}

const PRIORITY_CONFIG = {
  high: { label: 'Alta', style: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' },
  medium: { label: 'Mitjana', style: 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' },
  low: { label: 'Baixa', style: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
}

const URGENCY_CONFIG = {
  urgent: { style: 'border-red-300 bg-red-50 dark:bg-red-900/10 dark:border-red-800', icon: 'text-red-500' },
  soon: { style: 'border-amber-300 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800', icon: 'text-amber-500' },
  info: { style: 'border-blue-200 bg-blue-50 dark:bg-blue-900/10 dark:border-blue-800', icon: 'text-blue-500' },
}

const TYPE_LABELS: Record<string, string> = {
  fiscal: 'Fiscal', laboral: 'Laboral', comptable: 'Comptable',
  societats: 'Societats', other: 'Altre',
}

export function ClientOpportunities({ clientId }: { clientId: string }) {
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function analyze() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error analitzant')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-tramit-blue" />
            Anàlisi d&apos;oportunitats IA
          </CardTitle>
          <Button
            size="sm"
            variant={result ? 'outline' : 'tramit'}
            onClick={analyze}
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            {loading ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" />Analitzant...</>
            ) : (
              <><Sparkles className="h-3.5 w-3.5" />{result ? 'Re-analitzar' : 'Analitzar client'}</>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!result && !loading && !error && (
          <div className="text-center py-6 text-muted-foreground">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Clica per analitzar el perfil del client</p>
            <p className="text-xs mt-1">L&apos;IA detectarà oportunitats i alertes fiscals</p>
          </div>
        )}

        {loading && (
          <div className="text-center py-6 space-y-3">
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-tramit-blue" />
            <p className="text-sm text-muted-foreground">Analitzant perfil fiscal del client...</p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-4">
            {result.summary && (
              <p className="text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
                {result.summary}
              </p>
            )}

            {result.alerts && result.alerts.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Alertes</p>
                {result.alerts.map((alert, i) => {
                  const config = URGENCY_CONFIG[alert.urgency] || URGENCY_CONFIG.info
                  return (
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${config.style}`}>
                      <AlertCircle className={`h-4 w-4 shrink-0 mt-0.5 ${config.icon}`} />
                      <div>
                        <p className="text-sm font-medium">{alert.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {result.opportunities && result.opportunities.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Oportunitats</p>
                {result.opportunities.map((opp, i) => (
                  <div key={i} className="p-3 rounded-lg border border-border bg-muted/20 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{opp.title}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_CONFIG[opp.priority]?.style}`}>
                        {PRIORITY_CONFIG[opp.priority]?.label}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-tramit-blue-light dark:bg-blue-900/20 text-tramit-blue">
                        {TYPE_LABELS[opp.type] || opp.type}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{opp.description}</p>
                    <div className="flex items-center gap-1 text-xs text-tramit-blue font-medium">
                      <ChevronRight className="h-3 w-3" />
                      {opp.action}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
