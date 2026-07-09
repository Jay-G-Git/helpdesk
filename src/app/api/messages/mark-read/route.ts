import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { getBearerUser } from '../../../lib/apiAuth'

export async function POST(req: NextRequest) {
  const user = await getBearerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { channel, businessId } = await req.json()
  if (!channel || !businessId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  await supabaseAdmin
    .from('chat_read_receipts')
    .upsert(
      { business_id: businessId, channel, user_id: user.id, last_read_at: new Date().toISOString() },
      { onConflict: 'business_id,channel,user_id' }
    )

  return NextResponse.json({ ok: true })
}
