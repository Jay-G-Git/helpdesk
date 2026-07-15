import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { getBearerUser } from '../../../lib/apiAuth'

// JAY-40 — the web Dashboard's "Needs your attention" panel (Dashboard.tsx)
// builds this same list from several direct supabase.from(...) calls in a
// browser client, which the mobile app can't safely replicate (no RLS-aware
// client wired up there, and per the API-first data-layer direction in
// AGENTS.md, new cross-client data access should go through a route like this
// one instead of duplicating ad hoc queries). Read-only — approve/deny happens
// through the existing PATCH /api/time-off/[id] and PATCH /api/shifts/swaps/[id]
// routes, same ones the web dashboard already uses.
export async function GET(req: NextRequest) {
  const user = await getBearerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date().toISOString().slice(0, 10)

  const [{ data: timeOff }, { data: swaps }, { data: callouts }, { data: employees }] = await Promise.all([
    supabaseAdmin.from('time_off_requests').select('id, employee_id, start_date, end_date, type, reason, created_at').eq('user_id', user.id).eq('status', 'pending').order('created_at', { ascending: false }),
    supabaseAdmin.from('shift_swaps').select('id, requester_employee_id, target_employee_id, requester_shift_id, created_at').eq('user_id', user.id).eq('status', 'pending').order('created_at', { ascending: false }),
    supabaseAdmin.from('shifts').select('id, employee_id, start_time, end_time').eq('user_id', user.id).eq('shift_date', today).eq('status', 'called_out'),
    supabaseAdmin.from('employees').select('id, name, role').eq('user_id', user.id),
  ])

  const empMap = new Map((employees ?? []).map(e => [e.id, e]))

  const requesterShiftIds = (swaps ?? []).map(s => s.requester_shift_id).filter((v): v is number => v != null)
  const { data: requesterShifts } = requesterShiftIds.length
    ? await supabaseAdmin.from('shifts').select('id, shift_date').in('id', requesterShiftIds)
    : { data: [] }
  const shiftDateMap = new Map((requesterShifts ?? []).map(s => [s.id, s.shift_date]))

  return NextResponse.json({
    timeOff: (timeOff ?? []).map(r => ({
      id: r.id,
      employee_name: empMap.get(r.employee_id)?.name ?? 'Employee',
      start_date: r.start_date,
      end_date: r.end_date,
      type: r.type,
      reason: r.reason,
    })),
    swaps: (swaps ?? []).map(s => ({
      id: s.id,
      requester_name: empMap.get(s.requester_employee_id)?.name ?? 'Employee',
      target_name: s.target_employee_id ? (empMap.get(s.target_employee_id)?.name ?? 'Employee') : null,
      shift_date: shiftDateMap.get(s.requester_shift_id) ?? null,
      created_at: s.created_at,
    })),
    callouts: (callouts ?? []).map(c => ({
      id: c.id,
      employee_name: empMap.get(c.employee_id)?.name ?? 'Employee',
      employee_role: empMap.get(c.employee_id)?.role ?? null,
      start_time: c.start_time,
      end_time: c.end_time,
    })),
  })
}
