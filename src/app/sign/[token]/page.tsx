import { supabaseAdmin } from '../../lib/supabaseAdmin'
import OnboardingFlow from './OnboardingFlow'

type EmployeeDoc = {
  id: number
  file_name: string
  file_size: number
  file_path: string
  created_at: string
}

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const { data: link } = await supabaseAdmin
    .from('onboarding_links')
    .select('employee_id, employee_name, welcome_pack, user_id')
    .eq('token', token)
    .single()


  if (!link) {
    return (
      <div className="sign-wrap">
        <div className="sign-card">
          <h1>Link not found</h1>
          <p>This link is invalid or has expired. Please ask your employer for a new one.</p>
        </div>
      </div>
    )
  }

  // Check if onboarding already complete
  const { data: emp } = await supabaseAdmin
    .from('employees')
    .select('w4_status, i9_status')
    .eq('id', link.employee_id)
    .single()

  const isReturning = emp?.w4_status === 'complete' && emp?.i9_status === 'complete'

  // Employee-specific docs
  const { data: empDocsRaw } = await supabaseAdmin
    .from('employee_documents')
    .select('id, file_name, file_size, file_path, created_at')
    .eq('employee_id', link.employee_id)
    .order('created_at', { ascending: false })

  // Standard docs from the owner's library
  const { data: templateDocsRaw } = await supabaseAdmin
    .from('document_templates')
    .select('id, file_name, file_size, file_path, created_at')
    .eq('user_id', link.user_id)
    .order('created_at', { ascending: false })

  const allDocs = [...(templateDocsRaw || []), ...(empDocsRaw || [])] as EmployeeDoc[]

  const docsWithUrls = await Promise.all(
    allDocs.map(async (doc) => {
      const { data: signed } = await supabaseAdmin.storage
        .from('documents')
        .createSignedUrl(doc.file_path, 600)
      return {
        id: doc.id,
        file_name: doc.file_name,
        file_size: doc.file_size,
        url: signed?.signedUrl || null,
      }
    })
  )

  return (
    <OnboardingFlow
      token={token}
      employeeId={link.employee_id}
      userId={link.user_id}
      employeeName={link.employee_name}
      welcomePack={link.welcome_pack}
      docs={docsWithUrls}
      isReturning={isReturning}
    />
  )
}
