import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { getBearerUser } from '../../../../lib/apiAuth'
import { resolveTenantContextServer } from '../../../../lib/tenantServer'

// JAY-64 — logs that a specific employee_forms row (I-9/W-4/direct deposit)
// was opened, by whom, and when. Called from EmployeePanel.tsx when a form
// is expanded — this is the "did anyone open this" half of the audit trail;
// the "did anyone see the full bank number" half is logged separately by the
// reveal route (JAY-63), which sets `revealed: true` on its own insert here.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getBearerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await resolveTenantContextServer(user.id, user.email)
  if (!tenant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const formId = Number(id)
  if (!formId) return NextResponse.json({ error: 'Invalid form id.' }, { status: 400 })

  const { data: form } = await supabaseAdmin
    .from('employee_forms')
    .select('id, employee_id, user_id, form_type')
    .eq('id', formId)
    .eq('user_id', tenant.tenantId)
    .single()

  if (!form) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  await supabaseAdmin.from('document_views').insert({
    employee_form_id: form.id,
    employee_id: form.employee_id,
    user_id: form.user_id,
    viewer_user_id: user.id,
    form_type: form.form_type,
    revealed: false,
  })

  return NextResponse.json({ success: true })
}
