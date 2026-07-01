'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const DEFAULT_ITEMS = [
  'Keys / access cards returned',
  'Equipment returned (uniform, devices, tools)',
  'System access revoked (email, POS, software)',
  'Final paycheck processed',
  'Unused PTO paid out (if applicable)',
  'Exit interview completed',
]

export default function OffboardingSettings() {
  const [offboardingTemplate, setOffboardingTemplate] = useState('')
  const [checklistItems, setChecklistItems] = useState<string[]>(DEFAULT_ITEMS)
  const [newItem, setNewItem] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [userId, setUserId] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { window.location.href = '/login'; return }
    setUserId(session.user.id)
    const { data } = await supabase
      .from('onboarding_templates')
      .select('offboarding_template, offboarding_checklist')
      .eq('user_id', session.user.id)
      .single()
    if (data?.offboarding_template) setOffboardingTemplate(data.offboarding_template)
    if (data?.offboarding_checklist && data.offboarding_checklist.length > 0) {
      setChecklistItems(data.offboarding_checklist)
    }
    setLoading(false)
  }

  function addItem() {
    const val = newItem.trim()
    if (!val) return
    setChecklistItems(prev => [...prev, val])
    setNewItem('')
  }

  function removeItem(i: number) {
    setChecklistItems(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateItem(i: number, val: string) {
    setChecklistItems(prev => prev.map((item, idx) => idx === i ? val : item))
  }

  async function save() {
    setSaving(true)
    setSaveMsg('')
    const { error } = await supabase
      .from('onboarding_templates')
      .upsert({
        user_id: userId,
        offboarding_template: offboardingTemplate,
        offboarding_checklist: checklistItems,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
    setSaveMsg(error ? 'Error saving. Try again.' : 'Saved.')
    if (!error) setTimeout(() => setSaveMsg(''), 2000)
    setSaving(false)
  }

  if (loading) return <div className="dash-content"><div className="loading-state">Loading...</div></div>

  return (
    <div className="dash-wrap">
      <div className="dash-nav">
        <div className="dash-nav-left">
          <div className="logo">help<span>desk</span></div>
        </div>
      </div>

      <div className="dash-content">
        <a href="/" className="back-btn">← Back to dashboard</a>
        <div className="screen-title">Offboarding template</div>

        <div className="card">
          <div className="section-label">Checklist items</div>
          <p style={{ fontSize: '13px', color: '#6b6b6b', marginBottom: '1rem' }}>
            These steps appear every time you offboard someone. Edit, add, or remove to match your process.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
            {checklistItems.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#bbb', fontSize: '13px', userSelect: 'none' }}>☰</span>
                <input
                  value={item}
                  onChange={e => updateItem(i, e.target.value)}
                  style={{ flex: 1, fontSize: '13px' }}
                />
                <button
                  onClick={() => removeItem(i)}
                  style={{ background: 'none', border: 'none', color: '#c0392b', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '0 4px' }}
                >×</button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <input
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addItem()}
              placeholder="Add a step..."
              style={{ flex: 1, fontSize: '13px' }}
            />
            <button className="btn" onClick={addItem}>+ Add</button>
          </div>

          <div className="section-label" style={{ marginTop: '0.5rem' }}>Notes template</div>
          <p style={{ fontSize: '13px', color: '#6b6b6b', marginBottom: '0.75rem' }}>
            Pre-fills the notes field. Use <strong>{'{{employee_name}}'}</strong>, <strong>{'{{lastDay}}'}</strong>, <strong>{'{{reason}}'}</strong>, <strong>{'{{role}}'}</strong>.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {[
              { id: 'employee_name', label: 'Employee name' },
              { id: 'lastDay', label: 'Last day' },
              { id: 'reason', label: 'Reason' },
              { id: 'role', label: 'Role' },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setOffboardingTemplate(prev => prev + `{{${id}}}`)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                  padding: '5px 10px', borderRadius: '6px', border: '1.5px solid #d0d5e8',
                  background: '#f4f6fc', color: '#185fa5', fontSize: '12px', fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#e8edf8')}
                onMouseLeave={e => (e.currentTarget.style.background = '#f4f6fc')}
              >
                <span style={{ fontSize: '10px', opacity: 0.6 }}>[ ]</span> {label}
              </button>
            ))}
          </div>
          <textarea
            value={offboardingTemplate}
            onChange={e => setOffboardingTemplate(e.target.value)}
            placeholder={`{{employee_name}}'s last day is {{lastDay}}.\nReason: {{reason}}\n\nPlease ensure all equipment is returned and system access is revoked.`}
            style={{ minHeight: '160px', fontFamily: 'inherit', fontSize: '14px', marginBottom: '1rem' }}
          />

          <button className="btn auth-btn-primary" onClick={save} disabled={saving} style={{ width: 'auto' }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          {saveMsg && <div className="done-msg" style={{ marginTop: '0.5rem' }}>{saveMsg}</div>}
        </div>
      </div>
    </div>
  )
}
