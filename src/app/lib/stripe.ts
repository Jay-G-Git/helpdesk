import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
})

export const PLANS = {
  starter: {
    name: 'Starter',
    price: 29,
    employeeLimit: 10,
    priceId: process.env.STRIPE_PRICE_STARTER!,
  },
  growth: {
    name: 'Growth',
    price: 69,
    employeeLimit: 30,
    priceId: process.env.STRIPE_PRICE_GROWTH!,
  },
  pro: {
    name: 'Pro',
    price: 129,
    employeeLimit: Infinity,
    priceId: process.env.STRIPE_PRICE_PRO!,
  },
} as const

export type PlanKey = keyof typeof PLANS
