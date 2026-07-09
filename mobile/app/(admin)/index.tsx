// Placeholder landing screen for the future admin dashboard. Build screens
// here backed by the existing admin API routes (src/app/api/analytics,
// src/app/api/employees/[id], src/app/api/payroll/*, src/app/api/applications,
// etc.) — same pattern as the employee screens: fetch via src/lib/api.ts,
// no new backend logic needed unless a feature genuinely needs it.
import { View, Text, StyleSheet } from 'react-native'
import { useAuth } from '../../src/lib/auth-context'

export default function AdminHome() {
  const { profile } = useAuth()
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Admin dashboard</Text>
      <Text style={styles.body}>
        Signed in as {profile?.access_role}. Not built yet — this screen is reserved for
        scheduling, payroll, hiring, and analytics, mirroring the web dashboard.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0b0f14', alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { color: '#f1f5f9', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  body: { color: '#64748b', fontSize: 13, textAlign: 'center', lineHeight: 19 },
})
