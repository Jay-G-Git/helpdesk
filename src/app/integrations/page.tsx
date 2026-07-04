'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'
import { Suspense } from 'react'
import { ReceiptIcon } from '../components/Icons'

type GustoConnection = {
  company_uuid: string | null
  connected_at: string
  access_token_expires_at: string
}

function IntegrationsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [connection, setConnection] = useState<GustoConnection | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [syncMsg, setSyncMsg] = useState('')
  const [accessToken, setAccessToken] = useState('')

  const justConnected = searchParams.get('connected') === 'gusto'
  const connectError = searchParams.get('error')

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setAccessToken(session.access_token)

    const { data } = await supabase
      .from('gusto_connections')
      .select('company_uuid, connected_at, access_token_expires_at')
      .eq('user_id', session.user.id)
      .single()

    if (data) setConnection(data)
    setLoading(false)
  }

  async function handleConnect() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    window.location.href = `/api/gusto/connect?token=${session.access_token}`
  }

  async function handleDisconnect() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await supabase.from('gusto_connections').delete().eq('user_id', session.user.id)
    setConnection(null)
    setSyncMsg('')
  }

  async function sync(action: 'push_employees' | 'pull_payrolls') {
    setSyncing(action)
    setSyncMsg('')
    const res = await fetch('/api/gusto/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ action }),
    })
    const data = await res.json()
    if (!res.ok) {
      setSyncMsg(`Error: ${data.error}`)
    } else if (action === 'push_employees') {
      const errNote = data.errors?.length ? ` (${data.errors.length} failed)` : ''
      setSyncMsg(`✓ ${data.synced} employee${data.synced !== 1 ? 's' : ''} pushed to Gusto${errNote}.`)
    } else {
      setSyncMsg(`✓ ${data.imported} payroll record${data.imported !== 1 ? 's' : ''} imported from Gusto.`)
    }
    setSyncing(null)
  }

  return (
    <div className="dash-wrap">
      <Nav active="integrations" />
      <div className="dash-content">
        <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '0.4rem' }}>Integrations</div>
        <div style={{ fontSize: '13px', color: '#666', marginBottom: '1.5rem' }}>Connect your tools to keep data in sync.</div>

        {justConnected && (
          <div className="done-msg" style={{ marginBottom: '1rem', fontSize: '13px' }}>✓ Gusto connected successfully.</div>
        )}
        {connectError && (
          <div className="auth-error" style={{ marginBottom: '1rem' }}>
            {connectError === 'gusto_denied' ? 'Gusto authorization was denied.' : 'Something went wrong connecting to Gusto. Try again.'}
          </div>
        )}

        {/* Gusto card */}
        <div className="card" style={{ maxWidth: '520px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
            <div style={{
              width: 40, height: 40, borderRadius: '10px', background: '#f5ece8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}><ReceiptIcon size={20} color="#c0692b" /></div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>Gusto</div>
              <div style={{ fontSize: '12px', color: '#888' }}>Payroll & HR platform</div>
            </div>
            {!loading && (
              <div style={{ marginLeft: 'auto' }}>
                <span style={{
                  fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px',
                  background: connection ? '#e8f8ef' : '#f5f6fa',
                  color: connection ? '#27ae60' : '#9a9a9a',
                }}>
                  {connection ? '● Connected' : '○ Not connected'}
                </span>
              </div>
            )}
          </div>

          <div style={{ fontSize: '13px', color: '#555', marginBottom: '1rem', lineHeight: '1.5' }}>
            Sync your employees to Gusto and pull processed payroll runs back into Helpdesk.
          </div>

          {loading ? (
            <div style={{ fontSize: '13px', color: '#999' }}>Loading...</div>
          ) : connection ? (
            <>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '1rem' }}>
                Connected {new Date(connection.connected_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                {connection.company_uuid && ` · Company ${connection.company_uuid.slice(0, 8)}…`}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                <button
                  className="btn auth-btn-primary"
                  style={{ width: 'auto', fontSize: '13px', padding: '7px 14px' }}
                  onClick={() => sync('push_employees')}
                  disabled={!!syncing}
                >
                  {syncing === 'push_employees' ? 'Syncing…' : '↑ Push employees to Gusto'}
                </button>
                <button
                  className="btn"
                  style={{ fontSize: '13px', padding: '7px 14px' }}
                  onClick={() => sync('pull_payrolls')}
                  disabled={!!syncing}
                >
                  {syncing === 'pull_payrolls' ? 'Importing…' : '↓ Pull payrolls from Gusto'}
                </button>
              </div>
              {syncMsg && (
                <div style={{ fontSize: '13px', color: syncMsg.startsWith('Error') ? '#c0392b' : '#27ae60', marginBottom: '0.75rem' }}>
                  {syncMsg}
                </div>
              )}
              <button
                style={{ fontSize: '12px', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                onClick={handleDisconnect}
              >
                Disconnect Gusto
              </button>
            </>
          ) : (
            <button
              className="btn auth-btn-primary"
              style={{ width: 'auto', fontSize: '13px', padding: '7px 16px' }}
              onClick={handleConnect}
            >
              Connect Gusto
            </button>
          )}
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
