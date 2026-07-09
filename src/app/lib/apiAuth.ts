import { NextRequest } from 'next/server'
import { supabaseAdmin } from './supabaseAdmin'

/**
 * Resolves the Supabase user for a route handler from the `Authorization:
 * Bearer <token>` header, using the service-role client (bypasses RLS —
 * only for use inside API routes). Returns null if the header is missing
 * or the token doesn't resolve to a user.
 */
export async function getBearerUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  return user ?? null
}
