import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { getBearerUser } from '../../../lib/apiAuth'
import { stripe, PLANS, PlanKey } from '../../../lib/stripe'

export async function POST(req: NextRequest) {
  const user = await getBearerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan } = await req.json()
  const planConfig = PLANS[plan as PlanKey]
  if (!planConfig) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

  const { data: biz } = await supabaseAdmin
    .from('business_profiles')
    .select('stripe_customer_id, business_name')
    .eq('user_id', user.id)
    .single()

  if (!biz) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Create or reuse Stripe customer
  let customerId = biz.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: biz.business_name ?? user.email,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id
    await supabaseAdmin
      .from('business_profiles')
      .update({ stripe_customer_id: customerId })
      .eq('user_id', user.id)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://helpdesk.vercel.app'

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: planConfig.priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      metadata: { supabase_user_id: user.id, plan },
    },
    success_url: `${appUrl}/settings?tab=billing&success=1`,
    cancel_url: `${appUrl}/settings?tab=billing`,
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: session.url })
}
