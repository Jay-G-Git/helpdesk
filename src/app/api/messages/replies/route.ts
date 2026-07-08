import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'

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

// GET /api/messages/replies?parentId=xxx&businessId=xxx
export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parentId = req.nextUrl.searchParams.get('parentId')
  const businessId = req.nextUrl.searchParams.get('businessId')
  if (!parentId || !businessId) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const { data: messages } = await supabaseAdmin
    .from('chat_messages')
    .select('id, sender_id, sender_name, content, created_at, edited_at, is_deleted, parent_id')
    .eq('business_id', businessId)
    .eq('parent_id', parentId)
    .order('created_at', { ascending: true })

  if (!messages?.length) return NextResponse.json({ messages: [] })

  const msgIds = messages.map(m => m.id)
  const [{ data: reactions }, { data: attachments }] = await Promise.all([
    supabaseAdmin.from('message_reactions').select('*').in('message_id', msgIds),
    supabaseAdmin.from('message_attachments').select('*').in('message_id', msgIds),
  ])

  const enriched = messages.map(msg => ({
    ...msg,
    reactions: buildReactions(reactions ?? [], msg.id, user.id),
    attachments: (attachments ?? []).filter((a: any) => a.message_id === msg.id),
    reply_count: 0,
  }))

  return NextResponse.json({ messages: enriched })
}
