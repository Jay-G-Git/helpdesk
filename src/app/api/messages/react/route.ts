import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { getBearerUser } from '../../../lib/apiAuth'

export async function POST(req: NextRequest) {
  const user = await getBearerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messageId, businessId, reaction } = await req.json()
  if (!messageId || !businessId || !reaction) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const { data: message } = await supabaseAdmin.from('chat_messages').select('business_id, channel').eq('id', messageId).maybeSingle()
  if (!message || message.business_id !== businessId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: biz } = await supabaseAdmin.from('business_profiles').select('business_name').eq('user_id', user.id).maybeSingle()
  const isOwner = !!biz && user.id === businessId
  let senderName = 'User'
  if (isOwner) {
    senderName = user.user_metadata?.full_name ?? biz!.business_name ?? 'Owner'
  } else {
    const { data: emp } = await supabaseAdmin.from('employees').select('id, name').eq('email', user.email ?? '').eq('user_id', businessId).maybeSingle()
    if (!emp) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    // JAY-19 — same group-membership check as send/route.ts.
    const channel = message.channel
    let allowed = channel === 'general' || channel === `dm_emp_${emp.id}`
    if (!allowed && channel.startsWith('group_')) {
      const groupId = Number(channel.replace('group_', ''))
      if (Number.isFinite(groupId)) {
        const { data: membership } = await supabaseAdmin
          .from('chat_channel_group_members')
          .select('id')
          .eq('group_id', groupId)
          .eq('employee_id', emp.id)
          .maybeSingle()
        allowed = !!membership
      }
    }
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    senderName = emp.name
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
