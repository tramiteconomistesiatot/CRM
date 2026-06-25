'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Send, Plus, X, CheckCheck, Paperclip, Smile,
  Search, MoreVertical, ArrowLeft
} from 'lucide-react'

interface Profile {
  id: string
  full_name: string
  color: string | null
  role: string
}

interface Message {
  id: string
  sender_id: string
  recipient_id: string
  subject: string
  body: string
  read: boolean
  read_at: string | null
  parent_id: string | null
  created_at: string
  sender?: { full_name: string; color: string | null; role: string } | null
  recipient?: { full_name: string; color: string | null; role: string } | null
}

interface Conversation {
  contactId: string
  contactName: string
  contactColor: string
  contactRole: string
  messages: Message[]
  lastMessage: Message
  unread: number
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (diff < 60) return 'Ara'
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  if (diff < 86400) return date.toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' })
  if (diff < 604800) return date.toLocaleDateString('ca-ES', { weekday: 'short' })
  return date.toLocaleDateString('ca-ES', { day: '2-digit', month: 'short' })
}

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' })
}

function formatDayLabel(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 86400000)
  if (diff === 0) return 'Avui'
  if (diff === 1) return 'Ahir'
  return date.toLocaleDateString('ca-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administradora',
  supervisor: 'Supervisor',
  worker: 'Treballador/a',
}

