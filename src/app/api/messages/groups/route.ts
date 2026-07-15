import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { getBearerUser } from '../../../lib/apiAuth'

// POST /api/messages/groups
//
// JAY-19 — owner-only creation of a manually named/curated group channel
// (e.g. "Managers", "Kitchen"). Deliberately narrow scope: no auto-membership
// by department/role yet — the owner hand-picks members from the existing
// employee list, same as the ticket's validation gut-check calls for.
export async function POST(req: NextRequest) {
  const user = await getBearerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: biz } = await supabaseAdmin
    .from('business_profiles')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!biz) return NextResponse.json({ error: 'Only owners can create groups.' }, { status: 403 })

  const { name, employeeIds } = await req.json().catch(() => ({}))
  const trimmedName = typeof name === 'string' ? name.trim() : ''
  if (!trimmedName) return NextResponse.json({ error: 'Group name is required.' }, { status: 400 })
  if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
    return NextResponse.json({ error: 'Select at least one member.' }, { status: 400 })
  }

  // Confirm every employee id actually belongs to this owner's business before
  // adding them as members — the ids come from the client.
  const { data: validEmployees } = await supabaseAdmin
    .from('employees')
    .select('id')
    .eq('user_id', user.id)
    .in('id', employeeIds)

  const validIds = (validEmployees ?? []).map((e: { id: number }) => e.id)
  if (validIds.length === 0) return NextResponse.json({ error: 'No valid members selected.' }, { status: 400 })

  const { data: group, error } = await supabaseAdmin
    .from('chat_channel_groups')
    .insert({ user_id: user.id, name: trimmedName })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { error: memberError } = await supabaseAdmin
    .from('chat_channel_group_members')
    .insert(validIds.map((employeeId: number) => ({ group_id: group.id, employee_id: employeeId })))

  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 })

  return NextResponse.json({ group: { id: group.id, name: group.name, memberIds: validIds } })
}
