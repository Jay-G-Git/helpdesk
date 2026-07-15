import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { getBearerUser } from '../../../lib/apiAuth'

export async function POST(req: NextRequest) {
  const user = await getBearerUser(req)
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // JAY-43 — block terminated employees; see employee/me/route.ts for context.
  const { data: employee } = await supabaseAdmin
    .from('employees')
    .select('id, user_id')
    .eq('email', user.email)
    .eq('status', 'active')
    .single()

  if (!employee) return NextResponse.json({ error: 'Access revoked.' }, { status: 403 })

  // Check if already clocked in
  const { data: open } = await supabaseAdmin
    .from('time_entries')
    .select('id')
    .eq('employee_id', employee.id)
    .is('clock_out', null)
    .single()

  if (open) return NextResponse.json({ error: 'Already clocked in.' }, { status: 400 })

  // JAY-18 — optional geofence coordinates + photo, sent only if the browser
  // granted location/camera access. Body is optional (existing callers send
  // none), parsed defensively same as the clock-out notes field.
  let lat: number | null = null
  let lng: number | null = null
  let photoUrl: string | null = null
  try {
    const body = await req.json()
    if (typeof body?.lat === 'number' && typeof body?.lng === 'number') { lat = body.lat; lng = body.lng }
    if (typeof body?.photoUrl === 'string' && body.photoUrl.trim()) photoUrl = body.photoUrl.trim()
  } catch { /* no body sent */ }

  // If the business requires a clock-in photo, enforce it server-side —
  // this is a deliberate owner setting, unlike the geofence below (which is
  // advisory-only and never blocks, since GPS accuracy on mobile web varies
  // too much to safely lock someone out of their own shift).
  const { data: biz } = await supabaseAdmin
    .from('business_profiles')
    .select('require_clockin_photo')
    .eq('user_id', employee.user_id)
    .maybeSingle()

  if (biz?.require_clockin_photo && !photoUrl) {
    return NextResponse.json({ error: 'A clock-in photo is required.' }, { status: 400 })
  }

  const { data: entry, error } = await supabaseAdmin
    .from('time_entries')
    .insert([{
      user_id: employee.user_id,
      employee_id: employee.id,
      clock_in: new Date().toISOString(),
      ...(lat !== null ? { clock_in_lat: lat } : {}),
      ...(lng !== null ? { clock_in_lng: lng } : {}),
      ...(photoUrl ? { clock_in_photo_url: photoUrl } : {}),
    }])
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ entry })
}
