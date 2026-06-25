export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/utils/auth-guard'
import { notifyUser } from '@/lib/utils/notify'
import { sendEmail, emailVacancesDecisio } from '@/lib/resend'

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  try {
    const { requestId, action, adminNote } = await request.json()

    if (!requestId || !action || !['approved', 'rejected'].includes(action)) {
      return NextResponse.json({ error: 'Falten camps o accó invàlida' }, { status: 400 })
    }

    const { supabase } = auth

    // Fetch the request with worker profile
    const { data: absenceRequest, error: fetchError } = await supabase
      .from('absence_requests')
      .select('*, profiles!absence_requests_user_id_fkey(id, full_name, email, email_notifications)')
      .eq('id', requestId)
      .single()

    if (fetchError || !absenceRequest) {
      return NextResponse.json({ error: 'Sol·licitud no trobada' }, { status: 404 })
    }

    if (absenceRequest.status !== 'pending') {
      return NextResponse.json({ error: 'Aquesta sol·licitud ja ha estat processada' }, { status: 400 })
    }

    // Update status
    const { error: updateError } = await supabase
      .from('absence_requests')
      .update({
        status: action,
        admin_note: adminNote || null,
        approved_by: auth.user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', requestId)

    if (updateError) throw updateError

    const workingDays = absenceRequest.working_days
    const year = new Date(absenceRequest.start_date).getFullYear()

    // Update balance
    const { data: balance } = await supabase
      .from('vacation_balances')
      .select('used_days, pending_days')
      .eq('user_id', absenceRequest.user_id)
      .eq('year', year)
      .single()

    if (balance) {
      if (action === 'approved') {
        await supabase
          .from('vacation_balances')
          .update({
            used_days: (balance.used_days || 0) + workingDays,
            pending_days: Math.max(0, (balance.pending_days || 0) - workingDays),
          })
          .eq('user_id', absenceRequest.user_id)
          .eq('year', year)
      } else {
        // rejected: just remove from pending
        await supabase
          .from('vacation_balances')
          .update({
            pending_days: Math.max(0, (balance.pending_days || 0) - workingDays),
          })
          .eq('user_id', absenceRequest.user_id)
          .eq('year', year)
      }
    }

    // Audit log
    await supabase.rpc('log_audit', {
      p_action: action === 'approved' ? 'approve_vacation' : 'reject_vacation',
      p_entity_type: 'absence_request',
      p_entity_id: requestId,
      p_new_values: { action, adminNote, approvedBy: auth.user.id },
    })

    // In-app notification to worker
    const profile = Array.isArray(absenceRequest.profiles)
      ? absenceRequest.profiles[0]
      : absenceRequest.profiles

    if (profile) {
      const approved = action === 'approved'
      await notifyUser(absenceRequest.user_id, {
        title: approved ? 'Vacances aprovades ✅' : 'Vacances rebutjades',
        body: approved
          ? `Les teves vacances del ${absenceRequest.start_date} al ${absenceRequest.end_date} han estat aprovades.${adminNote ? ` Nota: ${adminNote}` : ''}`
          : `Les teves vacances del ${absenceRequest.start_date} al ${absenceRequest.end_date} han estat rebutjades.${adminNote ? ` Motiu: ${adminNote}` : ''}`,
        type: approved ? 'vacation_approved' : 'vacation_rejected',
        link: '/worker/vacances',
        metadata: { requestId, action, adminNote },
      })

      // Email (optional, non-blocking)
      if (profile.email && (profile as any).email_notifications !== false) {
        sendEmail(emailVacancesDecisio({
          workerEmail: profile.email,
          workerName: profile.full_name,
          approved: action === 'approved',
          startDate: absenceRequest.start_date,
          endDate: absenceRequest.end_date,
          workingDays,
          adminNote: adminNote || null,
        })).catch(err => console.error('[email]', err))
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[vacances/approve]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconegut' },
      { status: 500 }
    )
  }
}
