// PTO balance calculation utilities

export type TimeOffRequest = {
  start_date: string
  end_date: string
  status: string
}

export type PTOBalance = {
  total: number
  used: number
  remaining: number
}

/**
 * Count calendar days between two ISO date strings (inclusive on both ends).
 */
export function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
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
    .reduce((sum, r) => sum + daysBetween(r.start_date, r.end_date), 0)

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
