import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { getBearerUser } from '../../../lib/apiAuth'

export async function POST(req: NextRequest) {
  const user = await getBearerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { channel, businessId, content, parentId, attachments } = await req.json()
  if (!channel || !businessId || !content?.trim()) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Determine sender name + verify access
  const { data: biz } = await supabaseAdmin
    .from('business_profiles')
    .select('user_id, business_name')
    .eq('user_id', user.id)
    .maybeSingle()

  let senderName: string
  const isOwner = !!biz && user.id === businessId

  if (isOwner) {
    senderName = user.user_metadata?.full_name ?? biz.business_name ?? 'Owner'
  } else {
    const { data: emp } = await supabaseAdmin
      .from('employees')
      .select('id, name')
      .eq('email', user.email ?? '')
      .eq('user_id', businessId)
      .single()
    if (!emp) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    // JAY-19 — a channel of shape 'group_<id>' is allowed if the employee is
    // an actual member of that group; otherwise fall back to the original
    // general/DM-only check.
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
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    senderName = emp.name
  }

  const { data: message, error } = await supabaseAdmin
    .from('chat_messages')
    .insert({
      business_id: businessId,
      channel,
      sender_id: user.id,
      sender_name: senderName,
      content: content.trim(),
      parent_id: parentId ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Link any pre-uploaded attachments to this message
  if (attachments?.length && message) {
    await supabaseAdmin.from('message_attachments').insert(
      attachments.map((a: any) => ({ ...a, message_id: message.id, business_id: businessId }))
    )
  }

  return NextResponse.json({ message: { ...message, reactions: [], attachments: attachments ?? [], reply_count: 0 } })
}
