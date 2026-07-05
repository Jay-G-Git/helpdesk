'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'

type Employee = { id: number; name: string; role: string; status: string; start: string; pay_type: string; pay_rate: number | null; i9_status: string; w4_status: string; direct_deposit_status: string }
type TimeEntry = { employee_id: number; total_minutes: number | null; clock_in: string }
type TimeOffRequest = { employee_id: number; start_date: string; end_date: string; status: string }
type PayrollEntry = { gross_pay: number; created_at: string }

function fmtMoney(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${n.toLocaleString()}`
}

function HBarChart({ data }: { data: { name: string; value: number; color?: string }[] }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '110px', fontSize: '12px', color: '#333', textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
          <div style={{ flex: 1, height: '18px', background: '#f0f2f5', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${(d.value / max) * 100}%`, height: '100%', background: d.color ?? '#185fa5', borderRadius: '4px', transition: 'width 0.4s' }} />
          </div>
          <div style={{ width: '50px', fontSize: '12px', color: '#555', textAlign: 'right', flexShrink: 0 }}>{d.value}</div>
        </div>
      ))}
    </div>
  )
}

function BarChart({ data, color = '#185fa5', prefix = '', suffix = '' }: { data: { label: string; value: number }[]; color?: string; prefix?: string; suffix?: string }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '120px', padding: '0 4px' }}>
      {data.map((d, i) => {
        const pct = d.value / max
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', height: '100%', justifyContent: 'flex-end' }}>
            <div style={{ fontSize: '10px', color: '#888', whiteSpace: 'nowrap' }}>{prefix}{d.value > 0 ? (d.value >= 1000 ? `${(d.value/1000).toFixed(1)}k` : d.value) : ''}{suffix}</div>
            <div style={{ width: '100%', background: color, borderRadius: '4px 4px 0 0', height: `${Math.max(pct * 85, d.value > 0 ? 4 : 0)}%`, minHeight: d.value > 0 ? '4px' : 0 }} />
            <div style={{ fontSize: '10px', color: '#aaa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', textAlign: 'center' }}>{d.label}</div>
          </div>
        )
      })}
    </div>
  )
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [timeOff, setTimeOff] = useState<TimeOffRequest[]>([])
  const [payroll, setPayroll] = useState<PayrollEntry[]>([])
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { window.location.href = '/login'; return }
      const uid = session.user.id
      const since = new Date(); since.setFullYear(since.getFullYear() - 1)

      const [{ data: emps }, { data: ents }, { data: to }, { data: pay }] = await Promise.all([
        supabase.from('employees').select('id, name, role, status, start, pay_type, pay_rate, i9_status, w4_status, direct_deposit_status').eq('user_id', uid),
        supabase.from('time_entries').select('employee_id, total_minutes, clock_in').eq('user_id', uid).gte('clock_in', since.toISOString()).not('total_minutes', 'is', null),
        supabase.from('time_off_requests').select('employee_id, start_date, end_date, status').eq('user_id', uid).eq('status', 'approved').gte('start_date', since.toISOString().slice(0, 10)),
        supabase.from('payroll_entries').select('gross_pay, created_at').eq('user_id', uid).gte('created_at', since.toISOString()),
      ])
      setEmployees(emps ?? [])
      setEntries(ents ?? [])
      setTimeOff(to ?? [])
      setPayroll(pay ?? [])
      setLoading(false)
    })
  }, [])

  async function exportCSV() {
    setExporting(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setExporting(false); return }
    const res = await fetch('/api/settings/export', { headers: { Authorization: `Bearer ${session.access_token}` } })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'helpdesk-export.json'; a.click()
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  // ── Derived metrics ────────────────────────────────────────────────────────

  const active = employees.filter(e => e.status === 'active' || !e.status)
  const terminated = employees.filter(e => e.status === 'terminated')

  // Turnover rate (terminated / total in last 12 months)
  const turnoverRate = employees.length > 0 ? Math.round((terminated.length / employees.length) * 100) : 0

  // Compliance score
  const compliantCount = active.filter(e => e.w4_status === 'complete' && e.i9_status === 'complete' && e.direct_deposit_status === 'complete').length
  const complianceScore = active.length > 0 ? Math.round((compliantCount / active.length) * 100) : 100

  // Average tenure (active employees)
  const avgTenureMonths = active.length > 0
    ? Math.round(active.reduce((sum, e) => sum + (Date.now() - new Date(e.start).getTime()) / 2629800000, 0) / active.length)
    : 0

  // Total payroll last 12 months
  const totalPayroll = payroll.reduce((s, p) => s + p.gross_pay, 0)

  // Hours by employee (last 12 months)
  const hoursByEmp = new Map<number, number>()
  for (const e of entries) hoursByEmp.set(e.employee_id, (hoursByEmp.get(e.employee_id) ?? 0) + Math.round((e.total_minutes ?? 0) / 60))
  const hoursData = active.map(e => ({ name: e.name.split(' ')[0], value: hoursByEmp.get(e.id) ?? 0 })).filter(d => d.value > 0).sort((a, b) => b.value - a.value).slice(0, 10)

  // PTO days used by employee
  const ptoDaysByEmp = new Map<number, number>()
  for (const r of timeOff) {
    const days = Math.ceil((new Date(r.end_date).getTime() - new Date(r.start_date).getTime()) / 86400000) + 1
    ptoDaysByEmp.set(r.employee_id, (ptoDaysByEmp.get(r.employee_id) ?? 0) + days)
  }
  const ptoData = active.map(e => ({ name: e.name.split(' ')[0], value: ptoDaysByEmp.get(e.id) ?? 0 })).filter(d => d.value > 0).sort((a, b) => b.value - a.value)

  // Monthly payroll trend (last 6 months)
  const monthlyPayroll: { label: string; value: number }[] = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i))
    const label = d.toLocaleDateString('en-US', { month: 'short' })
    const value = Math.round(payroll.filter(p => {
      const m = new Date(p.created_at)
      return m.getMonth() === d.getMonth() && m.getFullYear() === d.getFullYear()
    }).reduce((s, p) => s + p.gross_pay, 0))
    return { label, value }
  })

  // Headcount by month (last 6 months)
  const monthlyHeadcount: { label: string; value: number }[] = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i))
    const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    const label = d.toLocaleDateString('en-US', { month: 'short' })
    const value = employees.filter(e => new Date(e.start) <= endOfMonth && (e.status !== 'terminated')).length
    return { label, value }
  })

  // Roles breakdown
  const roleCount: Record<string, number> = {}
  for (const e of active) { const r = e.role || 'Unknown'; roleCount[r] = (roleCount[r] ?? 0) + 1 }
  const roleData = Object.entries(roleCount).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }))

  if (loading) return (
    <div className="dash-wrap"><Nav active="reports" />
      <div className="dash-content"><div className="loading-state">Loading...</div></div>
    </div>
  )

  return (
    <div className="dash-wrap">
      <Nav active="reports" />
      <div className="dash-content">

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 700 }}>Reports</div>
            <div style={{ fontSize: '13px', color: '#6b6b6b', marginTop: '4px' }}>Last 12 months</div>
          </div>
          <button className="btn" onClick={exportCSV} disabled={exporting} style={{ width: 'auto', fontSize: '13px', padding: '7px 14px' }}>
            {exporting ? 'Preparing...' : '↓ Export data'}
          </button>
        </div>

        {/* KPI row */}
        <div className="dash-stats" style={{ marginBottom: '1.5rem' }}>
          <div className="stat">
            <div className="stat-n">{active.length}</div>
            <div className="stat-l">Active employees</div>
          </div>
          <div className="stat">
            <div className="stat-n" style={{ color: turnoverRate > 20 ? '#c0392b' : '#1a1a1a' }}>{turnoverRate}%</div>
            <div className="stat-l">Turnover rate</div>
          </div>
          <div className="stat">
            <div className="stat-n" style={{ color: complianceScore === 100 ? '#27ae60' : complianceScore >= 80 ? '#e67e22' : '#c0392b' }}>{complianceScore}%</div>
            <div className="stat-l">Compliance score</div>
          </div>
          <div className="stat">
            <div className="stat-n" style={{ fontSize: '20px' }}>
              {avgTenureMonths < 12 ? `${avgTenureMonths}mo` : `${Math.floor(avgTenureMonths / 12)}yr ${avgTenureMonths % 12}mo`}
            </div>
            <div className="stat-l">Avg. tenure</div>
          </div>
          {totalPayroll > 0 && (
            <div className="stat">
              <div className="stat-n" style={{ fontSize: '20px' }}>{fmtMoney(totalPayroll)}</div>
              <div className="stat-l">Total payroll</div>
            </div>
          )}
        </div>

        {/* Compliance detail */}
        {active.some(e => e.w4_status !== 'complete' || e.i9_status !== 'complete' || e.direct_deposit_status !== 'complete') && (
          <div className="card" style={{ marginBottom: '1rem', border: '1px solid #fcd4d4' }}>
            <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '0.75rem', color: '#c0392b' }}>Incomplete paperwork</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {active.filter(e => e.w4_status !== 'complete' || e.i9_status !== 'complete' || e.direct_deposit_status !== 'complete').map(e => {
                const missing = [e.w4_status !== 'complete' && 'W-4', e.i9_status !== 'complete' && 'I-9', e.direct_deposit_status !== 'complete' && 'Direct deposit'].filter(Boolean)
                return (
                  <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '6px 0', borderBottom: '1px solid #fce8e8' }}>
                    <span style={{ fontWeight: 500 }}>{e.name}</span>
                    <span style={{ color: '#c0392b' }}>{missing.join(', ')} pending</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Charts grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '1rem' }}>Headcount (6 months)</div>
            <BarChart data={monthlyHeadcount} color="#185fa5" />
          </div>
          {totalPayroll > 0 ? (
            <div className="card">
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '1rem' }}>Payroll cost (6 months)</div>
              <BarChart data={monthlyPayroll} color="#15803d" prefix="$" />
            </div>
          ) : (
            <div className="card">
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '0.5rem' }}>Payroll cost</div>
              <div className="empty-state">No payroll data yet.</div>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          {hoursData.length > 0 && (
            <div className="card">
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '1rem' }}>Hours worked per employee</div>
              <HBarChart data={hoursData} />
            </div>
          )}
          {roleData.length > 0 && (
            <div className="card">
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '1rem' }}>Team by role</div>
              <HBarChart data={roleData} />
            </div>
          )}
        </div>

        {ptoData.length > 0 && (
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '1rem' }}>PTO days used (12 months)</div>
            <HBarChart data={ptoData.map(d => ({ ...d, color: '#b45309' }))} />
          </div>
        )}

      </div>
    </div>
  )
}
