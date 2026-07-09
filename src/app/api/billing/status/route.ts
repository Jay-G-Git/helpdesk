import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { getBearerUser } from '../../../lib/apiAuth'
import { PLANS, PlanKey } from '../../../lib/stripe'

export async function GET(req: NextRequest) {
  const user = await getBearerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: biz } = await supabaseAdmin
    .from('business_profiles')
    .select('subscription_status, plan, trial_ends_at, current_period_end, stripe_subscription_id')
    .eq('user_id', user.id)
    .single()

  if (!biz) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const plan = PLANS[biz.plan as PlanKey] ?? PLANS.starter
  const now = new Date()
  const trialEnds = new Date(biz.trial_ends_at)
  const trialDaysLeft = Math.max(0, Math.ceil((trialEnds.getTime() - now.getTime()) / 86400000))

  // Count active employees
  const { count: employeeCount } = await supabaseAdmin
    .from('employees')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .neq('status', 'terminated')

  return NextResponse.json({
    status: biz.subscription_status,
    plan: biz.plan,
    planName: plan.name,
    planPrice: plan.price,
    employeeLimit: plan.employeeLimit === Infinity ? null : plan.employeeLimit,
    employeeCount: employeeCount ?? 0,
    trialDaysLeft,
    trialEndsAt: biz.trial_ends_at,
    currentPeriodEnd: biz.current_period_end,
    hasSubscription: !!biz.stripe_subscription_id,
  })
}
