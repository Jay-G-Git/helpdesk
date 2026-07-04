'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'
import { Suspense } from 'react'
import { ReceiptIcon, CalendarIcon, BookOpenIcon } from '../components/Icons'

type Connection = {
  connected_at: string
  access_token_expires_at: string
}

type GustoConn = Connection & { company_uuid: string | null }
type GoogleConn = Connection
type QBConn = Connection & { realm_id: string }

function IntegrationsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [gusto, setGusto] = useState<GustoConn | null>(null)
  const [google, setGoogle] = useState<GoogleConn | null>(null)
  const [qb, setQb] = useState<QBConn | null>(null)
  const [loading, setLoading] = useState(true)
  const [accessToken, setAccessToken] = useState('')

  const [syncing, setSyncing] = useState<string | null>(null)
  const [syncMsg, setSyncMsg] = useState('')

  const justConnected = searchParams.get('connected')
  const connectError = searchParams.get('error')

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setAccessToken(session.access_token)

    const uid = session.user.id
    const [gustoRes, googleRes, qbRes] = await Promise.all([
      supabase.from('gusto_connections').select('company_uuid, connected_at, access_token_expires_at').eq('user_id', uid).single(),
      supabase.from('google_connections').select('connected_at, access_token_expires_at').eq('user_id', uid).single(),
      supabase.from('quickbooks_connections').select('realm_id, connected_at, access_token_expires_at').eq('user_id', uid).single(),
    ])
    if (gustoRes.data) setGusto(gustoRes.data)
    if (googleRes.data) setGoogle(googleRes.data)
    if (qbRes.data) setQb(qbRes.data)
    setLoading(false)
  }

  async function handleConnect(service: 'gusto' | 'google' | 'quickbooks') {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    window.location.href = `/api/${service}/connect?token=${session.access_token}`
  }

  async function handleDisconnect(service: 'gusto' | 'google' | 'quickbooks') {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const table = service === 'gusto' ? 'gusto_connections' : service === 'google' ? 'google_connections' : 'quickbooks_connections'
    await supabase.from(table).delete().eq('user_id', session.user.id)
    if (service === 'gusto') setGusto(null)
    if (service === 'google') setGoogle(null)
    if (service === 'quickbooks') setQb(null)
    setSyncMsg('')
  }

  async function sync(action: string, endpoint: string, body: object) {
    setSyncing(action)
    setSyncMsg('')
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) {
      setSyncMsg(`Error: ${data.error}`)
    } else {
      setSyncMsg(data.message ?? buildSyncMsg(action, data))
    }
    setSyncing(null)
  }

  function buildSyncMsg(action: string, data: Record<string, unknown>) {
    if (action === 'push_employees') {
      const n = data.synced as number
      return `✓ ${n} employee${n !== 1 ? 's' : ''} pushed to Gusto.`
    }
    if (action === 'pull_payrolls') {
      const n = data.imported as number
      return `✓ ${n} payroll record${n !== 1 ? 's' : ''} imported from Gusto.`
    }
    if (action === 'push_shifts') {
      const n = data.pushed as number
      return `✓ ${n} shift${n !== 1 ? 's' : ''} pushed to Google Calendar.`
    }
    if (action === 'push_payroll') {
      const n = data.pushed as number
      return `✓ ${n} payroll entr${n !== 1 ? 'ies' : 'y'} pushed to QuickBooks.`
    }
    return '✓ Done.'
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const connectedBadge = (
    <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', background: '#e8f8ef', color: '#27ae60' }}>
      ● Connected
    </span>
  )
  const notConnectedBadge = (
    <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', background: '#f5f6fa', color: '#9a9a9a' }}>
      ○ Not connected
    </span>
  )

  return (
    <div className="dash-wrap">
      <Nav active="integrations" />
      <div className="dash-content">
        <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '0.4rem' }}>Integrations</div>
        <div style={{ fontSize: '13px', color: '#666', marginBottom: '1.5rem' }}>Connect your tools to keep data in sync.</div>

        {justConnected && (
          <div className="done-msg" style={{ marginBottom: '1rem', fontSize: '13px' }}>
            ✓ {justConnected === 'gusto' ? 'Gusto' : justConnected === 'google' ? 'Google Calendar' : 'QuickBooks'} connected successfully.
          </div>
        )}
        {connectError && (
          <div className="auth-error" style={{ marginBottom: '1rem' }}>
            {connectError.includes('denied') ? 'Authorization was denied.' : 'Something went wrong. Please try again.'}
          </div>
        )}

        {syncMsg && (
          <div style={{ fontSize: '13px', color: syncMsg.startsWith('Error') ? '#c0392b' : '#27ae60', marginBottom: '1rem' }}>
            {syncMsg}
          </div>
        )}

        <div style={{ display: 'grid', gap: '1rem', maxWidth: '560px' }}>

          {/* Gusto */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
              <div style={{ width: 40, height: 40, borderRadius: '10px', background: '#f5ece8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ReceiptIcon size={20} color="#c0692b" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '15px' }}>Gusto</div>
                <div style={{ fontSize: '12px', color: '#888' }}>Payroll &amp; HR platform</div>
              </div>
              {!loading && <div style={{ marginLeft: 'auto' }}>{gusto ? connectedBadge : notConnectedBadge}</div>}
            </div>
            <div style={{ fontSize: '13px', color: '#555', marginBottom: '1rem', lineHeight: '1.5' }}>
              Sync employees to Gusto and pull processed payroll runs back into Helpdesk.
            </div>
            {loading ? <div style={{ fontSize: '13px', color: '#999' }}>Loading...</div> : gusto ? (
              <>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '1rem' }}>
                  Connected {formatDate(gusto.connected_at)}{gusto.company_uuid && ` · Company ${gusto.company_uuid.slice(0, 8)}…`}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  <button className="btn auth-btn-primary" style={{ width: 'auto', fontSize: '13px', padding: '7px 14px' }}
                    onClick={() => sync('push_employees', '/api/gusto/sync', { action: 'push_employees' })} disabled={!!syncing}>
                    {syncing === 'push_employees' ? 'Syncing…' : '↑ Push employees'}
                  </button>
                  <button className="btn" style={{ fontSize: '13px', padding: '7px 14px' }}
                    onClick={() => sync('pull_payrolls', '/api/gusto/sync', { action: 'pull_payrolls' })} disabled={!!syncing}>
                    {syncing === 'pull_payrolls' ? 'Importing…' : '↓ Pull payrolls'}
                  </button>
                </div>
                <button style={{ fontSize: '12px', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  onClick={() => handleDisconnect('gusto')}>Disconnect Gusto</button>
              </>
            ) : (
              <button className="btn auth-btn-primary" style={{ width: 'auto', fontSize: '13px', padding: '7px 16px' }}
                onClick={() => handleConnect('gusto')}>Connect Gusto</button>
            )}
          </div>

          {/* Google Calendar */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
              <div style={{ width: 40, height: 40, borderRadius: '10px', background: '#e8f0fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CalendarIcon size={20} color="#1a73e8" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '15px' }}>Google Calendar</div>
                <div style={{ fontSize: '12px', color: '#888' }}>Schedule sync</div>
              </div>
              {!loading && <div style={{ marginLeft: 'auto' }}>{google ? connectedBadge : notConnectedBadge}</div>}
            </div>
            <div style={{ fontSize: '13px', color: '#555', marginBottom: '1rem', lineHeight: '1.5' }}>
              Push employee shifts from the Schedule page directly to your Google Calendar.
            </div>
            {loading ? <div style={{ fontSize: '13px', color: '#999' }}>Loading...</div> : google ? (
              <>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '1rem' }}>Connected {formatDate(google.connected_at)}</div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  <button className="btn auth-btn-primary" style={{ width: 'auto', fontSize: '13px', padding: '7px 14px' }}
                    onClick={() => sync('push_shifts', '/api/google/sync', {})} disabled={!!syncing}>
                    {syncing === 'push_shifts' ? 'Syncing…' : '↑ Push this week\'s shifts'}
                  </button>
                </div>
                <button style={{ fontSize: '12px', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  onClick={() => handleDisconnect('google')}>Disconnect Google Calendar</button>
              </>
            ) : (
              <button className="btn auth-btn-primary" style={{ width: 'auto', fontSize: '13px', padding: '7px 16px' }}
                onClick={() => handleConnect('google')}>Connect Google Calendar</button>
            )}
          </div>

          {/* QuickBooks */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
              <div style={{ width: 40, height: 40, borderRadius: '10px', background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <BookOpenIcon size={20} color="#2e7d32" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '15px' }}>QuickBooks</div>
                <div style={{ fontSize: '12px', color: '#888' }}>Accounting sync</div>
              </div>
              {!loading && <div style={{ marginLeft: 'auto' }}>{qb ? connectedBadge : notConnectedBadge}</div>}
            </div>
            <div style={{ fontSize: '13px', color: '#555', marginBottom: '1rem', lineHeight: '1.5' }}>
              Push payroll entries to QuickBooks as expenses so your books stay current automatically.
            </div>
            {loading ? <div style={{ fontSize: '13px', color: '#999' }}>Loading...</div> : qb ? (
              <>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '1rem' }}>
                  Connected {formatDate(qb.connected_at)} · Realm {qb.realm_id}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  <button className="btn auth-btn-primary" style={{ width: 'auto', fontSize: '13px', padding: '7px 14px' }}
                    onClick={() => sync('push_payroll', '/api/quickbooks/sync', {})} disabled={!!syncing}>
                    {syncing === 'push_payroll' ? 'Syncing…' : '↑ Push this month\'s payroll'}
                  </button>
                </div>
                <button style={{ fontSize: '12px', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  onClick={() => handleDisconnect('quickbooks')}>Disconnect QuickBooks</button>
              </>
            ) : (
              <button className="btn auth-btn-primary" style={{ width: 'auto', fontSize: '13px', padding: '7px 16px' }}
                onClick={() => handleConnect('quickbooks')}>Connect QuickBooks</button>
            )}
          </div>

          {/* Indeed */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
              <div style={{ width: 40, height: 40, borderRadius: '10px', background: '#fff3e0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {/* Indeed "i" wordmark style icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e65100" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="5" r="1.5" fill="#e65100" stroke="none" />
                  <line x1="12" y1="9" x2="12" y2="20" />
                  <path d="M8 20h8" />
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '15px' }}>Indeed</div>
                <div style={{ fontSize: '12px', color: '#888' }}>Job board publishing</div>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', background: '#fff8f0', color: '#e65100' }}>
                  Via Jobs page
                </span>
              </div>
            </div>
            <div style={{ fontSize: '13px', color: '#555', marginBottom: '1rem', lineHeight: '1.5' }}>
              Post your open jobs to Indeed directly from the Jobs page. Each listing includes a pre-formatted description ready to paste into Indeed&apos;s employer portal.
            </div>
            <a
              href="/jobs"
              className="btn auth-btn-primary"
              style={{ width: 'auto', fontSize: '13px', padding: '7px 16px', display: 'inline-block', textDecoration: 'none' }}
            >
              Go to Jobs page →
            </a>
          </div>

        </div>
      </div>
    </div>
  )
}

export default function IntegrationsPage() {
  return (
    <Suspense>
      <IntegrationsContent />
    </Suspense>
  )
}
