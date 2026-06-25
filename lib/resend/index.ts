/**
 * Integració Resend per a emails transaccionals.
 * Si RESEND_API_KEY no està configurat, les funcions retornen sense error
 * (les notificacions es fan via la taula notifications de Supabase).
 */

interface EmailPayload {
  to: string | string[]
  subject: string
  html: string
}

export async function sendEmail(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@tramiteconomistes.com'

  if (!apiKey) {
    console.log('[resend] RESEND_API_KEY no configurat. Email no enviat:', payload.subject)
    return { success: false, error: 'Email no configurat' }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: Array.isArray(payload.to) ? payload.to : [payload.to],
        subject: payload.subject,
        html: payload.html,
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error('[resend] Error enviant email:', err)
      return { success: false, error: err }
    }
    return { success: true }
  } catch (err) {
    console.error('[resend] Error de xarxa:', err)
    return { success: false, error: 'Error de xarxa' }
  }
}

// ─── Plantilles d'email ─────────────────────────────────────

export function emailVacancesDecisio(params: {
  workerEmail: string
  workerName: string
  approved: boolean
  startDate: string
  endDate: string
  workingDays: number
  adminNote?: string | null
}): EmailPayload {
  const status = params.approved ? 'APROVADA ✅' : 'REBUTJADA ❌'
  const color = params.approved ? '#16a34a' : '#dc2626'
  return {
    to: params.workerEmail,
    subject: `Sol·licitud de vacances ${status} — Tràmit Economistes`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: ${color};">Sol·licitud de vacances ${status}</h2>
        <p>Hola, <strong>${params.workerName}</strong>!</p>
        <p>La teva sol·licitud de vacances ha estat <strong>${params.approved ? 'aprovada' : 'rebutjada'}</strong>.</p>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Del</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${params.startDate}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Al</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${params.endDate}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Dies laborables</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${params.workingDays}</td></tr>
        </table>
        ${params.adminNote ? `<p><strong>Nota de la administració:</strong> ${params.adminNote}</p>` : ''}
        <p style="color: #6b7280; font-size: 0.875rem;">Tràmit Economistes — App interna</p>
      </div>
    `,
  }
}

export function emailCitaAssignada(params: {
  workerEmail: string
  workerName: string
  appointmentId: string
  topic: string
  startTime: string
  clientName?: string | null
  createdByName: string
}): EmailPayload {
  return {
    to: params.workerEmail,
    subject: `Nova cita assignada: ${params.topic} — Tràmit Economistes`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Nova cita assignada 📅</h2>
        <p>Hola, <strong>${params.workerName}</strong>!</p>
        <p>${params.createdByName} t'ha assignat una nova cita que requereix la teva confirmació.</p>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Tema</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${params.topic}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Data i hora</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${params.startTime}</td></tr>
          ${params.clientName ? `<tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Client</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${params.clientName}</td></tr>` : ''}
        </table>
        <p>Accedeix a l'app per acceptar o rebutjar la cita.</p>
        <p style="color: #6b7280; font-size: 0.875rem;">Tràmit Economistes — App interna</p>
      </div>
    `,
  }
}

export function emailCitaConfirmada(params: {
  recipientEmail: string
  recipientName: string
  confirmedByName: string
  topic: string
  startTime: string
}): EmailPayload {
  return {
    to: params.recipientEmail,
    subject: `Cita confirmada: ${params.topic} — Tràmit Economistes`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #16a34a;">Cita confirmada ✅</h2>
        <p>Hola, <strong>${params.recipientName}</strong>!</p>
        <p><strong>${params.confirmedByName}</strong> ha confirmat la cita de ${params.topic} prevista per al ${params.startTime}.</p>
        <p style="color: #6b7280; font-size: 0.875rem;">Tràmit Economistes — App interna</p>
      </div>
    `,
  }
}

export function emailBenvinguda(params: {
  workerEmail: string
  workerName: string
  password?: string
  appUrl: string
}): EmailPayload {
  return {
    to: params.workerEmail,
    subject: `Benvingut/da a Tràmit Economistes! 🚀`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Benvingut/da, ${params.workerName}!</h2>
        <p>S'ha creat el teu compte per a l'aplicació interna de gestió de Tràmit Economistes.</p>
        <p>Les teves credencials d'accés són:</p>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Email</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${params.workerEmail}</td></tr>
          ${params.password ? `<tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Contrasenya temporal</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${params.password}</td></tr>` : ''}
        </table>
        <p>Pots accedir a l'aplicació des de la següent adreça:</p>
        <p><a href="${params.appUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Accedir a l'App</a></p>
        <p style="color: #6b7280; font-size: 0.875rem;">Et recomanem canviar la teva contrasenya des de la secció del teu perfil un cop hagis entrat.</p>
        <p style="color: #6b7280; font-size: 0.875rem;">Tràmit Economistes — App interna</p>
      </div>
    `,
  }
}

