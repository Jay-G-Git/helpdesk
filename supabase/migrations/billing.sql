-- Add billing fields to business_profiles
ALTER TABLE business_profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id    text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_status   text NOT NULL DEFAULT 'trialing',
  ADD COLUMN IF NOT EXISTS plan                  text NOT NULL DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS trial_ends_at         timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  ADD COLUMN IF NOT EXISTS current_period_end    timestamptz;

-- subscription_status values: trialing | active | past_due | canceled | incomplete
-- plan values: starter | growth | pro
