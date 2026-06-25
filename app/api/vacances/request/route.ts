export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/utils/auth-guard'
import { notifyAdmins } from '@/lib/utils/notify'
import { calculateWorkingDays, hasOverlap } from '@/lib/utils/working-days'

export async function POST(request: Request) {
  const auth = await requireAuth()
  if ('error' in auth) return auth.error

  try {
    const { startDate, endDate, notes } = await request.json()

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Cal indicar les dates' }, { status: 400 })
    }
    if (endDate < startDate) {
      return NextResponse.json({ error: 'La data final no pot ser anterior a la inicial' }, { status: 400 })
    }

    const { supabase, user, profile } = auth
    const currentYear = new Date(startDate).getFullYear()

    // Fetch holidays and closures
    const [{ data: holidays }, { data: closures }] = await Promise.all([
      supabase.from('holidays').select('date').eq('year', currentYear),
      supabase.from('company_closures').select('date'),
    ])

    const holidayDates = holidays?.map(h => h.date) || []
    const closureDates = closures?.map(c => c.date) || []
    const workingDays = calculateWorkingDays(startDate, endDate, holidayDates, closureDates)

    if (workingDays <= 0) {
      return NextResponse.json({ error: 'El rang seleccionat no inclou dies laborables' }, { status: 400 })
    }

    // Check balance
    const { data: balance } = await supabase
      .from('vacation_balances')
      .select('total_days, used_days, pending_days')
      .eq('user_id', user.id)
      .eq('year', currentYear)
      .single()

    if (!balance) {
      return NextResponse.json({ error: 'No tens saldo de vacances per a aquest any' }, { status: 400 })
    }

    const available = balance.total_days - balance.used_days - balance.pending_days
    if (workingDays > available) {
      return NextResponse.json({
        error: `No tens prou dies disponibles. Sol·licites ${workingDays} dies, tens ${available} disponibles.`
      }, { status: 400 })
    }

    // Check overlapping requests
    const { data: existingRequests } = await supabase
      .from('absence_requests')
      .select('start_date, end_date')
      .eq('user_id', user.id)
      .in('status', ['pending', 'approved'])

    if (existingRequests && hasOverlap(startDate, endDate, existingRequests)) {
      return NextResponse.json({
        error: 'Ja tens una sol·licitud aprovada o pendent en aquest període'
      }, { status: 400 })
    }

    // Create request
    const { data: newRequest, error: insertError } = await supabase
      .from('absence_requests')
      .insert({
        user_id: user.id,
        type: 'vacation',
        start_date: startDate,
        end_date: endDate,
        working_days: workingDays,
        status: 'pending',
        notes: notes || null,
        deducts_vacation: true,
      })
      .select()
      .single()

    if (insertError) throw insertError

    // Update pending_days in balance
    await supabase
      .from('vacation_balances')
      .update({ pending_days: (balance.pending_days || 0) + workingDays })
      .eq('user_id', user.id)
      .eq('year', currentYear)

    // Notify admins
    await notifyAdmins({
      title: 'Nova sol·licitud de vacances',
      body: `${profile.full_name} ha sol·licitat vacances del ${startDate} al ${endDate} (${workingDays} dies)`,
      type: 'vacation_request',
      link: '/dashboard/vacances',
      metadata: { requestId: newRequest.id, userId: user.id, workingDays },
    })

    return NextResponse.json({ success: true, request: newRequest })
  } catch (error) {
    console.error('[vacances/request]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconegut' },
      { status: 500 }
    )
  }
}
