import { daysBetween, calcPTOBalance, isOnApprovedLeave } from '../lib/pto'

// ─── daysBetween ──────────────────────────────────────────────────────────────

describe('daysBetween', () => {
  it('returns 1 for the same start and end date', () => {
    expect(daysBetween('2026-07-10', '2026-07-10')).toBe(1)
  })

  it('counts a 5-day week correctly', () => {
    expect(daysBetween('2026-07-06', '2026-07-10')).toBe(5)
  })

  it('handles month boundary', () => {
    expect(daysBetween('2026-07-30', '2026-08-02')).toBe(4)
  })

  it('handles year boundary', () => {
    expect(daysBetween('2026-12-30', '2027-01-02')).toBe(4)
  })

  it('handles a full week', () => {
    expect(daysBetween('2026-07-06', '2026-07-12')).toBe(7)
  })
})

// ─── calcPTOBalance ───────────────────────────────────────────────────────────

describe('calcPTOBalance', () => {
  it('returns full balance when no requests', () => {
    expect(calcPTOBalance(15, [])).toEqual({ total: 15, used: 0, remaining: 15 })
  })

  it('deducts approved days correctly', () => {
    const requests = [
      { start_date: '2026-07-06', end_date: '2026-07-10', status: 'approved' }, // 5 days
    ]
    expect(calcPTOBalance(15, requests)).toEqual({ total: 15, used: 5, remaining: 10 })
  })

  it('ignores pending requests', () => {
    const requests = [
      { start_date: '2026-07-06', end_date: '2026-07-10', status: 'pending' },
    ]
    expect(calcPTOBalance(15, requests)).toEqual({ total: 15, used: 0, remaining: 15 })
  })

  it('ignores denied requests', () => {
    const requests = [
      { start_date: '2026-07-06', end_date: '2026-07-10', status: 'denied' },
    ]
    expect(calcPTOBalance(15, requests)).toEqual({ total: 15, used: 0, remaining: 15 })
  })

  it('accumulates multiple approved requests', () => {
    const requests = [
      { start_date: '2026-07-06', end_date: '2026-07-07', status: 'approved' }, // 2 days
      { start_date: '2026-07-20', end_date: '2026-07-22', status: 'approved' }, // 3 days
    ]
    expect(calcPTOBalance(15, requests)).toEqual({ total: 15, used: 5, remaining: 10 })
  })

  it('clamps remaining to 0 when overused', () => {
    const requests = [
      { start_date: '2026-07-01', end_date: '2026-07-20', status: 'approved' }, // 20 days
    ]
    const result = calcPTOBalance(10, requests)
    expect(result.remaining).toBe(0)
    expect(result.used).toBe(20)
  })

  it('mixes approved, pending, and denied correctly', () => {
    const requests = [
      { start_date: '2026-07-01', end_date: '2026-07-01', status: 'approved' }, // 1
      { start_date: '2026-07-05', end_date: '2026-07-05', status: 'pending' },  // ignored
      { start_date: '2026-07-10', end_date: '2026-07-10', status: 'denied' },   // ignored
    ]
    expect(calcPTOBalance(10, requests)).toEqual({ total: 10, used: 1, remaining: 9 })
  })
})

// ─── isOnApprovedLeave ────────────────────────────────────────────────────────

describe('isOnApprovedLeave', () => {
  const requests = [
    { start_date: '2026-07-06', end_date: '2026-07-10', status: 'approved' },
    { start_date: '2026-07-20', end_date: '2026-07-22', status: 'pending' },
  ]

  it('returns true for a date within an approved request', () => {
    expect(isOnApprovedLeave(requests, '2026-07-08')).toBe(true)
  })

  it('returns true for the first day of an approved request', () => {
    expect(isOnApprovedLeave(requests, '2026-07-06')).toBe(true)
  })

  it('returns true for the last day of an approved request', () => {
    expect(isOnApprovedLeave(requests, '2026-07-10')).toBe(true)
  })

  it('returns false for a date outside all approved requests', () => {
    expect(isOnApprovedLeave(requests, '2026-07-15')).toBe(false)
  })

  it('returns false for a date covered only by a pending request', () => {
    expect(isOnApprovedLeave(requests, '2026-07-21')).toBe(false)
  })

  it('returns false when no requests', () => {
    expect(isOnApprovedLeave([], '2026-07-08')).toBe(false)
  })
})
