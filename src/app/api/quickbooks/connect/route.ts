import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { QB_AUTH_URL } from '../../../../lib/quickbooks'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.redirect(new URL('/login', req.url))

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return NextResponse.redirect(new URL('/login', req.url))

  const params = new URLSearchParams({
    client_id: process.env.QB_CLIENT_ID!,
    redirect_uri: process.env.QB_REDIRECT_URI!,
    response_type: 'code',
    scope: 'com.intuit.quickbooks.accounting',
    state: user.id,
  })

  return NextResponse.redirect(`${QB_AUTH_URL}?${params.toString()}`)
}
