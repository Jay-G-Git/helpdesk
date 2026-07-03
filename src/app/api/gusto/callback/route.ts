import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { exchangeCodeForTokens, getCurrentUser } from '../../../../lib/gusto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const userId = req.nextUrl.searchParams.get('state')
  const error = req.nextUrl.searchParams.get('error')

  if (error || !code || !userId) {
    return NextResponse.redirect(new URL('/integrations?error=gusto_denied', req.url))
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code)

    // Get the Gusto company UUID for this user
    const me = await getCurrentUser(tokens.access_token)
    const companyUuid = me.roles?.payroll?.companies?.[0]?.company_uuid ?? null

    // Calculate expiration timestamp (expires_in is seconds, subtract 60 for safety)
    const expiresAt = new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString()

    // Upsert into gusto_connections
    const { error: dbError } = await supabase
      .from('gusto_connections')
      .upsert({
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        access_token_expires_at: expiresAt,
        company_uuid: companyUuid,
        connected_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (dbError) throw dbError

    return NextResponse.redirect(new URL('/integrations?connected=gusto', req.url))
  } catch (err) {
    console.error('Gusto callback error:', err)
    return NextResponse.redirect(new URL('/integrations?error=gusto_failed', req.url))
  }
}
