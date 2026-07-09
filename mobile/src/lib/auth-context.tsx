// Mirrors the magic-link flow in src/app/employee/login/page.tsx, adapted
// for Expo: instead of a browser redirect back to /employee, the email link
// opens the app via a custom URL scheme ("helpdesk://auth-callback"), which
// expo-linking hands to Supabase to establish the session.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as Linking from 'expo-linking'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { api, ApiError } from './api'
import type { Employee, Role } from '../types'

type EmployeeProfile = Employee & { access_role: Role; email: string }

type AuthContextValue = {
  session: Session | null
  profile: EmployeeProfile | null
  loading: boolean
  sendMagicLink: (email: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// The magic-link email redirects to helpdesk://auth-callback#access_token=...
// &refresh_token=... (Supabase's implicit flow puts the tokens in the
// fragment, same as it does for the web app's browser redirect). Parse them
// out manually and hand them to the client — v2 of supabase-js dropped the
// old getSessionFromUrl helper, so this is the supported replacement.
async function applySessionFromUrl(url: string) {
  const fragment = url.split('#')[1]
  if (!fragment) return
  const params = new URLSearchParams(fragment)
  const access_token = params.get('access_token')
  const refresh_token = params.get('refresh_token')
  if (!access_token || !refresh_token) return
  await supabase.auth.setSession({ access_token, refresh_token })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<EmployeeProfile | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile() {
    try {
      const { employee } = await api.get<{ employee: EmployeeProfile }>('/api/employee/me')
      setProfile(employee)
    } catch (err) {
      // No employee record yet, or session expired — leave profile null,
      // screens should treat !profile as "not fully onboarded / signed out".
      if (!(err instanceof ApiError)) console.error(err)
      setProfile(null)
    }
  }

  // Bootstrap: existing session, auth state changes, and deep-link callbacks.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    const linkSub = Linking.addEventListener('url', ({ url }) => {
      applySessionFromUrl(url)
    })
    // App may have been opened cold via the magic link — check for that too.
    Linking.getInitialURL().then(url => {
      if (url) applySessionFromUrl(url)
    })

    return () => {
      sub.subscription.unsubscribe()
      linkSub.remove()
    }
  }, [])

  useEffect(() => {
    if (session) loadProfile()
    else setProfile(null)
  }, [session])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      async sendMagicLink(email: string) {
        const redirectTo = Linking.createURL('auth-callback')
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim().toLowerCase(),
          options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
        })
        return { error: error?.message ?? null }
      },
      async signOut() {
        await supabase.auth.signOut()
      },
      refreshProfile: loadProfile,
    }),
    [session, profile, loading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
