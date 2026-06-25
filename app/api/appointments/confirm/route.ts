export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/utils/auth-guard'
import { createServiceClient } from '@/lib/supabase/server'
import { notifyUser } from '@/lib/utils/notify'
import { sendEmail, emailCitaConfirmada } from '@/lib/resend'

export async function POST(request: Request) {
  const auth = await requireAuth()
  if ('error' in auth) return auth.error

  try {
    const { appointmentId, action, proposedTime, reason } = await request.json()
    // action: 'confirm' | 'reject'

    if (!appointmentId || !action || !['confirm', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Falten camps o acció invàlida' }, { status: 400 })
    }

    const { user, profile } = auth
    const supabase = createServiceClient()

    // Fetch appointment
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select('*, main_attendee_profile:profiles!appointments_main_attendee_id_fkey(id, full_name, email), created_by_profile:profiles!appointments_created_by_fkey(id, full_name, email, email_notifications)')
      .eq('id', appointmentId)
      .single()

    if (fetchError || !appointment) {
      return NextResponse.json({ error: 'Cita no trobada' }, { status: 404 })
    }

    // Fetch all attendees
    const { data: attendees } = await supabase
      .from('appointment_attendees')
      .select('user_id, status, profiles(full_name, email)')
      .eq('appointment_id', appointmentId)

    // Check permissions: creator, main attendee, convocated attendee, or admin/supervisor
    const isAdmin = profile.role === 'admin' || profile.role === 'supervisor'
    const isCreator = appointment.created_by === user.id
    const isMain = appointment.main_attendee_id === user.id
    const isAttendee = attendees?.some(a => a.user_id === user.id)

    if (!isCreator && !isMain && !isAttendee && !isAdmin) {
      return NextResponse.json({ error: 'No tens permís per gestionar aquesta cita' }, { status: 403 })
    }

    if (action === 'confirm' && isCreator) {
      return NextResponse.json({ error: 'No pots confirmar una cita que has convocat tu mateix. Ha de ser acceptada per les altres parts convocades.' }, { status: 403 })
    }

    const newStatus = action === 'confirm' ? 'confirmed' : 'rejected'

    // Update appointment notes if cancelled with a reason
    let updatedNotes = appointment.internal_notes || ''
    if (action === 'reject' && reason) {
      updatedNotes = `[Motiu cancel·lació per ${profile.full_name}: ${reason}] ${updatedNotes}`.trim()
    }

    // Update appointment status
    await supabase
      .from('appointments')
      .update({
        status: newStatus,
        internal_notes: updatedNotes || null,
      })
      .eq('id', appointmentId)

    // Update attendee record
    await supabase
      .from('appointment_attendees')
      .update({
        status: action === 'confirm' ? 'accepted' : 'rejected',
        ...(proposedTime ? { proposed_time: proposedTime } : {}),
      })
      .eq('appointment_id', appointmentId)
      .eq('user_id', user.id)

    // Sincronització de l'estat amb Google Calendar
    if (appointment.google_event_id) {
      try {
        const { updateCalendarEvent, deleteCalendarEvent } = await import('@/lib/google/calendar')
        if (action === 'reject') {
          await deleteCalendarEvent(appointment.google_event_id)
        } else if (action === 'confirm') {
          await updateCalendarEvent(appointment.google_event_id, {
            summary: appointment.topic,
            start: { dateTime: appointment.start_time },
            end: { dateTime: appointment.end_time },
            status: 'confirmed'
          })
        }
      } catch (gErr) {
        console.error('[appointments/confirm] Google Calendar update error:', gErr)
      }
    }

    // Topic and formatting details

    const topicLabels: Record<string, string> = {
      fiscal: 'Fiscal', labor: 'Laboral', accounting: 'Comptable',
      income_tax: 'Renda', freelance: 'Autònoms', companies: 'Societats',
      internal_meeting: 'Reunió interna', client_query: 'Consulta client',
      documentation: 'Documentació', other: 'Altre',
    }
    const topicLabel = topicLabels[appointment.topic] || appointment.topic
    const startFormatted = new Date(appointment.start_time).toLocaleString('ca-ES', { dateStyle: 'full', timeStyle: 'short' })

    // Notify creator and all other attendees
    const peopleToNotify = new Set<string>()
    if (appointment.created_by !== user.id) peopleToNotify.add(appointment.created_by)
    attendees?.forEach(a => { if (a.user_id && a.user_id !== user.id) peopleToNotify.add(a.user_id) })

    const notifTitle = action === 'confirm'
      ? `Cita confirmada ✅`
      : `Cita cancel·lada/rebutjada ❌`
    const notifBody = action === 'confirm'
      ? `${profile.full_name} ha confirmat la cita de ${topicLabel} del ${startFormatted}.`
      : `${profile.full_name} ha rebutjat/cancel·lat la cita de ${topicLabel} del ${startFormatted}.${reason ? ` Motiu: ${reason}` : ''}`

    await Promise.all(
      Array.from(peopleToNotify).map(uid =>
        notifyUser(uid, {
          title: notifTitle,
          body: notifBody,
          type: action === 'confirm' ? 'appointment_confirmed' : 'appointment_rejected',
          link: '/dashboard/agenda',
          metadata: { appointmentId, action },
        })
      )
    )

    // Email to creator (non-blocking)
    const creatorProfiles = Array.isArray(appointment.created_by_profile)
      ? appointment.created_by_profile[0]
      : appointment.created_by_profile

    if (creatorProfiles?.email && (creatorProfiles as any).email_notifications !== false && action === 'confirm') {
      sendEmail(emailCitaConfirmada({
        recipientEmail: creatorProfiles.email,
        recipientName: creatorProfiles.full_name,
        confirmedByName: profile.full_name,
        topic: topicLabel,
        startTime: startFormatted,
      })).catch(err => console.error('[email confirm]', err))
    }

    return NextResponse.json({ success: true, status: newStatus })
  } catch (error) {
    console.error('[appointments/confirm]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconegut' },
      { status: 500 }
    )
  }
}
