'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sparkles, Copy, CheckCircle, Loader2, RefreshCw, Mail } from 'lucide-react'

export function EmailDraft({ clientName }: { clientName?: string }) {
  const [instruction, setInstruction] = useState('')
  const [context, setContext] = useState('')
  const [language, setLanguage] = useState<'ca' | 'es'>('ca')
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const QUICK_PROMPTS = [
    'Recordar la cita de demà',
    'Confirmar recepció de documentació',
    'Sol·licitar documentació pendent',
    'Informar del resultat de la declaració',
    'Enviar pressupost de serveis',
    'Recordar termini de presentació pròxim',
  ]

  async function generateDraft(customInstruction?: string) {
    const finalInstruction = customInstruction || instruction
    if (!finalInstruction.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/email-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction: finalInstruction,
          clientName,
          context,
          language,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDraft(data.draft)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error generant l'esborrany")
    } finally {
      setLoading(false)
    }
  }

  async function copyToClipboard() {
    await navigator.clipboard.writeText(draft)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-tramit-blue" />
          Redactar email amb IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Accions ràpides:</p>
          <div className="flex gap-1.5 flex-wrap">
            {QUICK_PROMPTS.map(prompt => (
              <button
                key={prompt}
                onClick={() => { setInstruction(prompt); generateDraft(prompt) }}
                disabled={loading}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-border hover:border-tramit-blue/50 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Instrucció personalitzada</Label>
          <div className="flex gap-2">
            <Input
              value={instruction}
              onChange={e => setInstruction(e.target.value)}
              placeholder="Ex: recordar-li que ha de portar el DNI..."
              onKeyDown={e => e.key === 'Enter' && generateDraft()}
            />
            <div className="flex gap-1">
              {(['ca', 'es'] as const).map(lang => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium border ${
                    language === lang
                      ? 'bg-tramit-blue text-white border-tramit-blue'
                      : 'border-border text-muted-foreground'
                  }`}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>
            <Button
              variant="tramit"
              onClick={() => generateDraft()}
              disabled={loading || !instruction.trim()}
              className="shrink-0"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generar
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Context addicional <span className="text-muted-foreground">(opcional)</span></Label>
          <Input
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="Ex: cita el dia 15 a les 10h..."
          />
        </div>

        {error && (
          <div className="text-red-600 text-sm bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        {draft && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Esborrany generat:</p>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" onClick={() => generateDraft()} disabled={loading}>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Regenerar
                </Button>
                <Button size="sm" variant={copied ? 'outline' : 'tramit'} onClick={copyToClipboard}>
                  {copied
                    ? <><CheckCircle className="h-3.5 w-3.5 mr-1" />Copiat!</>
                    : <><Copy className="h-3.5 w-3.5 mr-1" />Copiar</>
                  }
                </Button>
                <a
                  href={`mailto:?body=${encodeURIComponent(draft)}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border hover:bg-muted transition-colors"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Obrir mail
                </a>
              </div>
            </div>
            <div className="bg-muted/50 rounded-xl p-4 text-xs whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto border border-border">
              {draft}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
