import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function requireAuth() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: 'No autoritzat' }, { status: 401 }) }
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  if (!profile) {
    return { error: NextResponse.json({ error: 'Perfil no trobat' }, { status: 401 }) }
  }
  return { user, profile, supabase }
}

export async function requireAdmin() {
  const auth = await requireAuth()
  if ('error' in auth) return auth
  if (auth.profile.role !== 'admin' && auth.profile.role !== 'supervisor') {
    return { error: NextResponse.json({ error: 'Accés denegat' }, { status: 403 }) }
  }
  return auth
}

export async function requireOwnerOrAdmin(resourceUserId: string) {
  const auth = await requireAuth()
  if ('error' in auth) return auth
  const isAdmin = auth.profile.role === 'admin' || auth.profile.role === 'supervisor'
  const isOwner = auth.user.id === resourceUserId
  if (!isAdmin && !isOwner) {
    return { error: NextResponse.json({ error: 'Accés denegat' }, { status: 403 }) }
  }
  return auth
}
