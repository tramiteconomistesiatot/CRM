export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppLayout } from '@/components/layout/app-layout'
import type { Profile } from '@/types'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  console.log(`[DashboardLayout] User ID: ${user?.id || 'null'}`);
  if (!user) {
    console.log(`[DashboardLayout] No user session found, redirecting to /login`);
    redirect('/login')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  console.log(`[DashboardLayout] Profile found: ${!!profile} | Role: ${profile?.role || 'none'}`);
  if (profileError) {
    console.log(`[DashboardLayout] Database error fetching profile:`, profileError);
  }

  if (!profile) {
    console.log(`[DashboardLayout] Profile missing for user ${user.id}. Signing out and redirecting.`);
    await supabase.auth.signOut()
    redirect('/login')
  }
  if (profile.role === 'worker') {
    console.log(`[DashboardLayout] User is worker, redirecting to /worker`);
    redirect('/worker')
  }

  const typedProfile: Profile = {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    role: profile.role,
    phone: profile.phone ?? null,
    language: profile.language ?? 'ca',
    telegram_chat_id: profile.telegram_chat_id ?? null,
    active: profile.active ?? true,
    avatar_url: profile.avatar_url ?? null,
    color: profile.color ?? null,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
  }

  return (
    <AppLayout profile={typedProfile}>
      {children}
    </AppLayout>
  )
}
