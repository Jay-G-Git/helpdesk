import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { getBearerUser } from '../../../lib/apiAuth'

export async function POST(req: NextRequest) {
  const user = await getBearerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { channel, businessId } = await req.json()
  if (!channel || !businessId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

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

  await supabaseAdmin
    .from('chat_read_receipts')
    .upsert(
      { business_id: businessId, channel, user_id: user.id, last_read_at: new Date().toISOString() },
      { onConflict: 'business_id,channel,user_id' }
    )

  return NextResponse.json({ ok: true })
}
