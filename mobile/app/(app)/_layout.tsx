import { Tabs } from 'expo-router'
import { Redirect } from 'expo-router'
import { Text } from 'react-native'
import { useAuth } from '../../src/lib/auth-context'

function TabIcon({ symbol }: { symbol: string }) {
  return <Text style={{ fontSize: 18 }}>{symbol}</Text>
}

export default function AppLayout() {
  const { session, loading } = useAuth()

  if (!loading && !session) return <Redirect href="/(auth)/login" />

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#0b0f14' },
        headerTintColor: '#f1f5f9',
        tabBarStyle: { backgroundColor: '#0b0f14', borderTopColor: 'rgba(255,255,255,0.08)' },
        tabBarActiveTintColor: '#4ade80',
        tabBarInactiveTintColor: '#64748b',
      }}
    >
      <Tabs.Screen
        name="schedule"
        options={{ title: 'Schedule', tabBarIcon: () => <TabIcon symbol="🗓" /> }}
      />
      <Tabs.Screen
        name="time-off"
        options={{ title: 'Time Off', tabBarIcon: () => <TabIcon symbol="🌴" /> }}
      />
      <Tabs.Screen
        name="messages"
        options={{ title: 'Messages', tabBarIcon: () => <TabIcon symbol="💬" /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: () => <TabIcon symbol="👤" /> }}
      />
    </Tabs>
  )
}
