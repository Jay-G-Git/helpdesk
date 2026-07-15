import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'

// Vercel Cron target — see vercel.json ("0 14 * * *", once daily). Vercel's Hobby plan
// caps cron jobs at once-per-day (hourly fails deployment outright), so this runs once
// a day rather than the originally-planned hourly check. Not user-triggered, so auth is
// a shared secret (CRON_SECRET env var) instead of a bearer user token.
//
// Window: interviews starting 24-48h from now. Widened from the original 24-25h design
// to match the daily (not hourly) cadence — since the job only fires once a day, the
// window has to be as wide as the gap between runs so every interview_at falls into it
// exactly once. No "already sent" tracking needed — zero new tables, per the issue's
// own validation gut-check. If a run is missed, that one reminder is simply skipped
// rather than sent late/duplicated. Net effect: reminder lands 1-2 days out instead of
// a tight T-24h, which is the tradeoff for staying on Hobby's cron limits.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = Date.now()
  const windowStart = new Date(now + 24 * 3600000).toISOString()
  const windowEnd = new Date(now + 48 * 3600000).toISOString()

  const { data: applications, error } = await supabaseAdmin
    .from('job_applications')
    .select('id, name, email, user_id, job_posting_id, interview_at')
    .not('interview_at', 'is', null)
    .gte('interview_at', windowStart)
    .lt('interview_at', windowEnd)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!applications?.length) return NextResponse.json({ sent: 0 })

  const resend = new Resend(process.env.RESEND_API_KEY)
  let sent = 0

  for (const app of applications) {
    const [{ data: job }, { data: profile }] = await Promise.all([
      supabaseAdmin.from('job_postings').select('title, location').eq('id', app.job_posting_id).single(),
      supabaseAdmin.from('business_profiles').select('business_name, contact_email').eq('user_id', app.user_id).single(),
    ])

    const jobTitle = job?.title ?? 'the role'
    const businessName = profile?.business_name || 'the team'
    const when = new Date(app.interview_at)
    const dateLabel = when.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    const timeLabel = when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    const locationLine = job?.location ? `<p>📍 ${job.location}</p>` : ''
    // "tomorrow" vs "in N days" — the 24-48h window means this isn't always literally
    // tomorrow, so phrase it off the actual day count instead of hardcoding "tomorrow".
    const daysOut = Math.round((when.getTime() - now) / 86400000)
    const whenPhrase = daysOut <= 1 ? 'tomorrow' : `in ${daysOut} days`

    const results = await Promise.allSettled([
      app.email
        ? resend.emails.send({
            from: 'Helpdesk <onboarding@resend.dev>',
            to: app.email,
            subject: `Reminder: your interview ${whenPhrase} at ${timeLabel}`,
            html: `
              <p>Hi ${app.name.split(' ')[0]},</p>
              <p>Just a reminder — your interview for the <strong>${jobTitle}</strong> position at ${businessName} is ${whenPhrase}, ${dateLabel}, at ${timeLabel}.</p>
              ${locationLine}
              <p>See you then!</p>
            `,
          })
        : Promise.resolve(null),
      profile?.contact_email
        ? resend.emails.send({
            from: 'Helpdesk <onboarding@resend.dev>',
            to: profile.contact_email,
            subject: `Reminder: interview with ${app.name} ${whenPhrase} at ${timeLabel}`,
            html: `
              <p>Reminder — your interview with <strong>${app.name}</strong> for the ${jobTitle} position is ${whenPhrase}, ${dateLabel}, at ${timeLabel}.</p>
              ${locationLine}
            `,
          })
        : Promise.resolve(null),
    ])

    if (results.some(r => r.status === 'fulfilled' && r.value)) sent++
  }

  return NextResponse.json({ sent, checked: applications.length })
}