export function MissatgesClient({
  currentUserId,
  profiles,
}: {
  currentUserId: string
  profiles: Profile[]
}) {
  const [allMessages, setAllMessages] = useState<Message[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [showNewConv, setShowNewConv] = useState(false)
  const [body, setBody] = useState('')
  const [subject, setSubject] = useState('Missatge intern')
  const [newRecipient, setNewRecipient] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showMobileConv, setShowMobileConv] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const supabase = createClient()

  useEffect(() => {
    loadMessages()
    const interval = setInterval(loadMessages, 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeConvId, allMessages])

  async function loadMessages() {
    try {
      const res = await fetch('/api/messages')
      if (res.ok) {
        const data = await res.json()
        const combined = [...(data.received || []), ...(data.sent || [])]
        setAllMessages(combined)
      }
    } finally {
      setLoading(false)
    }
  }

  // Agrupar missatges per conversa (per contacte)
  const conversations: Conversation[] = (() => {
    const convMap: Record<string, Message[]> = {}
    allMessages.forEach(msg => {
      const contactId = msg.sender_id === currentUserId ? msg.recipient_id : msg.sender_id
      if (!convMap[contactId]) convMap[contactId] = []
      convMap[contactId].push(msg)
    })

    return Object.entries(convMap).map(([contactId, msgs]) => {
      const sorted = msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      const last = sorted[sorted.length - 1]
      const contact = profiles.find(p => p.id === contactId)
      const unread = msgs.filter(m => m.recipient_id === currentUserId && !m.read).length
      return {
        contactId,
        contactName: contact?.full_name || '—',
        contactColor: contact?.color || '#2272A3',
        contactRole: contact?.role || 'worker',
        messages: sorted,
        lastMessage: last,
        unread,
      }
    }).sort((a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime())
  })()

  const filteredConvs = search
    ? conversations.filter(c => c.contactName.toLowerCase().includes(search.toLowerCase()))
    : conversations

  const activeConv = conversations.find(c => c.contactId === activeConvId)

  async function openConversation(convId: string) {
    setActiveConvId(convId)
    setShowMobileConv(true)
    setShowNewConv(false)
    // Marcar com a llegits
    const conv = conversations.find(c => c.contactId === convId)
    if (!conv) return
    const unread = conv.messages.filter(m => m.recipient_id === currentUserId && !m.read)
    for (const msg of unread) {
      await fetch('/api/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: msg.id }),
      })
    }
    await loadMessages()
  }

  async function handleSend() {
    const recipientId = showNewConv ? newRecipient : activeConvId
    if (!recipientId || !body.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_id: recipientId,
          subject: showNewConv ? subject : (activeConv?.messages[0]?.subject || 'Missatge intern'),
          body: body.trim(),
        }),
      })
      if (res.ok) {
        setBody('')
        if (showNewConv) {
          setShowNewConv(false)
          setActiveConvId(newRecipient)
          setShowMobileConv(true)
        }
        await loadMessages()
      }
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread, 0)

  // Agrupar missatges per dia per mostrar separadors
  function groupByDay(msgs: Message[]) {
    const groups: { day: string; messages: Message[] }[] = []
    msgs.forEach(msg => {
      const day = msg.created_at.split('T')[0]
      const last = groups[groups.length - 1]
      if (last && last.day === day) {
        last.messages.push(msg)
      } else {
        groups.push({ day, messages: [msg] })
      }
    })
    return groups
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] border border-border rounded-xl overflow-hidden bg-background">

      {/* LLISTA DE CONVERSES */}
      <div className={`w-80 shrink-0 flex flex-col border-r border-border ${showMobileConv ? 'hidden md:flex' : 'flex'}`}>

        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold flex items-center gap-2">
              Missatges
              {totalUnread > 0 && (
                <span className="bg-tramit-blue text-white text-xs rounded-full px-2 py-0.5 font-bold">
                  {totalUnread}
                </span>
              )}
            </h1>
            <Button
              variant="tramit"
              size="sm"
              onClick={() => { setShowNewConv(true); setActiveConvId(null); setShowMobileConv(true) }}
              className="flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Nou
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cercar conversa..."
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        {/* Llista */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="space-y-1 p-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filteredConvs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">Cap conversa</p>
              <p className="text-xs mt-1">Envia el primer missatge</p>
            </div>
          ) : (
            filteredConvs.map(conv => (
              <button
                key={conv.contactId}
                onClick={() => openConversation(conv.contactId)}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors hover:bg-muted/50 border-b border-border/50 ${
                  activeConvId === conv.contactId ? 'bg-tramit-blue-light dark:bg-blue-900/20' : ''
                }`}
              >
                <div className="relative shrink-0">
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                    style={{ backgroundColor: conv.contactColor }}
                  >
                    {getInitials(conv.contactName)}
                  </div>
                  {conv.unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-tramit-blue text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                      {conv.unread}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className={`text-sm truncate ${conv.unread > 0 ? 'font-bold' : 'font-medium'}`}>
                      {conv.contactName}
                    </p>
                    <p className="text-[10px] text-muted-foreground shrink-0">
                      {formatTime(conv.lastMessage.created_at)}
                    </p>
                  </div>
                  <p className={`text-xs truncate mt-0.5 ${conv.unread > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                    {conv.lastMessage.sender_id === currentUserId ? 'Tu: ' : ''}
                    {conv.lastMessage.body}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ÀREA DE CONVERSA */}
      <div className={`flex-1 flex flex-col min-w-0 ${!showMobileConv ? 'hidden md:flex' : 'flex'}`}>

        {showNewConv ? (
          <>
            {/* Header nova conversa */}
            <div className="px-4 py-3 border-b border-border flex items-center gap-3">
              <button
                onClick={() => { setShowNewConv(false); setShowMobileConv(false) }}
                className="md:hidden text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h2 className="font-semibold">Nou missatge</h2>
              <button onClick={() => setShowNewConv(false)} className="ml-auto text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 p-4 space-y-4">
              <div className="space-y-1.5">
                <Label>Per a</Label>
                <select
                  value={newRecipient}
                  onChange={e => setNewRecipient(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Selecciona destinatari...</option>
                  {profiles.filter(p => p.id !== currentUserId).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} — {ROLE_LABELS[p.role] || p.role}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Assumpte</Label>
                <Input value={subject} onChange={e => setSubject(e.target.value)} />
              </div>
            </div>
            {/* Input enviar */}
            <div className="p-3 border-t border-border bg-background">
              <div className="flex items-end gap-2 bg-muted rounded-xl px-3 py-2">
                <textarea
                  ref={textareaRef}
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escriu el missatge..."
                  rows={3}
                  className="flex-1 bg-transparent text-sm resize-none focus:outline-none leading-relaxed"
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !body.trim() || !newRecipient}
                  className="mb-1 p-2 bg-tramit-blue text-white rounded-lg hover:bg-tramit-blue-dark disabled:opacity-40 transition-colors"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1 ml-1">Enter per enviar · Shift+Enter per salt de línia</p>
            </div>
          </>
        ) : activeConv ? (
          <>
            {/* Header conversa activa */}
            <div className="px-4 py-3 border-b border-border flex items-center gap-3">
              <button
                onClick={() => { setShowMobileConv(false); setActiveConvId(null) }}
                className="md:hidden text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                style={{ backgroundColor: activeConv.contactColor }}
              >
                {getInitials(activeConv.contactName)}
              </div>
              <div>
                <p className="font-semibold text-sm">{activeConv.contactName}</p>
                <p className="text-xs text-muted-foreground">{ROLE_LABELS[activeConv.contactRole] || activeConv.contactRole}</p>
              </div>
            </div>

            {/* Missatges */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {groupByDay(activeConv.messages).map(group => (
                <div key={group.day}>
                  {/* Separador de dia */}
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground px-2 shrink-0">
                      {formatDayLabel(group.day)}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <div className="space-y-2">
                    {group.messages.map(msg => {
                      const isMine = msg.sender_id === currentUserId
                      return (
                        <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                          {!isMine && (
                            <div
                              className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mr-2 mt-1"
                              style={{ backgroundColor: activeConv.contactColor }}
                            >
                              {getInitials(activeConv.contactName)}
                            </div>
                          )}
                          <div className={`max-w-[70%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                            <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                              isMine
                                ? 'bg-tramit-blue text-white rounded-br-sm'
                                : 'bg-muted text-foreground rounded-bl-sm'
                            }`}>
                              {msg.body.split('\n').map((line, i) => (
                                <span key={i}>{line}{i < msg.body.split('\n').length - 1 && <br />}</span>
                              ))}
                            </div>
                            <div className={`flex items-center gap-1 mt-0.5 ${isMine ? 'flex-row-reverse' : ''}`}>
                              <span className="text-[10px] text-muted-foreground">{formatMessageTime(msg.created_at)}</span>
                              {isMine && (
                                <CheckCheck className={`h-3 w-3 ${msg.read ? 'text-tramit-blue' : 'text-muted-foreground'}`} />
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input enviar */}
            <div className="p-3 border-t border-border bg-background">
              <div className="flex items-end gap-2 bg-muted rounded-xl px-3 py-2">
                <textarea
                  ref={textareaRef}
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Missatge per a ${activeConv.contactName.split(' ')[0]}...`}
                  rows={1}
                  style={{ minHeight: '24px', maxHeight: '120px' }}
                  className="flex-1 bg-transparent text-sm resize-none focus:outline-none leading-relaxed"
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !body.trim()}
                  className="mb-0.5 p-2 bg-tramit-blue text-white rounded-lg hover:bg-tramit-blue-dark disabled:opacity-40 transition-colors"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1 ml-1">Enter per enviar · Shift+Enter per salt de línia</p>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center text-muted-foreground">
            <div>
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Send className="h-7 w-7 opacity-30" />
              </div>
              <p className="font-medium">Selecciona una conversa</p>
              <p className="text-sm mt-1">O inicia un nou missatge</p>
              <Button
                variant="tramit"
                size="sm"
                className="mt-4"
                onClick={() => { setShowNewConv(true); setShowMobileConv(true) }}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Nou missatge
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
