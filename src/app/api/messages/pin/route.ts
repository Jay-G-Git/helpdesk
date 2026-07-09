import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { getBearerUser } from '../../../lib/apiAuth'

// POST — pin or unpin a message (owner only)
export async function POST(req: NextRequest) {
  const user = await getBearerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messageId, pin } = await req.json()

  const { data: biz } = await supabaseAdmin.from('business_profiles').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!biz) return NextResponse.json({ error: 'Forbidden — only owner can pin' }, { status: 403 })

  const { error } = await supabaseAdmin
    .from('chat_messages')
    .update({ is_pinned: pin ?? true })
    .eq('id', messageId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
