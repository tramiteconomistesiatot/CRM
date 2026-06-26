export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/resend'
import { sendTelegramMessage } from '@/lib/utils/telegram'

// Helper to calculate timezone offsets and dates for Europe/Madrid (Spain)
function getOffsetString(timeZone: string, date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset'
  }).formatToParts(date)
  const offsetPart = parts.find(p => p.type === 'timeZoneName')
  const val = offsetPart ? offsetPart.value : 'GMT'
  if (val === 'GMT') return '+00:00'
  const clean = val.replace('GMT', '')
  if (clean.includes(':')) return clean
  const sign = clean[0]
  const num = parseInt(clean.slice(1))
  return `${sign}${String(num).padStart(2, '0')}:00`
}

function getLocalDayRange(date: Date) {
  const dateStr = new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date)
  
  const tzOffset = getOffsetString('Europe/Madrid', date)
  const start = `${dateStr}T00:00:00${tzOffset}`
  const end = `${dateStr}T23:59:59${tzOffset}`
  return { start, end, dateStr }
}

function getLocalWeekRange(date: Date) {
  const day = date.getDay() // 0 = Sun, 1 = Mon...
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(date)
  monday.setDate(diff)
  
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  
  const mondayStr = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(monday)
  const sundayStr = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(sunday)
  
  const startOffset = getOffsetString('Europe/Madrid', monday)
  const endOffset = getOffsetString('Europe/Madrid', sunday)
  
  const start = `${mondayStr}T00:00:00${startOffset}`
  const end = `${sundayStr}T23:59:59${endOffset}`
  return { start, end, mondayStr, sundayStr }
}

const CHANNEL_LABELS: Record<string, string> = {
  in_person: '🏢 Presencial (despatx)',
  phone: '📞 Telèfon',
  video: '💻 Videotrucada (Meet)',
  email: '✉️ Email',
  other: '🌐 Altre'
}

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baixa',
  normal: 'Normal',
  high: 'Alta ⚠️',
  urgent: 'URGENT 🚨'
}

