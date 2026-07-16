import { supabaseAdmin } from './supabaseAdmin'
import type { TenantContext } from './tenant'

// JAY-63/64 — server-side equivalent of resolveTenantContext (tenant.ts),
// for API routes that need to know a bearer-authenticated user's tenant.
// Deliberately a separate file/module rather than living in tenant.ts:
// tenant.ts imports the client-side `supabase` client (RLS'd, needs
// NEXT_PUBLIC_SUPABASE_URL/ANON_KEY at module load), which API routes and
// their tests shouldn't need to drag in just to resolve a tenant server-side
// with the service-role client. Same resolution rule as the client version:
// owners use their own id; invited admins/managers use the owning employees
// row's user_id, matched by email.
export async function resolveTenantContextServer(sessionUserId: string, sessionEmail: string | undefined): Promise<TenantContext | null> {
  const { data: biz } = await supabaseAdmin
    .from('business_profiles')
    .select('user_id')
    .eq('user_id', sessionUserId)
    .single()

  if (biz) {
    return { tenantId: sessionUserId, viewerRole: 'owner', viewerPerms: null }
  }

  const { data: emp } = await supabaseAdmin
    .from('employees')
    .select('user_id, access_role, permissions')
    .eq('email', sessionEmail ?? '')
    .single()

  if (!emp) return null

  const accessRole = emp.access_role as 'admin' | 'manager' | 'employee'
  if (accessRole === 'employee') return null

  return {
    tenantId: emp.user_id,
    viewerRole: accessRole,
    viewerPerms: (emp.permissions as Record<string, boolean> | null) ?? null,
  }
}
