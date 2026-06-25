'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell, X, CheckCheck, Calendar, Umbrella, ClipboardList, Info } from 'lucide-react'
import { useNotifications } from '@/hooks/use-notifications'
import Link from 'next/link'

const NOTIFICATION_ICONS: Record<string, React.ReactNode> = {
  vacation_request:      <Umbrella className="h-4 w-4 text-amber-500" />,
  vacation_approved:     <Umbrella className="h-4 w-4 text-green-500" />,
  vacation_rejected:     <Umbrella className="h-4 w-4 text-red-500" />,
  appointment_assigned:  <Calendar className="h-4 w-4 text-blue-500" />,
  appointment_confirmed: <Calendar className="h-4 w-4 text-green-500" />,
  appointment_rejected:  <Calendar className="h-4 w-4 text-red-500" />,
  task_assigned:         <ClipboardList className="h-4 w-4 text-purple-500" />,
  system:                <Info className="h-4 w-4 text-slate-500" />,
  other:                 <Info className="h-4 w-4 text-slate-500" />,
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const diff = Math.floor((now - date) / 1000)
  if (diff < 60) return 'ara mateix'
  if (diff < 3600) return `fa ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `fa ${Math.floor(diff / 3600)} h`
  return `fa ${Math.floor(diff / 86400)} dies`
}

export function Header() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleOpen() {
    setOpen(!open)
    // Mark unread as read when opening
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id)
    if (unreadIds.length > 0) {
      markAsRead(unreadIds)
    }
  }

  return (
    <div className="flex items-center gap-2 ml-auto" ref={panelRef}>
      {/* Notification Bell */}
      <div className="relative">
        <button
          id="notification-bell-btn"
          onClick={handleOpen}
          className="relative p-2 rounded-lg hover:bg-muted transition-colors"
          aria-label={`Notificacions${unreadCount > 0 ? ` (${unreadCount} noves)` : ''}`}
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 min-w-[1rem] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Notifications Panel */}
        {open && (
          <div
            id="notifications-panel"
            className="absolute right-0 top-full mt-2 w-80 bg-background border border-border rounded-xl shadow-xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold">Notificacions</h3>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
                    title="Marcar totes com llegides"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Totes llegides
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1 rounded-md hover:bg-muted text-muted-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Notification List */}
            <div className="max-h-96 overflow-y-auto divide-y divide-border">
              {notifications.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">Cap notificació</p>
                </div>
              ) : (
                notifications.map(notif => (
                  <div
                    key={notif.id}
                    className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50 ${
                      !notif.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                    }`}
                  >
                    <div className="shrink-0 mt-0.5">
                      {NOTIFICATION_ICONS[notif.type] || NOTIFICATION_ICONS['other']}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${!notif.read ? 'font-semibold' : 'font-medium'}`}>
                        {notif.link ? (
                          <Link
                            href={notif.link}
                            onClick={() => setOpen(false)}
                            className="hover:underline"
                          >
                            {notif.title}
                          </Link>
                        ) : notif.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.body}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(notif.created_at)}</p>
                    </div>
                    {!notif.read && (
                      <div className="shrink-0 mt-1.5 h-2 w-2 rounded-full bg-blue-500" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