export async function GET(request: Request) {
  // Authorization check (in production)
  const authHeader = request.headers.get('authorization')
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autoritzat' }, { status: 401 })
  }

  const supabase = createServiceClient()
  
  // Time setup relative to Europe/Madrid
  const now = new Date()
  const madridTime = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Madrid' }).format(now)
  const todayLocal = new Date(madridTime)
  const isMonday = todayLocal.getDay() === 1

  const { start: startToday, end: endToday, dateStr: dateStrToday } = getLocalDayRange(now)
  const { start: startWeek, end: endWeek, mondayStr, sundayStr } = getLocalWeekRange(now)

  const logs: string[] = []

  try {
    // 1. Fetch active admins & supervisors
    const { data: admins, error: adminsErr } = await supabase
      .from('profiles')
      .select('id, email, full_name, telegram_chat_id, email_notifications')
      .in('role', ['admin', 'supervisor'])
      .eq('active', true)

    if (adminsErr || !admins || admins.length === 0) {
      return NextResponse.json({ success: false, error: 'No s\'han trobat administradors actius' })
    }

    // 2. Fetch today's appointments and tasks
    const { data: apptsToday } = await supabase
      .from('appointments')
      .select('*, client:clients(name, company), attendee:profiles!appointments_main_attendee_id_fkey(full_name)')
      .gte('start_time', startToday)
      .lte('start_time', endToday)
      .in('status', ['confirmed', 'pending'])
      .order('start_time', { ascending: true })

    const { data: tasksToday } = await supabase
      .from('tasks')
      .select('*, client:clients(name), assignee:profiles!tasks_assigned_to_fkey(full_name)')
      .eq('due_date', dateStrToday)
      .neq('status', 'done')
      .order('priority', { ascending: false })

    // Build Daily Summary Email & Telegram content
    const todayFormatted = new Date(now).toLocaleDateString('ca-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    
    // --- DAILY SUMMARY CONTENT ---
    let dailyEmailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
        <h2 style="color: #1e3a8a; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">📅 Resum del dia: ${todayFormatted}</h2>
        <p>Hola! Aquest és el resum del que hi ha programat per a avui a <strong>Tràmit Economistes</strong>.</p>
        
        <h3 style="color: #2563eb; margin-top: 24px;">📅 Cites i Reunions d'Avui</h3>
    `

    if (!apptsToday || apptsToday.length === 0) {
      dailyEmailHtml += `<p style="color: #64748b; font-style: italic;">No hi ha reunions programades per avui.</p>`
    } else {
      dailyEmailHtml += `<table style="width:100%; border-collapse:collapse; margin-bottom:16px;">`
      for (const apt of apptsToday) {
        const clientName = apt.client ? `${apt.client.name} ${apt.client.company ? `(${apt.client.company})` : ''}` : 'Sense client'
        const channelLabel = CHANNEL_LABELS[apt.channel] || apt.channel
        const timeStr = new Date(apt.start_time).toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })
        const isPresencial = apt.channel === 'in_person'
        
        dailyEmailHtml += `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 8px; font-weight: bold; width: 60px;">${timeStr}</td>
            <td style="padding: 10px 8px;">
              <span style="font-weight: 600; color: #0f172a;">${apt.topic.toUpperCase()}</span> - Assistent: <strong>${apt.attendee?.full_name || 'No assignat'}</strong><br/>
              <span style="font-size: 0.85rem; color: #475569;">Client: ${clientName}</span>
            </td>
            <td style="padding: 10px 8px; text-align: right;">
              <span style="font-size: 0.85rem; padding: 4px 8px; border-radius: 4px; background-color: ${isPresencial ? '#dbeafe' : '#f1f5f9'}; color: ${isPresencial ? '#1e40af' : '#475569'}; font-weight: ${isPresencial ? 'bold' : 'normal'};">
                ${channelLabel}
              </span>
            </td>
          </tr>
        `
      }
      dailyEmailHtml += `</table>`
    }

    dailyEmailHtml += `<h3 style="color: #2563eb; margin-top: 24px;">📝 Tasques amb venciment Avui</h3>`
    if (!tasksToday || tasksToday.length === 0) {
      dailyEmailHtml += `<p style="color: #64748b; font-style: italic;">No hi ha tasques pendents amb venciment per avui.</p>`
    } else {
      dailyEmailHtml += `<table style="width:100%; border-collapse:collapse; margin-bottom:16px;">`
      for (const task of tasksToday) {
        const priorityLabel = PRIORITY_LABELS[task.priority] || task.priority
        const assigneeName = task.assignee?.full_name || 'Sense assignar'
        const clientLabel = task.client ? ` (Client: ${task.client.name})` : ''
        
        dailyEmailHtml += `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 8px;">
              <span style="font-weight: 600; color: #0f172a;">${task.title}</span>${clientLabel}<br/>
              <span style="font-size: 0.85rem; color: #475569;">Responsable: ${assigneeName}</span>
            </td>
            <td style="padding: 10px 8px; text-align: right;">
              <span style="font-size: 0.85rem; font-weight: bold; color: ${task.priority === 'urgent' || task.priority === 'high' ? '#dc2626' : '#475569'};">
                ${priorityLabel}
              </span>
            </td>
          </tr>
        `
      }
      dailyEmailHtml += `</table>`
    }

    dailyEmailHtml += `
        <div style="margin-top: 32px; font-size: 0.8rem; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 16px;">
          Tràmit Economistes — Resum Automàtic Diari
        </div>
      </div>
    `

    // Build Telegram Daily Text
    let dailyTelegramText = `📅 *RESUM DIARI - ${todayFormatted.toUpperCase()}*\n\n`
    dailyTelegramText += `👥 *Cites i Reunions d'Avui:*\n`
    if (!apptsToday || apptsToday.length === 0) {
      dailyTelegramText += `_No hi ha reunions programades._\n`
    } else {
      for (const apt of apptsToday) {
        const timeStr = new Date(apt.start_time).toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })
        const clientName = apt.client ? apt.client.name : 'Sense client'
        const channelIcon = apt.channel === 'in_person' ? '🏢' : apt.channel === 'phone' ? '📞' : '💻'
        dailyTelegramText += `• *${timeStr}* | ${apt.topic.toUpperCase()} (${channelIcon})\n  👤 Assistent: ${apt.attendee?.full_name || 'N/A'}\n  💼 Client: ${clientName}\n\n`
      }
    }

    dailyTelegramText += `📝 *Tasques per a Avui:*\n`
    if (!tasksToday || tasksToday.length === 0) {
      dailyTelegramText += `_No hi ha tasques per a avui._\n`
    } else {
      for (const task of tasksToday) {
        const priorityIcon = task.priority === 'urgent' ? '🚨' : task.priority === 'high' ? '⚠️' : '▪️'
        dailyTelegramText += `${priorityIcon} *${task.title}*\n  👤 Resp: ${task.assignee?.full_name || 'N/A'}${task.client ? ` | Client: ${task.client.name}` : ''}\n`
      }
    }

    // 3. WEEKLY SUMMARY (only on Monday)
    let weeklyEmailHtml = ''
    let weeklyTelegramText = ''
    let apptsWeek: any[] = []
    let tasksWeek: any[] = []

    if (isMonday) {
      const { data: rawAppts } = await supabase
        .from('appointments')
        .select('*, client:clients(name, company), attendee:profiles!appointments_main_attendee_id_fkey(full_name)')
        .gte('start_time', startWeek)
        .lte('start_time', endWeek)
        .in('status', ['confirmed', 'pending'])
        .order('start_time', { ascending: true })
      
      const { data: rawTasks } = await supabase
        .from('tasks')
        .select('*, client:clients(name), assignee:profiles!tasks_assigned_to_fkey(full_name)')
        .gte('due_date', mondayStr)
        .lte('due_date', sundayStr)
        .neq('status', 'done')
        .order('due_date', { ascending: true })

      apptsWeek = rawAppts || []
      tasksWeek = rawTasks || []

      weeklyEmailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
          <h2 style="color: #1e3a8a; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">📅 Planificació de la Setmana (${mondayStr} al ${sundayStr})</h2>
          <p>Bon dilluns! Aquest és el resum setmanal de previsions per a <strong>Tràmit Economistes</strong>.</p>
          
          <h3 style="color: #2563eb; margin-top: 24px;">📅 Reunions i Cites de la Setmana</h3>
      `

      if (apptsWeek.length === 0) {
        weeklyEmailHtml += `<p style="color: #64748b; font-style: italic;">No hi ha reunions programades per a aquesta setmana.</p>`
      } else {
        weeklyEmailHtml += `<table style="width:100%; border-collapse:collapse; margin-bottom:16px;">`
        for (const apt of apptsWeek) {
          const clientName = apt.client ? `${apt.client.name}` : 'Sense client'
          const dateStr = new Date(apt.start_time).toLocaleDateString('ca-ES', { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'Europe/Madrid' })
          const timeStr = new Date(apt.start_time).toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })
          const channelLabel = CHANNEL_LABELS[apt.channel] || apt.channel
          
          weeklyEmailHtml += `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 8px; width: 100px;"><strong>${dateStr}</strong><br/><span style="font-size: 0.85rem; color:#64748b;">${timeStr}</span></td>
              <td style="padding: 10px 8px;">
                <span style="font-weight: 600; color: #0f172a;">${apt.topic.toUpperCase()}</span> - Assistent: ${apt.attendee?.full_name || 'N/A'}<br/>
                <span style="font-size: 0.85rem; color: #475569;">Client: ${clientName}</span>
              </td>
              <td style="padding: 10px 8px; text-align: right;">
                <span style="font-size: 0.8rem; color: #64748b;">${channelLabel}</span>
              </td>
            </tr>
          `
        }
        weeklyEmailHtml += `</table>`
      }

      weeklyEmailHtml += `<h3 style="color: #2563eb; margin-top: 24px;">📝 Tasques amb venciment aquesta Setmana</h3>`
      if (tasksWeek.length === 0) {
        weeklyEmailHtml += `<p style="color: #64748b; font-style: italic;">No hi ha tasques pendents amb venciment per a aquesta setmana.</p>`
      } else {
        weeklyEmailHtml += `<table style="width:100%; border-collapse:collapse; margin-bottom:16px;">`
        for (const task of tasksWeek) {
          const tDate = new Date(task.due_date).toLocaleDateString('ca-ES', { weekday: 'short', day: 'numeric', month: 'numeric' })
          const priorityLabel = PRIORITY_LABELS[task.priority] || task.priority
          
          weeklyEmailHtml += `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 8px; width: 80px;"><strong>${tDate}</strong></td>
              <td style="padding: 10px 8px;">
                <span style="font-weight: 600; color: #0f172a;">${task.title}</span><br/>
                <span style="font-size: 0.85rem; color: #475569;">Responsable: ${task.assignee?.full_name || 'N/A'}</span>
              </td>
              <td style="padding: 10px 8px; text-align: right;">
                <span style="font-size: 0.85rem; font-weight: bold; color: ${task.priority === 'urgent' || task.priority === 'high' ? '#dc2626' : '#475569'};">
                  ${priorityLabel}
                </span>
              </td>
            </tr>
          `
        }
        weeklyEmailHtml += `</table>`
      }

      weeklyEmailHtml += `
          <div style="margin-top: 32px; font-size: 0.8rem; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 16px;">
            Tràmit Economistes — Planificació Setmanal Automàtica
          </div>
        </div>
      `

      // Build Telegram Weekly Text
      weeklyTelegramText = `📅 *RESUM SETMANAL - PLANIFICACIÓ*\nSetmana del ${mondayStr} al ${sundayStr}\n\n`
      weeklyTelegramText += `👥 *Previsions de Reunions:*\n`
      if (apptsWeek.length === 0) {
        weeklyTelegramText += `_No hi ha reunions._\n`
      } else {
        for (const apt of apptsWeek) {
          const dateStr = new Date(apt.start_time).toLocaleDateString('ca-ES', { weekday: 'short', day: 'numeric', timeZone: 'Europe/Madrid' })
          const timeStr = new Date(apt.start_time).toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })
          weeklyTelegramText += `• *${dateStr}* (${timeStr}) | *${apt.topic.toUpperCase()}*\n  Assistent: ${apt.attendee?.full_name || 'N/A'} | Client: ${apt.client?.name || 'N/A'}\n`
        }
      }

      weeklyTelegramText += `\n📝 *Tasques d'aquesta Setmana:*\n`
      if (tasksWeek.length === 0) {
        weeklyTelegramText += `_No hi ha tasques pendents._\n`
      } else {
        for (const task of tasksWeek) {
          const tDate = new Date(task.due_date).toLocaleDateString('ca-ES', { weekday: 'short', day: 'numeric' })
          weeklyTelegramText += `• *${tDate}* | ${task.title} (Resp: ${task.assignee?.full_name || 'N/A'})\n`
        }
      }
    }

    // 4. Send summaries to each admin
    for (const admin of admins) {
      // Send Daily Summary
      if (admin.email && admin.email_notifications !== false) {
        await sendEmail({
          to: admin.email,
          subject: `📅 Resum Diari: Cites, Visites i Tasques de Avui — Tràmit Economistes`,
          html: dailyEmailHtml
        }).then(res => {
          if (res.success) logs.push(`Email diari enviat correctament a ${admin.email}`)
          else logs.push(`Error enviant email diari a ${admin.email}: ${res.error}`)
        }).catch(err => logs.push(`Error de xarxa enviant email a ${admin.email}: ${err.message}`))
      }

      if (admin.telegram_chat_id) {
        const tgOk = await sendTelegramMessage(admin.telegram_chat_id, dailyTelegramText)
        if (tgOk) logs.push(`Telegram diari enviat correctament a ${admin.full_name}`)
        else logs.push(`Error enviant Telegram diari a ${admin.full_name}`)
      }

      // Send Weekly Summary (on Monday)
      if (isMonday) {
        if (admin.email && admin.email_notifications !== false) {
          await sendEmail({
            to: admin.email,
            subject: `📅 Planificació Setmanal: Resum de la Setmana — Tràmit Economistes`,
            html: weeklyEmailHtml
          }).then(res => {
            if (res.success) logs.push(`Email setmanal enviat correctament a ${admin.email}`)
            else logs.push(`Error enviant email setmanal a ${admin.email}: ${res.error}`)
          }).catch(err => logs.push(`Error de xarxa enviant email a ${admin.email}: ${err.message}`))
        }

        if (admin.telegram_chat_id) {
          const tgOk = await sendTelegramMessage(admin.telegram_chat_id, weeklyTelegramText)
          if (tgOk) logs.push(`Telegram setmanal enviat correctament a ${admin.full_name}`)
          else logs.push(`Error enviant Telegram setmanal a ${admin.full_name}`)
        }
      }
    }

    return NextResponse.json({ success: true, isMonday, logs })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconegut'
    }, { status: 500 })
  }
}
