// PTO balance calculation utilities

export type TimeOffRequest = {
  start_date: string
  end_date: string
  status: string
  // JAY-9 — 'first_half' | 'second_half' | null. Only ever set on a
  // single-day request (start_date === end_date); ignored otherwise.
  portion?: string | null
}

export type PTOBalance = {
  total: number
  used: number
  remaining: number
}

/**
 * Count calendar days between two ISO date strings (inclusive on both ends).
 * JAY-9 — a single-day request with a half-day portion counts as 0.5 days.
 */
export function daysBetween(startDate: string, endDate: string, portion?: string | null): number {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  if (startDate === endDate && (portion === 'first_half' || portion === 'second_half')) return 0.5
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

/**
 * Calculate PTO balance from a total allocation and a list of time-off requests.
 * Only 'approved' requests count toward used days.
 */
export function calcPTOBalance(
  totalDays: number,
  requests: TimeOffRequest[],
): PTOBalance {
  const used = requests
    .filter(r => r.status === 'approved')
    .reduce((sum, r) => sum + daysBetween(r.start_date, r.end_date, r.portion), 0)

  return {
    total: totalDays,
    used,
    remaining: Math.max(0, totalDays - used),
  }
}

/**
 * True if an employee has an approved time-off request that covers a given date.
 */
export function isOnApprovedLeave(
  requests: TimeOffRequest[],
  date: string,
): boolean {
  return requests.some(
    r => r.status === 'approved' && r.start_date <= date && r.end_date >= date,
  )
}
