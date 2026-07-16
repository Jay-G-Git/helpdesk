import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { getBearerUser } from '../../../../lib/apiAuth'
import { resolveTenantContextServer } from '../../../../lib/tenantServer'
import { decryptField } from '../../../../lib/fieldEncryption'

// JAY-63 — the only path that ever decrypts routingNumber/accountNumber back
// to plaintext. EmployeePanel.tsx's default view only ever sees the
// `_last4` fields already sitting in form_data (masked); calling this route
// is an explicit, logged action ("Reveal full number"), not something that
// happens as a side effect of just opening the form.
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
    .select('id, employee_id, user_id, form_type, form_data')
    .eq('id', formId)
    .eq('user_id', tenant.tenantId)
    .single()

  if (!form) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  if (form.form_type !== 'direct_deposit') {
    return NextResponse.json({ error: 'This form has no encrypted fields to reveal.' }, { status: 400 })
  }

  const formData = form.form_data as Record<string, string>
  const revealed: Record<string, string> = {}
  for (const key of Object.keys(formData)) {
    if (!key.endsWith('_encrypted')) continue
    const field = key.replace(/_encrypted$/, '')
    try {
      revealed[field] = decryptField(formData[key])
    } catch {
      return NextResponse.json({ error: 'Could not decrypt this field.' }, { status: 500 })
    }
  }

  await supabaseAdmin.from('document_views').insert({
    employee_form_id: form.id,
    employee_id: form.employee_id,
    user_id: form.user_id,
    viewer_user_id: user.id,
    form_type: form.form_type,
    revealed: true,
  })

  return NextResponse.json({ revealed })
}
