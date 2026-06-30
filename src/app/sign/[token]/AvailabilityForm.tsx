'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

type DayAvail = {
  enabled: boolean
  start: string
  end: string
}

export default function AvailabilityForm({ employeeId, onComplete }: { employeeId: number; onComplete?: () => void }) {
  const [avail, setAvail] = useState<DayAvail[]>(
    DAYS.map(() => ({ enabled: false, start: '09:00', end: '17:00' }))
  )
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase
      .from('employee_availability')
      .select('*')
      .eq('employee_id', employeeId)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setAvail(prev => prev.map((d, i) => {
            const row = data.find(r => r.day_of_week === i)
            return row ? { enabled: true, start: row.start_time.slice(0, 5), end: row.end_time.slice(0, 5) } : d
          }))
        }
      })
  }, [employeeId])

  function toggle(i: number) {
    setAvail(prev => prev.map((d, idx) => idx === i ? { ...d, enabled: !d.enabled } : d))
  }

  function setTime(i: number, field: 'start' | 'end', value: string) {
    setAvail(prev => prev.map((d, idx) => idx === i ? { ...d, [field]: value } : d))
  }

  async function save() {
    setSaving(true)
    setMsg('')
    await supabase.from('employee_availability').delete().eq('employee_id', employeeId)
    const rows = avail
      .map((d, i) => ({ ...d, day: i }))
      .filter(d => d.enabled)
      .map(d => ({ employee_id: employeeId, day_of_week: d.day, start_time: d.start, end_time: d.end }))
    if (rows.length > 0) {
      const { error } = await supabase.from('employee_availability').insert(rows)
      if (error) { setMsg('Error saving. Try again.'); setSaving(false); return }
    }
    setMsg('Availability saved!')
    setSaving(false)
    setTimeout(() => onComplete?.(), 1200)
  }

  return (
    <div>
      <div className="sign-section-label">My Availability</div>
      <p style={{ fontSize: '13px', color: '#666', marginTop: '0.25rem', marginBottom: '1rem' }}>
        Check the days you're available and set your hours.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {DAYS.map((day, i) => (
          <div key={day}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: avail[i].enabled ? '0.5rem' : 0 }}>
              <input
                type="checkbox"
                checked={avail[i].enabled}
                onChange={() => toggle(i)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '14px', fontWeight: avail[i].enabled ? 600 : 400, color: avail[i].enabled ? '#185fa5' : '#3a3a3a' }}>
                {day}
              </span>
            </label>
            {avail[i].enabled && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: '1.75rem' }}>
                <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                  <label style={{ fontSize: '11px' }}>From</label>
                  <input type="time" value={avail[i].start} onChange={e => setTime(i, 'start', e.target.value)} />
                </div>
                <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                  <label style={{ fontSize: '11px' }}>To</label>
                  <input type="time" value={avail[i].end} onChange={e => setTime(i, 'end', e.target.value)} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem' }}>
        <button className="btn" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save availability'}
        </button>
        {msg && <div className="done-msg">{msg}</div>}
      </div>
    </div>
  )
}
