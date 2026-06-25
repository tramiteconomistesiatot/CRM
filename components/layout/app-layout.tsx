'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Sidebar } from './sidebar'
import { Header } from './header'
import type { Profile } from '@/types'

interface AppLayoutProps {
  children: React.ReactNode
  profile: Profile
}

export function AppLayout({ children, profile }: AppLayoutProps) {
  const router = useRouter()
  const supabase = createClient()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Overlay mòbil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — ocult en mòbil per defecte */}
      <div className={`
        fixed left-0 top-0 h-screen z-40 transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <Sidebar
          profile={profile}
          onSignOut={handleSignOut}
          onNavigate={() => setSidebarOpen(false)}
        />
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 lg:left-[220px] right-0 h-14 bg-background border-b border-border flex items-center justify-between px-4 lg:px-6 z-30">
        {/* Botó hamburguesa — només mòbil */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors"
          aria-label="Menú"
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <Header />
      </header>

      {/* Contingut principal */}
      <main className="lg:ml-[220px] mt-14 p-4 lg:p-6 min-h-[calc(100vh-3.5rem)]">
        {children}
      </main>
    </div>
  )
}
