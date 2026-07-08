'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'
import { DollarIcon } from '../components/Icons'

type Employee = {
  id: number
  name: string
  role: string
  type: string
  status: string
  pay_type: string
  pay_rate: number | null
  pay_period: string
}

type PayrollEntry = {
  id: number
  employee_id: number
  period_start: string
  period_end: string
  hours_worked: number | null
  gross_pay: number
  notes: string | null
  paid_at: string
}

type PayrollRun = {
  id: number
  period_start: string
  period_end: string
  run_date: string
  status: 'draft' | 'finalized'
  total_gross: number
  employee_count: number
  notes: string | null
}

type PayrollRunItem = {
  id: number
  run_id: number
  employee_id: number
  employee_name: string
  pay_type: string
  pay_rate: number
  hours_worked: number | null
  gross_pay: number
  deductions: { federal: number; state: number; other: number }
  net_pay: number
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

type PayPeriod = 'weekly' | 'biweekly' | 'semi-monthly' | 'monthly'

function getPeriodForType(type: PayPeriod) {
  const today = new Date()
  const y = today.getFullYear()
  const m = today.getMonth()
  const d = today.getDate()

  if (type === 'weekly') {
    const start = new Date(today)
    start.setDate(d - today.getDay())
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
  }
  if (type === 'biweekly') {
    const startOffset = today.getDay() % 14
    const start = new Date(today)
    start.setDate(d - startOffset)
    const end = new Date(start)
    end.setDate(start.getDate() + 13)
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
  }
  if (type === 'semi-monthly') {
    const start = new Date(y, m, d < 16 ? 1 : 16)
    const end = d < 16
      ? new Date(y, m, 15)
      : new Date(y, m + 1, 0)
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
  }
  // monthly
  const start = new Date(y, m, 1)
  const end = new Date(y, m + 1, 0)
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

export default function PayrollPage() {
  const router = useRouter()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [entries, setEntries] = useState<PayrollEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'overview' | 'history' | 'runs'>('dashboard')

  // Log payment form
  const [showForm, setShowForm] = useState(false)
  const [selectedEmpId, setSelectedEmpId] = useState<number | null>(null)
  const [payPeriodType, setPayPeriodType] = useState<PayPeriod>('biweekly')
  const defaultPeriod = getPeriodForType('biweekly')
  const [periodStart, setPeriodStart] = useState(defaultPeriod.start)
  const [periodEnd, setPeriodEnd] = useState(defaultPeriod.end)

  function handlePeriodTypeChange(type: PayPeriod) {
    setPayPeriodType(type)
    const p = getPeriodForType(type)
    setPeriodStart(p.start)
    setPeriodEnd(p.end)
  }
  const [hours, setHours] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  // Payroll runs state
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [runs, setRuns] = useState<PayrollRun[]>([])
  const [expandedRun, setExpandedRun] = useState<number | null>(null)
  const [runItems, setRunItems] = useState<Record<number, PayrollRunItem[]>>({})
  const [runPeriodStart, setRunPeriodStart] = useState(defaultPeriod.start)
  const [runPeriodEnd, setRunPeriodEnd] = useState(defaultPeriod.end)
  const [runNotes, setRunNotes] = useState('')
  const [runCreating, setRunCreating] = useState(false)
  const [runMsg, setRunMsg] = useState('')
  const [savingDeductions, setSavingDeductions] = useState<number | null>(null)
  const [editDeductions, setEditDeductions] = useState<Record<number, { federal: string; state: string; other: string }>>({})

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setUserId(session.user.id)
    const token = session.access_token
    setSessionToken(token)

    const [{ data: emps }, { data: payroll }, runsRes] = await Promise.all([
      supabase.from('employees').select('id, name, role, type, status, pay_type, pay_rate, pay_period').eq('user_id', session.user.id).eq('status', 'active'),
      supabase.from('payroll_entries').select('*').eq('user_id', session.user.id).order('period_start', { ascending: false }),
      fetch('/api/payroll/run', { headers: { Authorization: `Bearer ${token}` } }),
    ])

    if (emps) setEmployees(emps)
    if (payroll) setEntries(payroll)
    if (runsRes.ok) {
      const d = await runsRes.json()
      setRuns(d.runs ?? [])
    }
    setLoading(false)
  }

  const selectedEmp = employees.find(e => e.id === selectedEmpId)

  function calcGrossPay() {
    if (!selectedEmp?.pay_rate) return 0
    if (selectedEmp.pay_type === 'salary') return selectedEmp.pay_rate / 26
    return (parseFloat(hours) || 0) * selectedEmp.pay_rate
  }

  async function handleSubmit() {
    if (!selectedEmp) { setSaveMsg('Select an employee.'); return }
    if (!selectedEmp.pay_rate) { setSaveMsg('Set a pay rate on the employee first.'); return }
    if (selectedEmp.pay_type === 'hourly' && !hours) { setSaveMsg('Enter hours worked.'); return }
    setSaving(true)
    setSaveMsg('')

    const gross = calcGrossPay()
    const { error } = await supabase.from('payroll_entries').insert([{
      user_id: userId,
      employee_id: selectedEmp.id,
      period_start: periodStart,
      period_end: periodEnd,
      hours_worked: selectedEmp.pay_type === 'hourly' ? parseFloat(hours) : null,
      gross_pay: gross,
      notes: notes.trim() || null,
    }])

    if (error) {
      setSaveMsg('Error saving. Try again.')
    } else {
      setSaveMsg('Saved.')
      setShowForm(false)
      setHours('')
      setNotes('')
      setSelectedEmpId(null)
      setTimeout(() => setSaveMsg(''), 2000)
      load()
    }
    setSaving(false)
  }

  function exportCSV() {
    const rows = [
      ['Employee', 'Period Start', 'Period End', 'Hours Worked', 'Gross Pay', 'Notes', 'Paid At'],
      ...entries.map(e => {
        const emp = employees.find(em => em.id === e.employee_id)
        return [
          emp?.name ?? e.employee_id,
          e.period_start,
          e.period_end,
          e.hours_worked ?? '',
          e.gross_pay,
          e.notes ?? '',
          formatDate(e.paid_at),
        ]
      })
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'payroll-export.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function loadRunItems(runId: number, token: string) {
    const res = await fetch(`/api/payroll/run/${runId}`, { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) {
      const data = await res.json()
      setRunItems(prev => ({ ...prev, [runId]: data.items ?? [] }))
    }
  }

  async function reloadRuns(token: string) {
    const res = await fetch('/api/payroll/run', { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) {
      const d = await res.json()
      setRuns(d.runs ?? [])
    }
  }

  async function createRun() {
    if (!sessionToken) return
    setRunCreating(true)
    setRunMsg('')
    const res = await fetch('/api/payroll/run', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodStart: runPeriodStart, periodEnd: runPeriodEnd, notes: runNotes.trim() || undefined }),
    })
    const data = await res.json()
    if (!res.ok) {
      setRunMsg(data.error ?? 'Failed to create run.')
    } else {
      setRunMsg('Run created.')
      await reloadRuns(sessionToken)
      setTimeout(() => setRunMsg(''), 3000)
    }
    setRunCreating(false)
  }

  async function finalizeRun(runId: number) {
    if (!sessionToken) return
    await fetch(`/api/payroll/run/${runId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'finalize' }),
    })
    await reloadRuns(sessionToken)
    // Reload items for this run if expanded
    loadRunItems(runId, sessionToken)
  }

  async function saveDeductions(item: PayrollRunItem) {
    if (!sessionToken) return
    setSavingDeductions(item.id)
    const ed = editDeductions[item.id] ?? { federal: '0', state: '0', other: '0' }
    const deductions = {
      federal: parseFloat(ed.federal) || 0,
      state: parseFloat(ed.state) || 0,
      other: parseFloat(ed.other) || 0,
    }
    const res = await fetch(`/api/payroll/run/${item.run_id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: item.id, deductions }),
    })
    if (res.ok) {
      setEditDeductions(prev => { const n = { ...prev }; delete n[item.id]; return n })
      await loadRunItems(item.run_id, sessionToken)
      await reloadRuns(sessionToken)
    }
    setSavingDeductions(null)
  }

  function downloadPayStubs(runId: number, employeeId?: number) {
    if (!sessionToken) return
    const url = employeeId
      ? `/api/payroll/run/${runId}/paystub?employeeId=${employeeId}`
      : `/api/payroll/run/${runId}/paystub`
    fetch(url, { headers: { Authorization: `Bearer ${sessionToken}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = employeeId ? `paystub-${employeeId}-${runId}.pdf` : `paystubs-${runId}.pdf`
        a.click()
        URL.revokeObjectURL(a.href)
      })
  }

  function downloadReport(run: PayrollRun) {
    if (!sessionToken) return
    fetch(`/api/payroll/run/${run.id}/report`, { headers: { Authorization: `Bearer ${sessionToken}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `payroll-report-${run.period_end}.pdf`
        a.click()
        URL.revokeObjectURL(a.href)
      })
  }

  function exportRunCSV(run: PayrollRun, items: PayrollRunItem[]) {
    const rows = [
      ['Employee', 'Pay Type', 'Hours Worked', 'Pay Rate', 'Gross Pay', 'Federal Tax', 'State Tax', 'Other Deductions', 'Net Pay'],
      ...items.map(item => {
        const d = (item.deductions ?? {}) as Record<string, number>
        return [
          item.employee_name,
          item.pay_type,
          item.hours_worked != null ? item.hours_worked : '',
          item.pay_rate,
          item.gross_pay,
          d.federal ?? 0,
          d.state ?? 0,
          d.other ?? 0,
          item.net_pay,
        ]
      }),
      ['TOTAL', '', '', '',
        items.reduce((s, i) => s + i.gross_pay, 0),
        items.reduce((s, i) => s + ((i.deductions as any)?.federal ?? 0), 0),
        items.reduce((s, i) => s + ((i.deductions as any)?.state ?? 0), 0),
        items.reduce((s, i) => s + ((i.deductions as any)?.other ?? 0), 0),
        items.reduce((s, i) => s + i.net_pay, 0),
      ],
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `payroll-${run.period_end}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const totalThisPeriod = entries
    .filter(e => e.period_start === defaultPeriod.start)
    .reduce((sum, e) => sum + e.gross_pay, 0)

  const totalAllTime = entries.reduce((sum, e) => sum + e.gross_pay, 0)

  const empEntryMap: Record<number, PayrollEntry[]> = {}
  entries.forEach(e => {
    if (!empEntryMap[e.employee_id]) empEntryMap[e.employee_id] = []
    empEntryMap[e.employee_id].push(e)
  })

  return (
    <div className="dash-wrap">
      <Nav active="payroll" />

      <div className="dash-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 700 }}>Payroll</div>
            <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>Pay periods vary by employee</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {entries.length > 0 && (
              <button className="btn" style={{ fontSize: '13px', padding: '7px 14px' }} onClick={exportCSV}>Export CSV</button>
            )}
            <button className="btn auth-btn-primary" style={{ width: 'auto', fontSize: '13px', padding: '7px 16px' }} onClick={() => setShowForm(v => !v)}>
              {showForm ? 'Cancel' : '+ Log payment'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="dash-stats" style={{ marginBottom: '1.5rem' }}>
          <div className="stat-card">
            <div className="stat-label">This period</div>
            <div className="stat-value">{formatMoney(totalThisPeriod)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total paid (all time)</div>
            <div className="stat-value">{formatMoney(totalAllTime)}</div>
          </div>
        </div>

        {/* Log payment form */}
        {showForm && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '1rem' }}>Log a payment</div>
            <div className="row2" style={{ marginBottom: '0.75rem' }}>
              <div className="field">
                <label>Employee</label>
                <select value={selectedEmpId ?? ''} onChange={e => {
                  const id = Number(e.target.value)
                  setSelectedEmpId(id)
                  const emp = employees.find(em => em.id === id)
                  if (emp?.pay_period) {
                    const p = getPeriodForType(emp.pay_period as PayPeriod)
                    setPayPeriodType(emp.pay_period as PayPeriod)
                    setPeriodStart(p.start)
                    setPeriodEnd(p.end)
                  }
                }}>
                  <option value="">Select employee...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} — {emp.pay_type === 'salary' ? `${formatMoney(emp.pay_rate ?? 0)}/yr` : `${formatMoney(emp.pay_rate ?? 0)}/hr`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Pay period</label>
                <select value={payPeriodType} onChange={e => handlePeriodTypeChange(e.target.value as PayPeriod)}>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="semi-monthly">Semi-monthly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>
            <div className="row2" style={{ marginBottom: '0.75rem' }}>
              <div className="field">
                <label>Period start</label>
                <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
              </div>
              <div className="field">
                <label>Period end</label>
                <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
              </div>
            </div>
            {selectedEmp?.pay_type === 'hourly' && (
              <div className="field" style={{ marginBottom: '0.75rem' }}>
                <label>Hours worked</label>
                <input type="number" value={hours} onChange={e => setHours(e.target.value)} placeholder="80" step="0.5" />
              </div>
            )}
            {selectedEmp?.pay_rate && (selectedEmp.pay_type === 'salary' || hours) ? (
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#185fa5', marginBottom: '0.75rem' }}>
                Gross pay: {formatMoney(calcGrossPay())}
              </div>
            ) : null}
            <div className="field" style={{ marginBottom: '0.75rem' }}>
              <label>Notes (optional)</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. included overtime" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button className="btn auth-btn-primary" style={{ width: 'auto' }} onClick={handleSubmit} disabled={saving}>
                {saving ? 'Saving...' : 'Save payment'}
              </button>
              {saveMsg && <div className="done-msg">{saveMsg}</div>}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="profile-tabs" style={{ marginBottom: '1rem' }}>
          <button className={`profile-tab${activeTab === 'dashboard' ? ' active' : ''}`} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
          <button className={`profile-tab${activeTab === 'overview' ? ' active' : ''}`} onClick={() => setActiveTab('overview')}>By employee</button>
          <button className={`profile-tab${activeTab === 'history' ? ' active' : ''}`} onClick={() => setActiveTab('history')}>Full history</button>
          <button className={`profile-tab${activeTab === 'runs' ? ' active' : ''}`} onClick={() => setActiveTab('runs')}>Pay runs</button>
        </div>

        {loading ? (
          <div className="card"><div className="empty-state">Loading...</div></div>
        ) : activeTab === 'dashboard' ? (() => {
          const now = new Date()
          const thisMonth = now.getMonth()
          const thisYear = now.getFullYear()

          // YTD
          const ytd = entries.filter(e => new Date(e.period_start).getFullYear() === thisYear)
            .reduce((s, e) => s + e.gross_pay, 0)

          // This month
          const monthTotal = entries.filter(e => {
            const d = new Date(e.period_start)
            return d.getMonth() === thisMonth && d.getFullYear() === thisYear
          }).reduce((s, e) => s + e.gross_pay, 0)

          // Last 12 periods grouped by month
          const byMonth: Record<string, number> = {}
          entries.forEach(e => {
            const d = new Date(e.period_start)
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            byMonth[key] = (byMonth[key] || 0) + e.gross_pay
          })
          const sortedMonths = Object.keys(byMonth).sort().slice(-12)
          const monthValues = sortedMonths.map(k => byMonth[k])
          const maxMonthVal = Math.max(...monthValues, 1)

          // Cost by employee
          const empTotals: Record<number, number> = {}
          entries.forEach(e => { empTotals[e.employee_id] = (empTotals[e.employee_id] || 0) + e.gross_pay })
          const sortedEmps = Object.entries(empTotals)
            .map(([id, total]) => ({ emp: employees.find(em => em.id === Number(id)), total }))
            .filter(x => x.emp)
            .sort((a, b) => b.total - a.total)
            .slice(0, 8)
          const maxEmpVal = Math.max(...sortedEmps.map(x => x.total), 1)

          // Pay type split
          const hourlyCount = employees.filter(e => e.pay_type !== 'salary').length
          const salaryCount = employees.filter(e => e.pay_type === 'salary').length
          const totalEmps = employees.length || 1

          const avgPerPeriod = entries.length > 0
            ? entries.reduce((s, e) => s + e.gross_pay, 0) / new Set(entries.map(e => e.period_start)).size
            : 0

          const labelMonth = (key: string) => {
            const [y, m] = key.split('-')
            return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
          }

          return (
            <div>
              {entries.length === 0 ? (
                <div className="card"><div className="empty-state">No payroll data yet — log some payments to see your dashboard.</div></div>
              ) : (
                <>
                  {/* Stat cards */}
                  <div className="dash-stats" style={{ marginBottom: '1.5rem' }}>
                    <div className="stat-card">
                      <div className="stat-label">This month</div>
                      <div className="stat-value">{formatMoney(monthTotal)}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">YTD {thisYear}</div>
                      <div className="stat-value">{formatMoney(ytd)}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Avg per period</div>
                      <div className="stat-value">{formatMoney(avgPerPeriod)}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Active employees</div>
                      <div className="stat-value">{employees.length}</div>
                    </div>
                  </div>

                  {/* Payroll over time */}
                  {sortedMonths.length > 1 && (
                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '1.25rem' }}>Payroll by month</div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '140px', paddingBottom: '24px', position: 'relative' }}>
                        {sortedMonths.map((key, i) => {
                          const val = byMonth[key]
                          const pct = val / maxMonthVal
                          const barH = Math.max(pct * 116, 4)
                          const isCurrentMonth = key === `${thisYear}-${String(thisMonth + 1).padStart(2, '0')}`
                          return (
                            <div key={key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '140px', justifyContent: 'flex-end' }}>
                              <div style={{ fontSize: '10px', color: '#185fa5', fontWeight: 600, opacity: pct > 0.5 ? 1 : 0 }}>
                                {formatMoney(val).replace('$', '$').split('.')[0]}
                              </div>
                              <div
                                title={`${labelMonth(key)}: ${formatMoney(val)}`}
                                style={{
                                  width: '100%', height: `${barH}px`, borderRadius: '4px 4px 0 0',
                                  background: isCurrentMonth ? '#185fa5' : '#c2d4f0',
                                  transition: 'height 0.3s',
                                }}
                              />
                              <div style={{ fontSize: '9px', color: '#999', textAlign: 'center', position: 'absolute', bottom: 0, width: `${100 / sortedMonths.length}%`, left: `${(i / sortedMonths.length) * 100}%` }}>
                                {labelMonth(key)}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                    {/* Cost by employee */}
                    {sortedEmps.length > 0 && (
                      <div className="card">
                        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '1rem' }}>Cost by employee</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {sortedEmps.map(({ emp, total }) => (
                            <div key={emp!.id}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                                <span style={{ fontWeight: 500 }}>{emp!.name}</span>
                                <span style={{ color: '#185fa5', fontWeight: 600 }}>{formatMoney(total)}</span>
                              </div>
                              <div style={{ height: '6px', background: '#f0f2f7', borderRadius: '3px' }}>
                                <div style={{ height: '100%', width: `${(total / maxEmpVal) * 100}%`, background: '#185fa5', borderRadius: '3px' }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Pay type split */}
                    <div className="card">
                      <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '1rem' }}>Pay type</div>
                      {employees.length === 0 ? (
                        <div style={{ fontSize: '13px', color: '#999' }}>No employees.</div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                            <div style={{ flex: 1, textAlign: 'center', background: '#f0f4fb', borderRadius: '8px', padding: '12px' }}>
                              <div style={{ fontSize: '24px', fontWeight: 700, color: '#185fa5' }}>{hourlyCount}</div>
                              <div style={{ fontSize: '12px', color: '#666' }}>Hourly</div>
                            </div>
                            <div style={{ flex: 1, textAlign: 'center', background: '#f0faf4', borderRadius: '8px', padding: '12px' }}>
                              <div style={{ fontSize: '24px', fontWeight: 700, color: '#27ae60' }}>{salaryCount}</div>
                              <div style={{ fontSize: '12px', color: '#666' }}>Salary</div>
                            </div>
                          </div>
                          <div style={{ height: '8px', background: '#f0f2f7', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${(hourlyCount / totalEmps) * 100}%`, background: '#185fa5', borderRadius: '4px' }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#999', marginTop: '4px' }}>
                            <span>{Math.round((hourlyCount / totalEmps) * 100)}% hourly</span>
                            <span>{Math.round((salaryCount / totalEmps) * 100)}% salary</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )
        })() : activeTab === 'overview' ? (
          <div className="card">
            {employees.length === 0 ? (
              <div className="empty-state">No active employees.</div>
            ) : (
              <div className="upload-list">
                {employees.map(emp => {
                  const empEntries = empEntryMap[emp.id] || []
                  const total = empEntries.reduce((sum, e) => sum + e.gross_pay, 0)
                  const last = empEntries[0]
                  return (
                    <div key={emp.id} className="upload-item" style={{ cursor: 'pointer' }} onClick={() => router.push(`/employees/${emp.id}`)}>
                      <div className="emp-initials">{emp.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2)}</div>
                      <div style={{ flex: 1 }}>
                        <div className="upload-name">{emp.name}</div>
                        <div className="upload-meta">
                          {emp.pay_type === 'salary'
                            ? `${formatMoney(emp.pay_rate ?? 0)}/yr`
                            : `${formatMoney(emp.pay_rate ?? 0)}/hr`}
                          {' · '}
                          {emp.pay_period ? emp.pay_period.charAt(0).toUpperCase() + emp.pay_period.slice(1) : 'Biweekly'}
                          {' · '}
                          {(() => { const p = getPeriodForType((emp.pay_period || 'biweekly') as PayPeriod); return `${formatDate(p.start)} – ${formatDate(p.end)}` })()}
                          {last ? ` · Last paid ${formatDate(last.paid_at)}` : ' · Not yet paid'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 600, color: '#185fa5' }}>{formatMoney(total)}</div>
                        <div style={{ fontSize: '12px', color: '#999' }}>total paid</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : activeTab === 'runs' ? (
          <div>
            {/* Run payroll form */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontWeight: 600, marginBottom: '1rem' }}>Run payroll</div>
              <div className="row2" style={{ marginBottom: '0.75rem' }}>
                <div className="field">
                  <label>Period start</label>
                  <input type="date" value={runPeriodStart} onChange={e => setRunPeriodStart(e.target.value)} />
                </div>
                <div className="field">
                  <label>Period end</label>
                  <input type="date" value={runPeriodEnd} onChange={e => setRunPeriodEnd(e.target.value)} />
                </div>
              </div>
              <div className="field" style={{ marginBottom: '0.75rem' }}>
                <label>Notes (optional)</label>
                <input value={runNotes} onChange={e => setRunNotes(e.target.value)} placeholder="e.g. regular biweekly run" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button className="btn auth-btn-primary" style={{ width: 'auto' }} onClick={createRun} disabled={runCreating}>
                  {runCreating ? 'Processing...' : 'Run payroll'}
                </button>
                {runMsg && <div className="done-msg">{runMsg}</div>}
              </div>
            </div>

            {/* Past runs */}
            {runs.length === 0 ? (
              <div className="card"><div className="empty-state">No payroll runs yet.</div></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {runs.map(run => {
                  const isExpanded = expandedRun === run.id
                  const items = runItems[run.id] ?? []
                  return (
                    <div key={run.id} className="card">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
                        onClick={() => {
                          if (!isExpanded) {
                            setExpandedRun(run.id)
                            if (!runItems[run.id] && sessionToken) loadRunItems(run.id, sessionToken)
                          } else {
                            setExpandedRun(null)
                          }
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '14px' }}>
                            {formatDate(run.period_start)} – {formatDate(run.period_end)}
                          </div>
                          <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
                            {run.employee_count} employee{run.employee_count !== 1 ? 's' : ''} · run on {formatDate(run.run_date)}
                            {run.notes ? ` · ${run.notes}` : ''}
                          </div>
                        </div>
                        <div style={{ fontWeight: 700, color: '#185fa5', fontSize: '15px' }}>{formatMoney(run.total_gross)}</div>
                        <span style={{
                          fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px',
                          background: run.status === 'finalized' ? '#f0faf4' : '#fff8e1',
                          color: run.status === 'finalized' ? '#27ae60' : '#c77700',
                        }}>
                          {run.status === 'finalized' ? 'Finalized' : 'Draft'}
                        </span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>

                      {isExpanded && (
                        <div style={{ marginTop: '1rem', borderTop: '1px solid #f0f2f7', paddingTop: '1rem' }}>
                          {items.length === 0 ? (
                            <div style={{ fontSize: '13px', color: '#999' }}>Loading...</div>
                          ) : (
                            <>
                              <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '1rem' }}>
                                  <thead>
                                    <tr style={{ background: '#f7f9fc' }}>
                                      <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: '#666' }}>Employee</th>
                                      <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600, color: '#666' }}>Gross</th>
                                      <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600, color: '#666' }}>Federal</th>
                                      <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600, color: '#666' }}>State</th>
                                      <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600, color: '#666' }}>Other</th>
                                      <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600, color: '#185fa5' }}>Net pay</th>
                                      {run.status === 'draft' && <th style={{ padding: '8px 10px' }}></th>}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {items.map(item => {
                                      const ed = editDeductions[item.id] ?? {
                                        federal: String(item.deductions?.federal ?? 0),
                                        state: String(item.deductions?.state ?? 0),
                                        other: String(item.deductions?.other ?? 0),
                                      }
                                      const isDirty = editDeductions[item.id] !== undefined
                                      const previewNet = isDirty
                                        ? item.gross_pay - ((parseFloat(ed.federal) || 0) + (parseFloat(ed.state) || 0) + (parseFloat(ed.other) || 0))
                                        : item.net_pay
                                      return (
                                        <tr key={item.id} style={{ borderBottom: '1px solid #f0f2f7' }}>
                                          <td style={{ padding: '8px 10px' }}>
                                            <div style={{ fontWeight: 500 }}>{item.employee_name}</div>
                                            <div style={{ fontSize: '11px', color: '#999' }}>
                                              {item.pay_type === 'salary' ? 'Salary' : `${item.hours_worked ?? 0} hrs`}
                                            </div>
                                          </td>
                                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 500 }}>{formatMoney(item.gross_pay)}</td>
                                          {run.status === 'draft' ? (
                                            <>
                                              {(['federal', 'state', 'other'] as const).map(key => (
                                                <td key={key} style={{ padding: '4px 6px', textAlign: 'right' }}>
                                                  <input type="number" value={ed[key]} min="0" step="0.01"
                                                    style={{ width: '72px', textAlign: 'right', padding: '4px 6px', border: '1px solid #e5e7eb', borderRadius: '4px', fontSize: '12px' }}
                                                    onChange={e => setEditDeductions(prev => ({ ...prev, [item.id]: { ...ed, [key]: e.target.value } }))}
                                                  />
                                                </td>
                                              ))}
                                              <td style={{ padding: '8px 10px', textAlign: 'right', color: '#185fa5', fontWeight: 600 }}>
                                                {formatMoney(previewNet)}
                                              </td>
                                              <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                                                {isDirty && (
                                                  <button className="btn" style={{ fontSize: '11px', padding: '3px 10px' }}
                                                    disabled={savingDeductions === item.id}
                                                    onClick={() => saveDeductions(item)}
                                                  >
                                                    {savingDeductions === item.id ? '...' : 'Save'}
                                                  </button>
                                                )}
                                              </td>
                                            </>
                                          ) : (
                                            <>
                                              <td style={{ padding: '8px 10px', textAlign: 'right', color: '#666' }}>{formatMoney(item.deductions?.federal ?? 0)}</td>
                                              <td style={{ padding: '8px 10px', textAlign: 'right', color: '#666' }}>{formatMoney(item.deductions?.state ?? 0)}</td>
                                              <td style={{ padding: '8px 10px', textAlign: 'right', color: '#666' }}>{formatMoney(item.deductions?.other ?? 0)}</td>
                                              <td style={{ padding: '8px 10px', textAlign: 'right', color: '#185fa5', fontWeight: 600 }}>{formatMoney(item.net_pay)}</td>
                                            </>
                                          )}
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <button className="btn" style={{ fontSize: '12px', padding: '6px 12px' }}
                                  onClick={() => downloadReport(run)}>
                                  Accountant report (PDF)
                                </button>
                                <button className="btn" style={{ fontSize: '12px', padding: '6px 12px' }}
                                  onClick={() => exportRunCSV(run, items)}>
                                  Export CSV
                                </button>
                                <button className="btn" style={{ fontSize: '12px', padding: '6px 12px' }}
                                  onClick={() => downloadPayStubs(run.id)}>
                                  All pay stubs
                                </button>
                                {run.status === 'draft' && (
                                  <button className="btn auth-btn-primary" style={{ width: 'auto', fontSize: '12px', padding: '6px 12px' }}
                                    onClick={() => finalizeRun(run.id)}>
                                    Finalize run
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="card">
            {entries.length === 0 ? (
              <div className="empty-state">No payments logged yet.</div>
            ) : (
              <div className="upload-list">
                {entries.map(entry => {
                  const emp = employees.find(e => e.id === entry.employee_id)
                  return (
                    <div key={entry.id} className="upload-item">
                      <div className="upload-icon"><DollarIcon size={16} color="#185fa5" /></div>
                      <div style={{ flex: 1 }}>
                        <div className="upload-name">{emp?.name ?? 'Unknown'}</div>
                        <div className="upload-meta">
                          {formatDate(entry.period_start)} – {formatDate(entry.period_end)}
                          {entry.hours_worked != null ? ` · ${entry.hours_worked} hrs` : ''}
                          {entry.notes ? ` · ${entry.notes}` : ''}
                        </div>
                      </div>
                      <span style={{ fontWeight: 600, color: '#185fa5', fontSize: '14px' }}>{formatMoney(entry.gross_pay)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
