import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../src/lib/auth-context'

export default function Profile() {
  const { profile, signOut } = useAuth()
  const router = useRouter()

  async function handleSignOut() {
    await signOut()
    router.replace('/(auth)/login')
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.name}>{profile?.name ?? 'Loading…'}</Text>
        <Text style={styles.role}>{profile?.role}</Text>
        <Text style={styles.email}>{profile?.email}</Text>

        {/* Owner/admin/manager accounts get a link into the admin dashboard
            once it's built — same access_role check the web app's Nav uses. */}
        {profile && profile.access_role !== 'employee' && (
          <Pressable style={styles.adminLink} onPress={() => router.push('/(admin)')}>
            <Text style={styles.adminLinkText}>Open admin dashboard →</Text>
          </Pressable>
        )}
      </View>

      <Pressable style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0b0f14', padding: 16, justifyContent: 'space-between' },
  card: { backgroundColor: '#11161d', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  name: { color: '#f1f5f9', fontSize: 20, fontWeight: '800' },
  role: { color: '#4ade80', fontSize: 13, marginTop: 4, textTransform: 'capitalize' },
  email: { color: '#64748b', fontSize: 13, marginTop: 2 },
  adminLink: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  adminLinkText: { color: '#4ade80', fontSize: 13, fontWeight: '600' },
  signOutButton: { borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)', borderRadius: 12, padding: 14, alignItems: 'center' },
  signOutText: { color: '#f87171', fontWeight: '700', fontSize: 14 },
})
