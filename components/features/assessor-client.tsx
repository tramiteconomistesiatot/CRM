'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Send, Sparkles, RefreshCw, ChevronRight, BookOpen,
  Trash2, Plus, X, FileText, ChevronDown, ChevronUp
} from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface Rule {
  key: string
  value: string
  description: string
}

const QUICK_PROMPTS = [
  'Qui té tasques endarrerides?',
  'Quins terminis fiscals s\'apropen?',
  'Redacta un email professional per a un client',
  'Quantes vacances li queden a l\'equip?',
  'Quins clients no han tingut contacte recent?',
  'Resumeix les cites d\'aquesta setmana',
]

export function AssessorClient({
  userName,
  isAdmin,
}: {
  userName: string
  isAdmin: boolean
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Hola, ${userName.split(' ')[0]}! Sóc l'Oriol, el teu assessor financer i de gestió intel·ligent. Puc ajudar-te a respondre dubtes sobre la normativa, gestionar l'equip, redacció de comunicats i consultes fiscals. En què et puc ajudar avui?`,
      timestamp: new Date(),
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [rules, setRules] = useState<Rule[]>([])
  const [expandedRule, setExpandedRule] = useState<string | null>(null)
  
  // Rule Form
  const [showRuleForm, setShowRuleForm] = useState(false)
  const [ruleTitle, setRuleTitle] = useState('')
  const [ruleContent, setRuleContent] = useState('')
  const [savingRule, setSavingRule] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Fetch advisor rules (stored in settings)
  useEffect(() => {
    async function fetchRules() {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .like('key', 'advisor_rule_%')
      if (!error && data) {
        setRules(data as Rule[])
      }
    }
    fetchRules()
  }, [supabase])

  async function handleSend(text?: string) {
    const content = text || input.trim()
    if (!content) return
    setInput('')
    const userMsg: Message = { role: 'user', content, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    try {
      const res = await fetch('/api/assessor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          isAdmin,
        }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response || 'Ho sento, no he pogut processar la teva consulta.',
        timestamp: new Date(),
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Ha ocorregut un error. Torna-ho a intentar.',
        timestamp: new Date(),
      }])
    } finally {
      setLoading(false)
    }
  }

  async function handleAddRule(e: React.FormEvent) {
    e.preventDefault()
    if (!ruleTitle.trim() || !ruleContent.trim()) return
    setSavingRule(true)
    const key = `advisor_rule_${Date.now()}`
    const { error } = await supabase.from('settings').insert({
      key,
      value: ruleContent.trim(),
      description: ruleTitle.trim(),
    })
    setSavingRule(false)
    if (!error) {
      setRules(prev => [...prev, { key, value: ruleContent.trim(), description: ruleTitle.trim() }])
      setRuleTitle('')
      setRuleContent('')
      setShowRuleForm(false)
    } else {
      alert("Error en guardar la font d'informació: " + error.message)
    }
  }

  async function handleDeleteRule(key: string) {
    if (!confirm("Segur que vols eliminar aquesta font d'informació? L'Oriol deixarà de regir-se per ella.")) return
    const { error } = await supabase.from('settings').delete().eq('key', key)
    if (!error) {
      setRules(prev => prev.filter(r => r.key !== key))
      if (expandedRule === key) setExpandedRule(null)
    } else {
      alert("Error en eliminar: " + error.message)
    }
  }

  function formatTime(date: Date): string {
    return date.toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl h-[calc(100vh-6rem)]">
      {/* Zona de Chat */}
      <div className="lg:col-span-2 flex flex-col h-full bg-white dark:bg-slate-900 border border-border rounded-xl p-4">
        <div className="mb-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-tramit-blue" />
            Oriol
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            El teu assessor intel·ligent financer i de gestió interna de la gestoria
          </p>
        </div>

        {/* Suggeriments ràpids */}
        {messages.length <= 1 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Suggeriments:</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_PROMPTS.map(prompt => (
                <button
                  key={prompt}
                  onClick={() => handleSend(prompt)}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-border hover:border-tramit-blue/50 hover:bg-tramit-blue-light transition-colors"
                >
                  {prompt}
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Missatges */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="h-8 w-8 rounded-full bg-tramit-blue flex items-center justify-center shrink-0 mr-2 mt-1">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
              )}
              <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-tramit-blue text-white rounded-br-sm'
                    : 'bg-muted text-foreground rounded-bl-sm'
                }`}>
                  {msg.content.split('\n').map((line, j) => (
                    <span key={j}>{line}{j < msg.content.split('\n').length - 1 && <br />}</span>
                  ))}
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 px-1">
                  {formatTime(msg.timestamp)}
                </span>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="h-8 w-8 rounded-full bg-tramit-blue flex items-center justify-center shrink-0 mr-2">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2 items-end">
          {messages.length > 2 && (
            <button
              onClick={() => setMessages(prev => [prev[0]])}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors shrink-0"
              title="Reiniciar conversa"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
          <div className="flex-1 flex items-end bg-muted rounded-xl px-3 py-2 gap-2">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder="Pregunta-li qualsevol cosa a l'Oriol..."
              rows={1}
              style={{ minHeight: '24px', maxHeight: '120px' }}
              className="flex-1 bg-transparent text-sm resize-none focus:outline-none leading-relaxed"
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="p-2 bg-tramit-blue text-white rounded-lg hover:bg-tramit-blue-dark disabled:opacity-40 transition-colors shrink-0"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1 text-center">
          Enter per enviar · Shift+Enter per salt de línia
        </p>
      </div>

      {/* Zona de Fonts / Lleis adjuntes */}
      <div className="flex flex-col h-full bg-white dark:bg-slate-900 border border-border rounded-xl p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-tramit-blue" />
            Fonts i Lleis
          </h2>
          {isAdmin && !showRuleForm && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowRuleForm(true)}
              className="h-8 px-2 text-xs flex items-center gap-1 border-tramit-blue text-tramit-blue hover:bg-tramit-blue-light"
            >
              <Plus className="h-3 w-3" /> Afegir
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          Lleis, decrets o bases de coneixement per les quals es regeix l&apos;Oriol per respondre.
        </p>

        {/* Formulari per afegir llei */}
        {showRuleForm && (
          <Card className="mb-4 border-tramit-blue/30">
            <CardHeader className="p-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-bold">Nova font de dades</CardTitle>
                <button onClick={() => setShowRuleForm(false)} className="text-muted-foreground hover:text-foreground" type="button">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <form onSubmit={handleAddRule} className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-[10px]">Títol o Nom de la Llei</Label>
                  <Input
                    value={ruleTitle}
                    onChange={e => setRuleTitle(e.target.value)}
                    placeholder="Ex: Llei IRPF Article 20"
                    className="h-8 text-xs"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Contingut o Text legal</Label>
                  <textarea
                    value={ruleContent}
                    onChange={e => setRuleContent(e.target.value)}
                    placeholder="Enganxa el contingut de la font d'informació, articles o condicions particulars..."
                    rows={4}
                    className="w-full text-xs p-2 border rounded-md resize-none focus:outline-none"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" type="submit" variant="tramit" disabled={savingRule} className="h-7 text-xs flex-1">
                    {savingRule ? 'Desant...' : 'Desar'}
                  </Button>
                  <Button size="sm" type="button" variant="outline" onClick={() => setShowRuleForm(false)} className="h-7 text-xs flex-1">
                    Cancel·lar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Llista de lleis / fonts */}
        <div className="space-y-2 flex-1">
          {rules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto opacity-30 mb-2" />
              <p className="text-xs">Cap font de dades adjunta.</p>
              <p className="text-[10px] mt-1">L&apos;Oriol utilitza la seva base de coneixement predeterminada.</p>
            </div>
          ) : (
            rules.map(rule => {
              const isExpanded = expandedRule === rule.key
              return (
                <div key={rule.key} className="border border-border rounded-lg p-2.5 hover:border-tramit-blue/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground truncate flex-1 pr-2">
                      {rule.description}
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => setExpandedRule(isExpanded ? null : rule.key)}
                        className="text-muted-foreground hover:text-foreground p-0.5"
                        title={isExpanded ? 'Col·lapsar' : 'Ampliar'}
                      >
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteRule(rule.key)}
                          className="text-red-400 hover:text-red-600 p-0.5"
                          title="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="mt-2 text-[11px] text-muted-foreground border-t border-border pt-2 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {rule.value}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
