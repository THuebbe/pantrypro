-- Sign-ups waiting for their card (Stripe Checkout).
-- A new owner's details are held here until Stripe confirms the card.
-- Only then are the login, the user record and the restaurant created.
-- Adds one new table; nothing existing is changed.
-- Run this SQL in your Supabase SQL Editor before deploying the backend
-- that uses it.

CREATE TABLE IF NOT EXISTS pending_signups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    -- AES-256-GCM envelope (credentialVault.js), cleared once the account
    -- exists or the sign-up fails
    password_encrypted JSONB,
    restaurant JSONB NOT NULL,
    -- SHA-256 of the token the browser keeps, so only that browser can be
    -- signed in automatically when checkout finishes
    claim_token_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    stripe_checkout_session_id TEXT,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    user_id UUID,
    business_id UUID,
    error TEXT,
    completed_at TIMESTAMPTZ,
    session_issued_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_signups_email ON pending_signups (email);
CREATE INDEX IF NOT EXISTS idx_pending_signups_expires_at ON pending_signups (expires_at);

-- Row level security on with no policies: only the backend's service key
-- can read or write this table. The browser never can.
ALTER TABLE pending_signups ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE pending_signups IS
    'Sign-ups held until Stripe confirms the card. Rows are deleted by the backend cleanup job.';
