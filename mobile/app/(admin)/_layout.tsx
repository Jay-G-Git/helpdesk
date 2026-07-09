// Gated the same way the web app gates owner/admin/manager screens: check
// access_role on the employee profile (src/app/api/employee/me returns it).
// Not built out yet — this just reserves the route group and the gate so
// admin screens (scheduling, payroll, hiring, integrations, analytics) can
// be added here later, each backed by the same /api routes the web
// dashboard already uses.
import { Stack, Redirect } from 'expo-router'
import { useAuth } from '../../src/lib/auth-context'

export default function AdminLayout() {
  const { profile, loading } = useAuth()

  if (loading) return null
  if (!profile || profile.access_role === 'employee') {
    return <Redirect href="/(app)/schedule" />
  }

  return <Stack screenOptions={{ headerShown: false }} />
}
