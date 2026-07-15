import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { getBearerUser } from '../../../lib/apiAuth'

export async function POST(req: NextRequest) {
  const user = await getBearerUser(req)
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { shiftId } = await req.json()
  if (!shiftId) return NextResponse.json({ error: 'Missing shiftId' }, { status: 400 })

  // JAY-43 — block terminated employees; see employee/me/route.ts for context.
  const { data: employee } = await supabaseAdmin
    .from('employees')
    .select('id, user_id')
    .eq('email', user.email)
    .eq('status', 'active')
    .single()

  if (!employee) return NextResponse.json({ error: 'Access revoked.' }, { status: 403 })

  // Confirm the shift exists in this business at all, so a bad/foreign id
  // reports 404 rather than the generic 409 used below for "already taken."
  const { data: shift } = await supabaseAdmin
    .from('shifts')
    .select('id, user_id')
    .eq('id', shiftId)
    .eq('user_id', employee.user_id)
    .single()

  if (!shift) return NextResponse.json({ error: 'Shift not found.' }, { status: 404 })

  // JAY-52 — this used to be a separate select-then-update: read whether the
  // shift was still open, then write it. Under real concurrency two
  // employees could both pass the read check before either write landed,
  // both believing they'd claimed it. Fold the open/unclaimed check into the
  // update's own WHERE clause so the claim is atomic at the DB layer — only
  // one concurrent request can match `is_open_shift = true AND employee_id
  // IS NULL` and actually update the row; the other gets zero rows back.
  const { data: updated, error } = await supabaseAdmin
    .from('shifts')
    .update({ employee_id: employee.id, is_open_shift: false })
    .eq('id', shiftId)
    .eq('is_open_shift', true)
    .is('employee_id', null)
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!updated) return NextResponse.json({ error: 'Shift is no longer available.' }, { status: 409 })

  return NextResponse.json({ shift: updated })
}
