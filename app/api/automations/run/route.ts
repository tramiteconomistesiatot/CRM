export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticat' }, { status: 401 })

  const results = {
    notifications_created: 0,
    errors: [] as string[],
  }

  try {
    const { data: automations } = await supabase
      .from('automations')
      .select('*')
      .eq('active', true)

    if (!automations) return NextResponse.json(results)

    for (const automation of automations) {

      // 1. Clients sense contacte
      if (automation.trigger_type === 'days_without_contact' && automation.trigger_value) {
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - automation.trigger_value)

        const { data: staleClients } = await supabase
          .from('clients')
          .select('id, name, responsible_id')
          .eq('status', 'active')
          .lt('last_contact_at', cutoffDate.toISOString())
          .not('responsible_id', 'is', null)

        for (const client of staleClients || []) {
          // Verificar si ja s'ha enviat aquesta notificació avui
          const today = new Date().toISOString().split('T')[0]
          const { data: existing } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', client.responsible_id!)
            .ilike('body', `%${client.id}%`)
            .gte('created_at', today)
            .single()

          if (!existing) {
            const config = automation.action_config as { title: string; body: string }
            await supabase.from('notifications').insert({
              user_id: client.responsible_id,
              title: config.title,
              body: config.body
                .replace('{client_name}', client.name)
                .replace('{days}', automation.trigger_value!.toString())
                + ` [client_id:${client.id}]`,
              type: 'automation',
              read: false,
            })
            results.notifications_created++
          }
        }
      }

      // 2. Recordatoris de cita
      if (automation.trigger_type === 'appointment_reminder' && automation.trigger_value) {
        const futureTime = new Date()
        futureTime.setHours(futureTime.getHours() + automation.trigger_value)
        const windowStart = new Date(futureTime.getTime() - 15 * 60 * 1000)
        const windowEnd = new Date(futureTime.getTime() + 15 * 60 * 1000)

        const { data: upcomingApts } = await supabase
          .from('appointments')
          .select('*, clients(name), profiles!appointments_main_attendee_id_fkey(id)')
          .gte('start_time', windowStart.toISOString())
          .lte('start_time', windowEnd.toISOString())
          .eq('status', 'confirmed')

        for (const apt of upcomingApts || []) {
          const attendeeId = (apt.profiles as { id: string } | null)?.id
          if (!attendeeId) continue

          const config = automation.action_config as { title: string; body: string }
          const startTime = new Date(apt.start_time).toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' })
          const clientName = (apt.clients as { name: string } | null)?.name || 'sense client'

          await supabase.from('notifications').insert({
            user_id: attendeeId,
            title: config.title,
            body: config.body
              .replace('{time}', startTime)
              .replace('{client_name}', clientName),
            type: 'appointment',
            read: false,
          })
          results.notifications_created++
        }
      }

      // 3. Tasques vençudes
      if (automation.trigger_type === 'task_overdue') {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)

        const { data: overdueTasks } = await supabase
          .from('tasks')
          .select('id, title, assigned_to')
          .lt('due_date', new Date().toISOString().split('T')[0])
          .neq('status', 'done')
          .not('assigned_to', 'is', null)

        for (const task of overdueTasks || []) {
          const today = new Date().toISOString().split('T')[0]
          const { data: existing } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', task.assigned_to!)
            .ilike('body', `%${task.id}%`)
            .gte('created_at', today)
            .single()

          if (!existing) {
            const config = automation.action_config as { title: string; body: string }
            await supabase.from('notifications').insert({
              user_id: task.assigned_to,
              title: config.title,
              body: config.body.replace('{task_title}', task.title) + ` [task_id:${task.id}]`,
              type: 'task',
              read: false,
            })
            results.notifications_created++
          }
        }
      }

      // 4. Pressupostos per vèncer
      if (automation.trigger_type === 'quote_expiring' && automation.trigger_value) {
        const targetDate = new Date()
        targetDate.setDate(targetDate.getDate() + automation.trigger_value)
        const dateStr = targetDate.toISOString().split('T')[0]

        const { data: expiringQuotes } = await supabase
          .from('quotes')
          .select('id, number, title, created_by')
          .eq('valid_until', dateStr)
          .eq('status', 'sent')

        for (const quote of expiringQuotes || []) {
          const config = automation.action_config as { title: string; body: string }
          await supabase.from('notifications').insert({
            user_id: quote.created_by,
            title: config.title,
            body: config.body
              .replace('{quote_number}', quote.number)
              .replace('{days}', automation.trigger_value!.toString()),
            type: 'automation',
            read: false,
          })
          results.notifications_created++
        }
      }
    }

  } catch (error) {
    results.errors.push(error instanceof Error ? error.message : 'Error desconegut')
  }

  return NextResponse.json(results)
}
