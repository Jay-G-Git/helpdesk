import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { exchangeCodeForTokens } from '../../../../lib/googleCalendar'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const userId = req.nextUrl.searchParams.get('state')
  const error = req.nextUrl.searchParams.get('error')

  if (error || !code || !userId) {
    return NextResponse.redirect(new URL('/integrations?error=google_denied', req.url))
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    const expiresAt = new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString()

    const { error: dbError } = await supabase
      .from('google_connections')
      .upsert({
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        access_token_expires_at: expiresAt,
        connected_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (dbError) throw dbError

    return NextResponse.redirect(new URL('/integrations?connected=google', req.url))
  } catch (err) {
    console.error('Google callback error:', err)
    return NextResponse.redirect(new URL('/integrations?error=google_failed', req.url))
  }
}
