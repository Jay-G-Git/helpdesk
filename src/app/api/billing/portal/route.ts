import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { stripe } from '../../../lib/stripe'

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: biz } = await supabaseAdmin
    .from('business_profiles')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .single()

  if (!biz?.stripe_customer_id) {
    return NextResponse.json({ error: 'No billing account found' }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://helpdesk.vercel.app'

  const session = await stripe.billingPortal.sessions.create({
    customer: biz.stripe_customer_id,
    return_url: `${appUrl}/settings?tab=billing`,
  })

  return NextResponse.json({ url: session.url })
}
