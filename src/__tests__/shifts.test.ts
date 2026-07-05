import {
  generateRecurringDates,
  clampToBusinessHours,
  shiftHours,
  dayKeyFromDate,
  openShifts,
  overdueOpenShifts,
  type DayHours,
} from '../lib/shifts'

// ─── generateRecurringDates ───────────────────────────────────────────────────

describe('generateRecurringDates', () => {
  it('returns a single date when weeks = 1', () => {
    expect(generateRecurringDates('2026-07-07', 1)).toEqual(['2026-07-07'])
  })

  it('returns dates 7 days apart', () => {
    const dates = generateRecurringDates('2026-07-07', 3)
    expect(dates).toEqual(['2026-07-07', '2026-07-14', '2026-07-21'])
  })

  it('returns correct count of dates', () => {
    expect(generateRecurringDates('2026-07-07', 12)).toHaveLength(12)
  })

  it('handles month boundary correctly', () => {
    const dates = generateRecurringDates('2026-07-28', 2)
    expect(dates[1]).toBe('2026-08-04')
  })

  it('handles year boundary correctly', () => {
    const dates = generateRecurringDates('2026-12-28', 2)
    expect(dates[1]).toBe('2027-01-04')
  })
})

// ─── clampToBusinessHours ─────────────────────────────────────────────────────

describe('clampToBusinessHours', () => {
  const hours: DayHours = { open: '09:00', close: '17:00', closed: false }

  it('returns original times when within business hours', () => {
    expect(clampToBusinessHours('10:00', '16:00', hours)).toEqual({ start: '10:00', end: '16:00' })
  })

  it('clamps start time up to open', () => {
    expect(clampToBusinessHours('07:00', '16:00', hours)).toEqual({ start: '09:00', end: '16:00' })
  })

  it('clamps end time down to close', () => {
    expect(clampToBusinessHours('10:00', '20:00', hours)).toEqual({ start: '10:00', end: '17:00' })
  })

  it('clamps both start and end', () => {
    expect(clampToBusinessHours('06:00', '22:00', hours)).toEqual({ start: '09:00', end: '17:00' })
  })

  it('returns null when shift falls entirely outside hours', () => {
    expect(clampToBusinessHours('18:00', '20:00', hours)).toBeNull()
  })

  it('returns null for a closed day', () => {
    const closed: DayHours = { open: '09:00', close: '17:00', closed: true }
    expect(clampToBusinessHours('09:00', '17:00', closed)).toBeNull()
  })

  it('returns null when clamped start equals clamped end', () => {
    expect(clampToBusinessHours('17:00', '18:00', hours)).toBeNull()
  })
})

// ─── shiftHours ───────────────────────────────────────────────────────────────

describe('shiftHours', () => {
  it('calculates 8h shift correctly', () => {
    expect(shiftHours('09:00', '17:00')).toBe(8)
  })

  it('calculates half-hour increment correctly', () => {
    expect(shiftHours('09:00', '13:30')).toBe(4.5)
  })

  it('returns 0 for same start and end', () => {
    expect(shiftHours('09:00', '09:00')).toBe(0)
  })

  it('handles early morning shift', () => {
    expect(shiftHours('06:00', '14:00')).toBe(8)
  })
})

// ─── dayKeyFromDate ───────────────────────────────────────────────────────────

describe('dayKeyFromDate', () => {
  it('returns sun for a Sunday', () => {
    expect(dayKeyFromDate('2026-07-05')).toBe('sun')  // July 5 2026 is a Sunday
  })

  it('returns mon for a Monday', () => {
    expect(dayKeyFromDate('2026-07-06')).toBe('mon')
  })

  it('returns sat for a Saturday', () => {
    expect(dayKeyFromDate('2026-07-11')).toBe('sat')
  })
})

// ─── openShifts ───────────────────────────────────────────────────────────────

describe('openShifts', () => {
  const shifts = [
    { id: 1, shift_date: '2026-07-10', employee_id: 5, is_open_shift: false },
    { id: 2, shift_date: '2026-07-11', employee_id: null, is_open_shift: true },
    { id: 3, shift_date: '2026-07-12', employee_id: null, is_open_shift: true },
    { id: 4, shift_date: '2026-07-13', employee_id: 3, is_open_shift: false },
  ]

  it('returns only unclaimed open shifts', () => {
    const result = openShifts(shifts)
    expect(result.map(s => s.id)).toEqual([2, 3])
  })

  it('returns empty array when no open shifts', () => {
    const assigned = shifts.filter(s => s.employee_id != null)
    expect(openShifts(assigned)).toHaveLength(0)
  })
})

// ─── overdueOpenShifts ────────────────────────────────────────────────────────

describe('overdueOpenShifts', () => {
  const shifts = [
    { id: 1, shift_date: '2026-06-01', employee_id: null, is_open_shift: true },  // past
    { id: 2, shift_date: '2026-07-05', employee_id: null, is_open_shift: true },  // today
    { id: 3, shift_date: '2026-07-10', employee_id: null, is_open_shift: true },  // future
    { id: 4, shift_date: '2026-06-15', employee_id: 2, is_open_shift: false },    // assigned
  ]

  it('returns only past unclaimed open shifts', () => {
    const result = overdueOpenShifts(shifts, '2026-07-05')
    expect(result.map(s => s.id)).toEqual([1])
  })

  it('does not include today as overdue', () => {
    const result = overdueOpenShifts(shifts, '2026-07-05')
    expect(result.every(s => s.shift_date < '2026-07-05')).toBe(true)
  })

  it('returns empty when no overdue shifts', () => {
    expect(overdueOpenShifts(shifts, '2026-05-01')).toHaveLength(0)
  })
})
