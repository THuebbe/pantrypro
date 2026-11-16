-- Subscription billing for businesses (Stripe).
-- Adds columns only; existing rows and columns are untouched.
-- Run this SQL in your Supabase SQL Editor.

ALTER TABLE businesses
    ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
    ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
    ADD COLUMN IF NOT EXISTS billing_status TEXT,
    ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS billing_past_due_since TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_stripe_customer_id
    ON businesses (stripe_customer_id)
    WHERE stripe_customer_id IS NOT NULL;

COMMENT ON COLUMN businesses.billing_status IS
    'Stripe subscription status (trialing, active, past_due, canceled, ...). NULL = never subscribed.';
