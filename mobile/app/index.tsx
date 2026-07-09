import { Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { useAuth } from '../src/lib/auth-context'

// Root entry point — routes to the right stack based on auth state.
// Everything past this point mirrors the web app's split between
// /employee/* (employee portal) and the owner dashboard.
export default function Index() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b0f14' }}>
        <ActivityIndicator color="#4ade80" />
      </View>
    )
  }

  return <Redirect href={session ? '/(app)/schedule' : '/(auth)/login'} />
}
