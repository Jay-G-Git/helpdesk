import { NextRequest, NextResponse } from 'next/server'
import { GUSTO_AUTH_URL } from '../../../../lib/gusto'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(req: NextRequest) {
  // Verify auth via Bearer token in query param (passed from client)
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.redirect(new URL('/login', req.url))

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return NextResponse.redirect(new URL('/login', req.url))

  const params = new URLSearchParams({
    client_id: process.env.GUSTO_CLIENT_ID!,
    redirect_uri: process.env.GUSTO_REDIRECT_URI!,
    response_type: 'code',
    state: user.id, // pass user id through so callback knows who to save tokens for
  })

  return NextResponse.redirect(`${GUSTO_AUTH_URL}?${params.toString()}`)
}
