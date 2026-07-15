// Owner/manager approvals screen (JAY-40) — replaces the earlier placeholder.
// Smallest possible slice per the issue's own validation gut-check: read plus
// approve/deny only, no editing or creation. Backed by GET
// /api/dashboard/pending-approvals (new, read-only, mirrors the web
// Dashboard's "Needs your attention" panel) and the existing PATCH
// /api/time-off/[id] and PATCH /api/shifts/swaps/[id] routes the web app
// already uses for approve/deny — no new mutation logic. Callouts are shown
// read-only: "finding cover" on web opens a whole eligible-employee picker
// flow (CalloutModal), which is out of scope for this first mobile slice.
import { useCallback, useEffect, useState } from 'react'
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { api, ApiError } from '../../src/lib/api'
import { useAuth } from '../../src/lib/auth-context'
import type { PendingTimeOff, PendingSwap, PendingCallout } from '../../src/types'

type Approvals = { timeOff: PendingTimeOff[]; swaps: PendingSwap[]; callouts: PendingCallout[] }
type Row =
  | { kind: 'timeOff'; data: PendingTimeOff }
  | { kind: 'swap'; data: PendingSwap }
  | { kind: 'callout'; data: PendingCallout }

function fmtDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtTime(t: string) {
  const [h, m] = t.split(':')
  const hour = parseInt(h, 10)
  return `${hour % 12 || 12}:${m} ${hour < 12 ? 'AM' : 'PM'}`
}

export default function AdminHome() {
  const { profile } = useAuth()
  const [approvals, setApprovals] = useState<Approvals>({ timeOff: [], swaps: [], callouts: [] })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [acting, setActing] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const data = await api.get<Approvals>('/api/dashboard/pending-approvals')
      setApprovals(data)
      setError('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load approvals.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function decide(id: number, status: 'approved' | 'denied') {
    const key = `pto_${id}`
    setActing(key)
    try {
      await api.patch(`/api/time-off/${id}`, { status })
      setApprovals(prev => ({ ...prev, timeOff: prev.timeOff.filter(r => r.id !== id) }))
    } catch {
      setError('Could not update that request.')
    } finally {
      setActing(null)
    }
  }

  async function decideSwap(id: number, status: 'approved' | 'denied') {
    const key = `swap_${id}`
    setActing(key)
    try {
      await api.patch(`/api/shifts/swaps/${id}`, { status })
      setApprovals(prev => ({ ...prev, swaps: prev.swaps.filter(s => s.id !== id) }))
    } catch {
      setError('Could not update that swap.')
    } finally {
      setActing(null)
    }
  }

  const rows: Row[] = [
    ...approvals.timeOff.map(data => ({ kind: 'timeOff' as const, data })),
    ...approvals.swaps.map(data => ({ kind: 'swap' as const, data })),
    ...approvals.callouts.map(data => ({ kind: 'callout' as const, data })),
  ]

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#4ade80" /></View>
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.header}>Approvals</Text>
      <Text style={styles.subheader}>
        {rows.length > 0 ? `Pending (${rows.length})` : 'Nothing waiting on you right now.'}
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={rows}
        keyExtractor={(r, i) => `${r.kind}_${r.data.id}_${i}`}
        contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor="#4ade80" />}
        ListEmptyComponent={
          <Text style={styles.empty}>Signed in as {profile?.access_role}. No pending time off, swaps, or callouts.</Text>
        }
        renderItem={({ item }) => {
          if (item.kind === 'timeOff') {
            const r = item.data
            const key = `pto_${r.id}`
            return (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{r.employee_name} — Time off</Text>
                <Text style={styles.cardSub}>{fmtDate(r.start_date)} – {fmtDate(r.end_date)} · {r.type}{r.reason ? ` · "${r.reason}"` : ''}</Text>
                <View style={styles.actionRow}>
                  <Pressable style={[styles.btn, styles.btnApprove]} disabled={acting === key} onPress={() => decide(r.id, 'approved')}>
                    <Text style={styles.btnApproveText}>{acting === key ? '…' : 'Approve'}</Text>
                  </Pressable>
                  <Pressable style={[styles.btn, styles.btnDeny]} disabled={acting === key} onPress={() => decide(r.id, 'denied')}>
                    <Text style={styles.btnDenyText}>Deny</Text>
                  </Pressable>
                </View>
              </View>
            )
          }
          if (item.kind === 'swap') {
            const s = item.data
            const key = `swap_${s.id}`
            return (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{s.requester_name} → {s.target_name ?? 'Open'} — Shift swap</Text>
                <Text style={styles.cardSub}>{s.shift_date ? fmtDate(s.shift_date) : 'Date unavailable'}</Text>
                <View style={styles.actionRow}>
                  <Pressable style={[styles.btn, styles.btnApprove]} disabled={acting === key} onPress={() => decideSwap(s.id, 'approved')}>
                    <Text style={styles.btnApproveText}>{acting === key ? '…' : 'Approve'}</Text>
                  </Pressable>
                  <Pressable style={[styles.btn, styles.btnDeny]} disabled={acting === key} onPress={() => decideSwap(s.id, 'denied')}>
                    <Text style={styles.btnDenyText}>Deny</Text>
                  </Pressable>
                </View>
              </View>
            )
          }
          const c = item.data
          return (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{c.employee_name} — Called out</Text>
              <Text style={styles.cardSub}>
                Today {fmtTime(c.start_time)}–{fmtTime(c.end_time)}{c.employee_role ? ` · ${c.employee_role}` : ''}
              </Text>
              <Text style={styles.calloutHint}>Find cover from the web dashboard.</Text>
            </View>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0b0f14' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b0f14' },
  header: { color: '#f1f5f9', fontSize: 20, fontWeight: '800', paddingHorizontal: 16, paddingTop: 16 },
  subheader: { color: '#64748b', fontSize: 13, paddingHorizontal: 16, marginTop: 4 },
  error: { color: '#f87171', fontSize: 12, paddingHorizontal: 16, marginTop: 8 },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 40, fontSize: 13 },
  card: { backgroundColor: '#11161d', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  cardTitle: { color: '#f1f5f9', fontWeight: '700', fontSize: 13 },
  cardSub: { color: '#94a3b8', fontSize: 12, marginTop: 3 },
  calloutHint: { color: '#fca5a5', fontSize: 11, marginTop: 6 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', borderWidth: 1 },
  btnApprove: { backgroundColor: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.35)' },
  btnApproveText: { color: '#4ade80', fontWeight: '700', fontSize: 12 },
  btnDeny: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' },
  btnDenyText: { color: '#94a3b8', fontWeight: '600', fontSize: 12 },
})
