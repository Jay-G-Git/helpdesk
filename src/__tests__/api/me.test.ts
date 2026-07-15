jest.mock('../../app/lib/supabaseAdmin', () => ({ supabaseAdmin: { auth: {}, from: jest.fn() } }))

import { supabaseAdmin } from '../../app/lib/supabaseAdmin'
import { GET } from '../../app/api/employee/me/route'
import { mockAuthUser, queueFromResponses, mockRequest } from '../helpers/supabaseMock'

describe('GET /api/employee/me', () => {
  it('returns 401 without a token', async () => {
    const res = await GET(mockRequest() as never)
    expect(res.status).toBe(401)
  })

  it('returns 401 when the token has no matching user', async () => {
    mockAuthUser(supabaseAdmin, null)
    const res = await GET(mockRequest({ token: 'bad' }) as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 when no employee record matches the email (or the employee is terminated)', async () => {
    mockAuthUser(supabaseAdmin, { email: 'ghost@example.com' })
    queueFromResponses(supabaseAdmin, [{ data: null, error: null }])
    const res = await GET(mockRequest({ token: 'good' }) as never)
    expect(res.status).toBe(403)
  })

  it('returns the employee profile on success', async () => {
    mockAuthUser(supabaseAdmin, { email: 'jane@example.com' })
    queueFromResponses(supabaseAdmin, [
      { data: { id: 1, name: 'Jane', role: 'Cashier', access_role: 'employee', user_id: 'owner-1' }, error: null },
      { data: null, error: null }, // JAY-18 — business_profiles geofence/photo lookup (none configured)
    ])
    const res = await GET(mockRequest({ token: 'good' }) as never)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.employee.name).toBe('Jane')
  })

  // JAY-18 — clock-in trust package settings, read alongside the employee profile.
  it('returns verification settings with a geofence when the owner configured one', async () => {
    mockAuthUser(supabaseAdmin, { email: 'jane@example.com' })
    queueFromResponses(supabaseAdmin, [
      { data: { id: 1, name: 'Jane', user_id: 'owner-1' }, error: null },
      { data: { geofence_lat: 40.7128, geofence_lng: -74.006, geofence_radius_m: 200, require_clockin_photo: true }, error: null },
    ])
    const res = await GET(mockRequest({ token: 'good' }) as never)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.verification).toEqual({
      requireClockinPhoto: true,
      geofence: { lat: 40.7128, lng: -74.006, radiusM: 200 },
    })
  })

  it('returns a null geofence and requireClockinPhoto=false when nothing is configured', async () => {
    mockAuthUser(supabaseAdmin, { email: 'jane@example.com' })
    queueFromResponses(supabaseAdmin, [
      { data: { id: 1, name: 'Jane', user_id: 'owner-1' }, error: null },
      { data: null, error: null },
    ])
    const res = await GET(mockRequest({ token: 'good' }) as never)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.verification).toEqual({ requireClockinPhoto: false, geofence: null })
  })
})
