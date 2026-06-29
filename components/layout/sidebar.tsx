'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Calendar, Umbrella, Users,
  BarChart3, Settings, Home, LogOut,
  UserCircle, BookOpen, MessageSquare,
  CheckSquare, FileText, FilePen,
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { TramitLogo } from './logo'
import type { Profile } from '@/types'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavSection {
  title: string
  items: NavItem[]
}

const adminSections: NavSection[] = [
  {
    title: 'General',
    items: [
      { label: 'Tauler',          href: '/dashboard',               icon: LayoutDashboard },
    ]
  },
  {
    title: 'Gestió / Operacions',
    items: [
      { label: 'Agenda / Cites',  href: '/dashboard/agenda',        icon: Calendar },
      { label: 'Tràmits',         href: '/dashboard/tasques',       icon: CheckSquare },
      { label: 'Firma Digital',   href: '/dashboard/firma-digital', icon: FilePen },
    ]
  },
  {
    title: 'Comercial / CRM',
    items: [
      { label: 'Clients',         href: '/dashboard/clients',       icon: Users },
      { label: 'Oriol',           href: '/dashboard/assessor',      icon: BookOpen },
    ]
  },
  {
    title: 'Administració',
    items: [
      { label: 'Equip i Vacances', href: '/dashboard/equip',         icon: Umbrella },
      { label: 'Calendari i Festius', href: '/dashboard/calendari-fiscal', icon: Calendar },
      { label: 'Configuració',     href: '/dashboard/administracio', icon: Settings },
      { label: 'El meu perfil',   href: '/dashboard/perfil',        icon: UserCircle },
    ]
  }
]

const workerNavItems: NavItem[] = [
  { label: 'Inici',         href: '/worker',          icon: Home },
  { label: 'Agenda i Cites', href: '/worker/agenda',   icon: Calendar },
  { label: 'Vacances',      href: '/worker/vacances', icon: Umbrella },
  { label: 'El meu perfil', href: '/worker/perfil',   icon: UserCircle },
]

interface SidebarProps {
  profile: Profile
  onSignOut: () => void
  onNavigate?: () => void
}

export function Sidebar({ profile, onSignOut, onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const isAdmin = profile.role === 'admin' || profile.role === 'supervisor'
  const initials = getInitials(profile.full_name || '')

  return (
    <aside className="w-[220px] h-screen flex flex-col bg-tramit-blue-dark text-white">
      <div className="flex items-center justify-center py-5 px-4 border-b border-white/10">
        <div className="bg-white rounded-lg px-3 py-2">
          <TramitLogo size="sm" />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-4">
        {isAdmin ? (
          adminSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider px-3 mb-1">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon
                  const isActive =
                    pathname === item.href ||
                    (item.href !== '/dashboard' && pathname.startsWith(item.href))

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                          'flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium transition-all duration-150',
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'text-white/70 hover:bg-white/10 hover:text-white'
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))
        ) : (
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider px-3 mb-1">
              Àrea Treballador
            </p>
            <ul className="space-y-0.5">
              {workerNavItems.map((item) => {
                const Icon = item.icon
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/worker' && pathname.startsWith(item.href))

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium transition-all duration-150',
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'text-white/70 hover:bg-white/10 hover:text-white'
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2 px-2 py-2 mb-1">
          <div
            className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ backgroundColor: profile.color || '#ffffff33' }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{profile.full_name}</p>
            <p className="text-[10px] text-white/50 truncate capitalize">{profile.role}</p>
          </div>
        </div>
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/60 hover:text-white hover:bg-white/10 rounded-md transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Tancar sessió
        </button>
      </div>
    </aside>
  )
}
