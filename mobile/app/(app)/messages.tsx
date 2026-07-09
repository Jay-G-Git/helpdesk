// Placeholder — the web app has a full messaging system (channels, threads,
// reactions, read receipts: src/app/messages/page.tsx + src/app/api/messages/*).
// Wiring the mobile screen up to those same routes is the next step once the
// core employee flows above are confirmed working end-to-end.
import { View, Text, StyleSheet } from 'react-native'

export default function Messages() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Messages</Text>
      <Text style={styles.body}>
        Coming soon — this will connect to the same channels, threads, and announcements
        as the web app's Messages page.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0b0f14', alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { color: '#f1f5f9', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  body: { color: '#64748b', fontSize: 13, textAlign: 'center', lineHeight: 19 },
})
