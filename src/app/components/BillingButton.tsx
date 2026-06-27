'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function BillingButton() {
  const [loading, setLoading] = useState(false)

  async function handleBilling() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const email = session?.user?.email || ''

    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    setLoading(false)
  }

  return (
    <button className="btn" onClick={handleBilling} disabled={loading}>
      {loading ? 'Loading...' : 'Upgrade — $39/mo'}
    </button>
  )
}
