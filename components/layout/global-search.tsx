'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, User, Calendar, CheckSquare, MessageSquare, Loader2 } from 'lucide-react'

interface SearchResult {
  type: 'client' | 'appointment' | 'task' | 'message'
  id: string
  title: string
  subtitle: string
  url: string
  meta: string
}

const TYPE_CONFIG = {
  client: { label: 'Client', icon: User, color: 'text-tramit-blue' },
  appointment: { label: 'Cita', icon: Calendar, color: 'text-purple-500' },
  task: { label: 'Tasca', icon: CheckSquare, color: 'text-amber-500' },
  message: { label: 'Missatge', icon: MessageSquare, color: 'text-green-500' },
}

export function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const debounceRef = useRef<NodeJS.Timeout>()

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(data.results || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, search])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
      if (e.key === 'Escape') {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  function handleSelect(result: SearchResult) {
    router.push(result.url)
    setOpen(false)
    setQuery('')
    setResults([])
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Cerca... (⌘K)"
          className="h-9 w-48 lg:w-64 rounded-lg border border-input bg-background pl-9 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all focus:w-72"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
        {query && !loading && (
          <button
            onClick={() => { setQuery(''); setResults([]) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (query.length >= 2) && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-background border border-border rounded-xl shadow-2xl z-50 overflow-hidden min-w-[320px]">
          {results.length === 0 && !loading ? (
            <div className="px-4 py-6 text-center text-muted-foreground">
              <Search className="h-6 w-6 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sense resultats per &ldquo;{query}&rdquo;</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {Object.entries(TYPE_CONFIG).map(([type, config]) => {
                const typeResults = results.filter(r => r.type === type)
                if (typeResults.length === 0) return null
                const Icon = config.icon

                return (
                  <div key={type}>
                    <div className="px-3 py-1.5 bg-muted/50">
                      <p className={`text-[10px] font-semibold uppercase tracking-wider ${config.color}`}>
                        {config.label}s
                      </p>
                    </div>
                    {typeResults.map(result => (
                      <button
                        key={result.id}
                        onClick={() => handleSelect(result)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                      >
                        <div className={`p-1.5 rounded-lg bg-muted shrink-0`}>
                          <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{result.title}</p>
                          {result.subtitle && (
                            <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                          )}
                        </div>
                        {result.meta && (
                          <span className="text-[10px] text-muted-foreground shrink-0">{result.meta}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
          <div className="px-3 py-2 bg-muted/30 border-t border-border">
            <p className="text-[10px] text-muted-foreground">
              ↑↓ navegar · Enter seleccionar · Esc tancar
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
