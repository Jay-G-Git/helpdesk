// Mirrors the entity shapes used in the root Next.js app (see
// src/app/time/page.tsx and the various src/app/api/employee/* routes),
// so both clients agree on the same data contracts.

export type Employee = {
  id: number
  name: string
  role: string
  pay_type: string
  pay_rate: number | null
}

export type Shift = {
  id: number
  employee_id: number | null
  shift_date: string
  start_time: string
  end_time: string
  notes: string | null
  status?: string
  is_open_shift?: boolean
}

export type TimeOffRequest = {
  id: number
  employee_id: number
  start_date: string
  end_date: string
  type: string
  reason: string | null
  status: 'pending' | 'approved' | 'denied'
  created_at: string
}

export type TimeEntry = {
  id: number
  employee_id: number
  clock_in: string
  clock_out: string | null
  total_minutes: number | null
}

// Roles come from the permissions system added in supabase/migrations
// (007_roles.sql, 009_permissions.sql). Mobile gates the future admin
// section on these, same as the web app's Nav/Settings pages.
export type Role = 'owner' | 'admin' | 'manager' | 'employee'
