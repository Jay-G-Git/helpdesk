import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { getBearerUser } from '../../../lib/apiAuth'

export async function POST(req: NextRequest) {
  const user = await getBearerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messageId, businessId, reaction } = await req.json()
  if (!messageId || !businessId || !reaction) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const { data: biz } = await supabaseAdmin.from('business_profiles').select('business_name').eq('user_id', user.id).maybeSingle()
  let senderName = 'User'
  if (biz) {
    senderName = user.user_metadata?.full_name ?? biz.business_name ?? 'Owner'
  } else {
    const { data: emp } = await supabaseAdmin.from('employees').select('name').eq('email', user.email ?? '').eq('user_id', businessId).maybeSingle()
    if (emp) senderName = emp.name
  }

  const { data: existing } = await supabaseAdmin
    .from('message_reactions')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', user.id)
    .eq('reaction', reaction)
    .maybeSingle()

  if (existing) {
    await supabaseAdmin.from('message_reactions').delete().eq('id', existing.id)
    return NextResponse.json({ toggled: 'off' })
  }

  await supabaseAdmin.from('message_reactions').insert({ message_id: messageId, business_id: businessId, user_id: user.id, sender_name: senderName, reaction })
  return NextResponse.json({ toggled: 'on' })
}
