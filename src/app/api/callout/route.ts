import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { supabaseAdmin } from '../../lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const authHeader = req.headers.get('authorization') || ''
  const accessToken = authHeader.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken)
  if (userError || !userData.user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const userId = userData.user.id

  const { shiftId, shiftDate, startTime, endTime, calledOutEmployeeId, eligibleEmployeeIds } = await req.json()

  // Mark shift as called_out
  if (shiftId) {
    await supabaseAdmin
      .from('shifts')
      .update({ status: 'called_out' })
      .eq('id', shiftId)
      .eq('user_id', userId)
  }

  if (!eligibleEmployeeIds?.length) {
    return NextResponse.json({ success: true, sent: 0 })
  }

  // Get eligible employees with emails
  const { data: employees } = await supabaseAdmin
    .from('employees')
    .select('id, name, email')
    .eq('user_id', userId)
    .in('id', eligibleEmployeeIds)
    .neq('email', '')

  // Get called-out employee name for the message
  const { data: calledOut } = calledOutEmployeeId
    ? await supabaseAdmin.from('employees').select('name').eq('id', calledOutEmployeeId).single()
    : { data: null }

  const emailList = (employees || []).filter(e => e.email)

  const shiftLabel = `${formatDate(shiftDate)} from ${formatTime(startTime)} to ${formatTime(endTime)}`

  if (emailList.length > 0) {
    await Promise.allSettled(
      emailList.map(emp =>
        resend.emails.send({
          from: 'Helpdesk <onboarding@resend.dev>',
          to: emp.email,
          subject: `Shift coverage needed — ${shiftLabel}`,
          html: `
            <p>Hi ${emp.name.split(' ')[0]},</p>
            <p>We have an open shift that needs coverage:</p>
            <p><strong>${shiftLabel}</strong>${calledOut ? ` (${calledOut.name} is unavailable)` : ''}</p>
            <p>If you're available to cover this shift, please reply to this email or contact your manager directly.</p>
            <p>First to confirm gets the shift.</p>
          `,
        })
      )
    )
  }

  return NextResponse.json({ success: true, sent: emailList.length })
}

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function formatTime(t: string) {
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m} ${hour < 12 ? 'AM' : 'PM'}`
}
