import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { getBearerUser } from '../../../lib/apiAuth'

type ImportRowInput = { name?: string; email?: string; phone?: string; role?: string }

type RowResult =
  | { index: number; success: true; employee: unknown }
  | { index: number; success: false; error: string }

// JAY-170 — bulk employee import. Mirrors the defaults Dashboard.tsx's
// handleAdd() sends for a single "+ Add employee" (start/type/status/etc.),
// but goes through an API route rather than a direct client insert, per
// AGENTS.md's API-first standing rule and the precedent set by JAY-113's
// PATCH/DELETE routes.
export async function POST(req: NextRequest) {
  const user = await getBearerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const rows: ImportRowInput[] = Array.isArray(body.rows) ? body.rows : []
  if (rows.length === 0) {
    return NextResponse.json({ error: 'No rows to import' }, { status: 400 })
  }

  const { data: existing } = await supabaseAdmin
    .from('employees')
    .select('email')
    .eq('user_id', user.id)

  const existingEmails = new Set(
    (existing ?? [])
      .map((e: { email: string }) => e.email?.trim().toLowerCase())
      .filter(Boolean)
  )

  const seenInBatch = new Set<string>()
  const results: RowResult[] = []
  const toInsert: { index: number; record: Record<string, unknown> }[] = []

  rows.forEach((row, index) => {
    const name = (row.name ?? '').trim()
    const role = (row.role ?? '').trim()
    const email = (row.email ?? '').trim()
    const phone = (row.phone ?? '').trim()

    if (!name || !role) {
      results.push({ index, success: false, error: 'Missing required name or role' })
      return
    }

    const emailKey = email.toLowerCase()
    if (emailKey && (existingEmails.has(emailKey) || seenInBatch.has(emailKey))) {
      results.push({ index, success: false, error: 'Email already exists on your team' })
      return
    }
    if (emailKey) seenInBatch.add(emailKey)

    toInsert.push({
      index,
      record: {
        name, role, email, phone,
        user_id: user.id,
        start: new Date().toISOString().slice(0, 10),
        type: 'Full-time',
        address: '', emergency_contact: '', ssn_last4: '', date_of_birth: '',
        status: 'active', i9_status: 'pending', w4_status: 'pending',
        direct_deposit_status: 'pending', pay_type: 'hourly', pay_rate: null,
        pay_period: 'biweekly', access_role: 'employee',
        work_auth_expires_on: null,
      },
    })
  })

  if (toInsert.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('employees')
      .insert(toInsert.map(r => r.record))
      .select()

    if (error) {
      toInsert.forEach(r => results.push({ index: r.index, success: false, error: error.message }))
    } else {
      (data ?? []).forEach((employee: unknown, i: number) => {
        results.push({ index: toInsert[i].index, success: true, employee })
      })
    }
  }

  results.sort((a, b) => a.index - b.index)
  return NextResponse.json({ results })
}
