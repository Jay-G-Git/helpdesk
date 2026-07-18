'use client'

import { useEffect } from 'react'

// JAY-135 — this page was consolidated into portal/page.tsx (pay-stub
// parity added there). Kept as a redirect stub, not deleted outright, so
// any old bookmarked links still land somewhere useful.
export default function EmployeePage() {
  useEffect(() => {
    window.location.href = '/portal'
  }, [])
  return null
}
