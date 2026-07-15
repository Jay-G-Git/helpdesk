import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { getBearerUser } from '../../../lib/apiAuth'

function buildReactions(reactions: any[], msgId: number, userId: string) {
  const byReaction: Record<string, { count: number; users: string[]; reacted: boolean }> = {}
  for (const r of reactions.filter(r => r.message_id === msgId)) {
    if (!byReaction[r.reaction]) byReaction[r.reaction] = { count: 0, users: [], reacted: false }
    byReaction[r.reaction].count++
    byReaction[r.reaction].users.push(r.sender_name)
    if (r.user_id === userId) byReaction[r.reaction].reacted = true
  }
  return Object.entries(byReaction).map(([reaction, data]) => ({ reaction, ...data }))
}

export async function GET(req: NextRequest) {
  const user = await getBearerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const channel = req.nextUrl.searchParams.get('channel')
  const businessId = req.nextUrl.searchParams.get('businessId')
  if (!channel || !businessId) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const { data: biz } = await supabaseAdmin.from('business_profiles').select('user_id').eq('user_id', user.id).maybeSingle()
  const isOwner = !!biz && user.id === businessId

  if (!isOwner) {
    const { data: emp } = await supabaseAdmin.from('employees').select('id').eq('email', user.email ?? '').eq('user_id', businessId).single()
    if (!emp) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    // JAY-19 — same group-membership check as send/route.ts.
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
  }

  // Only top-level messages (no replies)
  const { data: messages, error } = await supabaseAdmin
    .from('chat_messages')
    .select('id, sender_id, sender_name, content, created_at, edited_at, is_deleted, is_pinned, parent_id')
    .eq('business_id', businessId)
    .eq('channel', channel)
    .is('parent_id', null)
    .order('created_at', { ascending: true })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!messages?.length) return NextResponse.json({ messages: [] })

  const msgIds = messages.map(m => m.id)

  const [{ data: reactions }, { data: attachments }, { data: replies }] = await Promise.all([
    supabaseAdmin.from('message_reactions').select('*').in('message_id', msgIds),
    supabaseAdmin.from('message_attachments').select('*').in('message_id', msgIds),
    supabaseAdmin.from('chat_messages').select('parent_id').in('parent_id', msgIds),
  ])

  const replyCountMap: Record<number, number> = {}
  for (const r of replies ?? []) {
    if (r.parent_id) replyCountMap[r.parent_id] = (replyCountMap[r.parent_id] ?? 0) + 1
  }

  const enriched = messages.map(msg => ({
    ...msg,
    reactions: buildReactions(reactions ?? [], msg.id, user.id),
    attachments: (attachments ?? []).filter((a: any) => a.message_id === msg.id),
    reply_count: replyCountMap[msg.id] ?? 0,
  }))

  return NextResponse.json({ messages: enriched })
}
