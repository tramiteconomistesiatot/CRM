'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff, CheckCircle, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PushNotifications() {
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    setSupported('Notification' in window && 'serviceWorker' in navigator)
    if ('Notification' in window) {
      setPermission(Notification.permission)
      setSubscribed(Notification.permission === 'granted')
    }
  }, [])

  function showMsg(text: string, type: 'success' | 'error') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 4000)
  }

  async function subscribe() {
    setLoading(true)
    try {
      const permission = await Notification.requestPermission()
      setPermission(permission)

      if (permission !== 'granted') {
        showMsg('Cal acceptar els permisos de notificació al navegador', 'error')
        return
      }

      setSubscribed(true)
      showMsg('Notificacions push activades correctament', 'success')
    } catch {
      showMsg('Error activant les notificacions', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function unsubscribe() {
    setLoading(true)
    setSubscribed(false)
    showMsg('Notificacions push desactivades', 'success')
    setLoading(false)
  }

  async function testNotification() {
    if (Notification.permission === 'granted') {
      new Notification('Tràmit Economistes', {
        body: 'Les notificacions funcionen correctament! ✓',
        icon: '/icon-192.png',
      })
    }
  }

  if (!supported) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-4 py-3 rounded-lg">
        <BellOff className="h-4 w-4 shrink-0" />
        El teu navegador no suporta notificacions push.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/20">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${subscribed ? 'bg-green-100 dark:bg-green-900/20' : 'bg-muted'}`}>
            {subscribed
              ? <Bell className="h-5 w-5 text-green-600" />
              : <BellOff className="h-5 w-5 text-muted-foreground" />
            }
          </div>
          <div>
            <p className="text-sm font-medium">Notificacions push</p>
            <p className="text-xs text-muted-foreground">
              {subscribed
                ? 'Activades — rebràs alertes al teu dispositiu'
                : 'Desactivades — activa-les per rebre alertes'}
            </p>
          </div>
        </div>
        <button
          onClick={subscribed ? unsubscribe : subscribe}
          disabled={loading}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            subscribed ? 'bg-green-500' : 'bg-muted-foreground/30'
          }`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            subscribed ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
      </div>

      {subscribed && (
        <Button
          variant="outline"
          size="sm"
          onClick={testNotification}
          className="flex items-center gap-1.5"
        >
          <Bell className="h-3.5 w-3.5" />
          Provar notificació
        </Button>
      )}

      {msg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${
          msg.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
        }`}>
          {msg.type === 'success'
            ? <CheckCircle className="h-4 w-4 shrink-0" />
            : <AlertTriangle className="h-4 w-4 shrink-0" />
          }
          {msg.text}
        </div>
      )}

      <div className="text-xs text-muted-foreground space-y-1 bg-muted/30 px-3 py-2.5 rounded-lg">
        <p className="font-medium">Rebràs notificacions per:</p>
        <ul className="space-y-0.5 mt-1">
          {[
            'Sol·licituds de vacances aprovades o rebutjades',
            'Cites noves o modificades',
            'Missatges interns nous',
            'Tasques assignades',
            'Alertes de terminis fiscals',
          ].map(item => (
            <li key={item} className="flex items-center gap-1.5">
              <span className="text-green-500">·</span>{item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
