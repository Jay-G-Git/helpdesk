import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { getBearerUser } from '../../../lib/apiAuth'

export async function DELETE(req: NextRequest) {
  const user = await getBearerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Delete all user data in order (FK constraints)
  const uid = user.id
  const cascadeDeletes: [string, string][] = [
    ['payroll_entries', 'user_id'],
    ['payroll_run_items', 'user_id'],
    ['payroll_runs', 'user_id'],
    ['shifts', 'user_id'],
    ['time_off_requests', 'user_id'],
    ['notifications', 'user_id'],
    ['employee_forms', 'user_id'],
    ['onboarding_links', 'user_id'],
    ['employees', 'user_id'],
    ['onboarding_templates', 'user_id'],
    ['job_postings', 'user_id'],
    ['gusto_connections', 'user_id'],
    ['google_connections', 'user_id'],
    ['quickbooks_connections', 'user_id'],
    ['team_members', 'owner_id'],
    ['business_profiles', 'user_id'],
    ['notification_preferences', 'user_id'],
  ]
  for (const [table, column] of cascadeDeletes) {
    const { error } = await supabaseAdmin.from(table).delete().eq(column, uid)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Delete the auth user last
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(uid)
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
