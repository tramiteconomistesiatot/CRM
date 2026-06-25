'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, Check, CheckCheck, X, Calendar, Umbrella, ClipboardList, Info } from 'lucide-react'

interface Notification {
  id: string
  title: string
  body: string
  type: string
  read: boolean
  link: string | null
  created_at: string
}

function getIcon(type: string) {
  if (type.includes('vacation') || type.includes('absence')) return Umbrella
  if (type.includes('appointment')) return Calendar
  if (type.includes('sick') || type.includes('permission')) return ClipboardList
  return Info
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diff < 60) return 'Ara mateix'
  if (diff < 3600) return `Fa ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `Fa ${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `Fa ${Math.floor(diff / 86400)} dies`
  return date.toLocaleDateString('ca-ES', { day: '2-digit', month: 'short' })
}

export function NotificationsBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const unread = notifications.filter(n => !n.read).length

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function fetchNotifications() {
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data)
      }
    } catch {
      // silenci
    }
  }

  async function markRead(id: string) {
    setLoading(true)
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setLoading(false)
  }

  async function markAllRead() {
    setLoading(true)
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'all' }),
    })
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setLoading(false)
  }

  return (
    <div className="relative" ref={ref}>
      {/* Botó campana */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-muted transition-colors"
        aria-label="Notificacions"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center font-bold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Panel de notificacions */}
      {open && (
        <div className="absolute right-0 top-10 w-80 bg-background border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Capçalera */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">Notificacions</h3>
              {unread > 0 && (
                <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded-full font-medium">
                  {unread} noves
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  disabled={loading}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors"
                  title="Marcar totes com a llegides"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Tot llegit
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Llista */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Cap notificació</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map(notif => {
                  const Icon = getIcon(notif.type)
                  return (
                    <div
                      key={notif.id}
                      className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                        !notif.read ? 'bg-tramit-blue-light/50 dark:bg-blue-900/10' : 'hover:bg-muted/30'
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                        !notif.read
                          ? 'bg-tramit-blue text-white'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!notif.read ? 'font-semibold' : 'font-medium'}`}>
                          {notif.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          {notif.body}
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          {timeAgo(notif.created_at)}
                        </p>
                      </div>

                      {!notif.read && (
                        <button
                          onClick={() => markRead(notif.id)}
                          disabled={loading}
                          className="p-1 rounded-md text-muted-foreground hover:text-tramit-blue hover:bg-tramit-blue-light transition-colors shrink-0 mt-0.5"
                          title="Marcar com a llegida"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Peu */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-border bg-muted/30">
              <p className="text-xs text-center text-muted-foreground">
                Mostrant les últimes {notifications.length} notificacions
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
