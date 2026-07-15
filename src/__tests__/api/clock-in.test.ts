// Integration tests for POST /api/employee/clock-in.
jest.mock('../../app/lib/supabaseAdmin', () => ({ supabaseAdmin: { auth: {}, from: jest.fn() } }))

import { supabaseAdmin } from '../../app/lib/supabaseAdmin'
import { POST } from '../../app/api/employee/clock-in/route'
import { mockAuthUser, queueFromResponses, mockRequest } from '../helpers/supabaseMock'

describe('POST /api/employee/clock-in', () => {
  it('returns 403 when no employee record matches the email (or the employee is terminated)', async () => {
    mockAuthUser(supabaseAdmin, { email: 'ghost@example.com' })
    queueFromResponses(supabaseAdmin, [{ data: null, error: null }])
    const res = await POST(mockRequest({ token: 'good' }) as never)
    expect(res.status).toBe(403)
  })

  it('returns 400 when there is already an open time entry', async () => {
    mockAuthUser(supabaseAdmin, { email: 'jane@example.com' })
    queueFromResponses(supabaseAdmin, [
      { data: { id: 1, user_id: 'u1' }, error: null },
      { data: { id: 55 }, error: null }, // existing open entry found
    ])
    const res = await POST(mockRequest({ token: 'good' }) as never)
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/already clocked in/i)
  })

  it('creates a new time entry when not already clocked in', async () => {
    mockAuthUser(supabaseAdmin, { email: 'jane@example.com' })
    queueFromResponses(supabaseAdmin, [
      { data: { id: 1, user_id: 'u1' }, error: null },
      { data: null, error: null }, // no open entry
      { data: null, error: null }, // JAY-18 — business_profiles.require_clockin_photo lookup (not required)
      { data: { id: 99, clock_in: '2026-07-09T09:00:00.000Z' }, error: null }, // inserted entry
    ])
    const res = await POST(mockRequest({ token: 'good' }) as never)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.entry.id).toBe(99)
  })

  // JAY-18 — clock-in trust package: optional geofence coords + photo.
  it('stores optional lat/lng/photoUrl when the caller sends them', async () => {
    mockAuthUser(supabaseAdmin, { email: 'jane@example.com' })
    const fromMock = queueFromResponses(supabaseAdmin, [
      { data: { id: 1, user_id: 'u1' }, error: null },
      { data: null, error: null },
      { data: null, error: null }, // not required, but still fine to send one
      { data: { id: 99, clock_in: '2026-07-09T09:00:00.000Z' }, error: null },
    ])
    const res = await POST(mockRequest({ token: 'good', body: { lat: 40.71, lng: -74.0, photoUrl: 'https://example.com/p.jpg' } }) as never)
    expect(res.status).toBe(200)
    const insertBuilder = fromMock.mock.results[3].value
    expect(insertBuilder.insert).toHaveBeenCalledWith([
      expect.objectContaining({ clock_in_lat: 40.71, clock_in_lng: -74.0, clock_in_photo_url: 'https://example.com/p.jpg' }),
    ])
  })

  it('returns 400 when the business requires a clock-in photo and none was sent', async () => {
    mockAuthUser(supabaseAdmin, { email: 'jane@example.com' })
    queueFromResponses(supabaseAdmin, [
      { data: { id: 1, user_id: 'u1' }, error: null },
      { data: null, error: null },
      { data: { require_clockin_photo: true }, error: null },
    ])
    const res = await POST(mockRequest({ token: 'good' }) as never)
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/photo is required/i)
  })

  it('allows clock-in when a required photo is provided', async () => {
    mockAuthUser(supabaseAdmin, { email: 'jane@example.com' })
    queueFromResponses(supabaseAdmin, [
      { data: { id: 1, user_id: 'u1' }, error: null },
      { data: null, error: null },
      { data: { require_clockin_photo: true }, error: null },
      { data: { id: 99, clock_in: '2026-07-09T09:00:00.000Z' }, error: null },
    ])
    const res = await POST(mockRequest({ token: 'good', body: { photoUrl: 'https://example.com/p.jpg' } }) as never)
    expect(res.status).toBe(200)
  })
})
