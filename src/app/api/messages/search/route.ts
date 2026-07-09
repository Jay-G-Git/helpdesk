import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { getBearerUser } from '../../../lib/apiAuth'

export async function GET(req: NextRequest) {
  const user = await getBearerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim()
  const businessId = req.nextUrl.searchParams.get('businessId')

  if (!q || q.length < 2) return NextResponse.json({ results: [] })
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })

  const { data: messages } = await supabaseAdmin
    .from('chat_messages')
    .select('id, channel, sender_name, content, created_at')
    .eq('business_id', businessId)
    .ilike('content', `%${q}%`)
    .order('created_at', { ascending: false })
    .limit(40)

  return NextResponse.json({ results: messages ?? [] })
}
