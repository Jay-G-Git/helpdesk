import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { getBearerUser } from '../../../lib/apiAuth'

export async function GET(req: NextRequest) {
  const user = await getBearerUser(req)
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // JAY-43 — a terminated employee's Supabase Auth account stays active
  // (only employees.status changes on termination), so every employee-facing
  // route must independently check status = 'active' or a former employee
  // keeps full portal/API access indefinitely.
  const { data: employee } = await supabaseAdmin
    .from('employees')
    .select('id, name, role, email, phone, pay_type, pay_rate, user_id, w4_status, i9_status, direct_deposit_status, access_role')
    .eq('email', user.email)
    .eq('status', 'active')
    .single()

  if (!employee) return NextResponse.json({ error: 'Access revoked.' }, { status: 403 })

  // JAY-18 — clock-in trust package settings, read alongside the employee's
  // own profile (already fetched on every portal load) rather than a
  // separate round-trip. Geofence is advisory-only client-side; the photo
  // requirement is enforced server-side in clock-in/route.ts regardless of
  // whether the client actually honors this flag.
  const { data: biz } = await supabaseAdmin
    .from('business_profiles')
    .select('geofence_lat, geofence_lng, geofence_radius_m, require_clockin_photo')
    .eq('user_id', employee.user_id)
    .maybeSingle()

  const verification = {
    requireClockinPhoto: biz?.require_clockin_photo ?? false,
    geofence: biz?.geofence_lat != null && biz?.geofence_lng != null && biz?.geofence_radius_m != null
      ? { lat: biz.geofence_lat, lng: biz.geofence_lng, radiusM: biz.geofence_radius_m }
      : null,
  }

  return NextResponse.json({ employee, verification })
}
