// Mirrors src/app/employee/login/page.tsx — same magic-link flow, native UI.
import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { useAuth } from '../../src/lib/auth-context'

export default function Login() {
  const { sendMagicLink } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSend() {
    if (!email.trim()) return
    setLoading(true)
    setError('')
    const { error } = await sendMagicLink(email)
    if (error) setError(error)
    else setSent(true)
    setLoading(false)
  }

  return (
    <KeyboardAvoidingView
      style={styles.wrap}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.logo}>
          help<Text style={{ color: '#4ade80' }}>desk</Text>
        </Text>
        <Text style={styles.subtitle}>Employee portal</Text>
      </View>

      <View style={styles.card}>
        {sent ? (
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.cardTitle}>Check your email</Text>
            <Text style={styles.cardBody}>
              We sent a login link to {email}. Tap it on this device to open the app.
            </Text>
            <Pressable onPress={() => { setSent(false); setEmail('') }}>
              <Text style={styles.link}>Use a different email</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.cardTitle}>Sign in</Text>
            <Text style={styles.cardBody}>Enter your work email to receive a login link.</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              onSubmitEditing={handleSend}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              style={[styles.button, (loading || !email.trim()) && { opacity: 0.5 }]}
              onPress={handleSend}
              disabled={loading || !email.trim()}
            >
              <Text style={styles.buttonText}>{loading ? 'Sending…' : 'Send login link'}</Text>
            </Pressable>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0b0f14', alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: { fontSize: 26, fontWeight: '800', color: '#f1f5f9' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  card: { width: '100%', maxWidth: 380, backgroundColor: '#11161d', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#f1f5f9', marginBottom: 4 },
  cardBody: { fontSize: 13, color: '#94a3b8', marginBottom: 20, lineHeight: 19, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 12, color: '#f1f5f9', fontSize: 15, marginBottom: 12 },
  error: { fontSize: 13, color: '#f87171', marginBottom: 12 },
  button: { backgroundColor: '#4ade80', borderRadius: 10, padding: 14, alignItems: 'center' },
  buttonText: { color: '#0b0f14', fontWeight: '700', fontSize: 15 },
  link: { color: '#4ade80', fontSize: 13, marginTop: 20 },
})
