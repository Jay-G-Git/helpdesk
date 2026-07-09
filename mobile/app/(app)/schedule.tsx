// Mirrors the employee-facing slice of src/app/time/page.tsx: upcoming
// shifts (next 4 weeks, via /api/employee/shifts) plus clock in/out
// (/api/employee/clock-in, /api/employee/clock-out).
import { useCallback, useEffect, useState } from 'react'
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native'
import { api, ApiError } from '../../src/lib/api'
import type { Shift, TimeEntry } from '../../src/types'

function fmtTime(t: string) {
  const [h, m] = t.split(':')
  const hr = parseInt(h, 10)
  return `${hr % 12 || 12}:${m} ${hr < 12 ? 'AM' : 'PM'}`
}
function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function Schedule() {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [openEntry, setOpenEntry] = useState<TimeEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [clocking, setClocking] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    try {
      const [{ shifts }, { entries }] = await Promise.all([
        api.get<{ shifts: Shift[] }>('/api/employee/shifts'),
        api.get<{ entries: TimeEntry[] }>('/api/employee/time-entries'),
      ])
      setShifts(shifts)
      setOpenEntry(entries.find(e => !e.clock_out) ?? null)
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Failed to load schedule.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleClock() {
    setClocking(true)
    setMessage('')
    try {
      if (openEntry) {
        await api.post('/api/employee/clock-out')
        setOpenEntry(null)
        setMessage('Clocked out.')
      } else {
        const { entry } = await api.post<{ entry: TimeEntry }>('/api/employee/clock-in')
        setOpenEntry(entry)
        setMessage('Clocked in.')
      }
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Something went wrong.')
    } finally {
      setClocking(false)
      setTimeout(() => setMessage(''), 3000)
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#4ade80" />
      </View>
    )
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.clockRow}>
        <Pressable
          style={[styles.clockButton, openEntry && styles.clockButtonActive]}
          onPress={toggleClock}
          disabled={clocking}
        >
          <Text style={[styles.clockButtonText, openEntry && { color: '#0b0f14' }]}>
            {clocking ? '…' : openEntry ? 'Clock Out' : 'Clock In'}
          </Text>
        </Pressable>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>

      <FlatList
        data={shifts}
        keyExtractor={s => String(s.id)}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor="#4ade80" />}
        ListEmptyComponent={<Text style={styles.empty}>No upcoming shifts in the next 4 weeks.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardDate}>{fmtDate(item.shift_date)}</Text>
            <Text style={styles.cardTime}>{fmtTime(item.start_time)} – {fmtTime(item.end_time)}</Text>
            {item.notes ? <Text style={styles.cardNotes}>{item.notes}</Text> : null}
          </View>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0b0f14' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b0f14' },
  clockRow: { padding: 16, gap: 8 },
  clockButton: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 14, alignItems: 'center' },
  clockButtonActive: { backgroundColor: '#4ade80', borderColor: '#4ade80' },
  clockButtonText: { color: '#f1f5f9', fontWeight: '700', fontSize: 15 },
  message: { color: '#4ade80', fontSize: 12, textAlign: 'center' },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 40, fontSize: 13 },
  card: { backgroundColor: '#11161d', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  cardDate: { color: '#f1f5f9', fontWeight: '700', fontSize: 14, marginBottom: 2 },
  cardTime: { color: '#94a3b8', fontSize: 13 },
  cardNotes: { color: '#64748b', fontSize: 12, marginTop: 4, fontStyle: 'italic' },
})
