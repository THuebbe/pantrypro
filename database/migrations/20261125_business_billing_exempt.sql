-- Billing exemption for test accounts.
-- A business with billing_exempt = true keeps full access even when
-- billing is enforced and it has no plan. Every business starts off not
-- exempt, so nothing changes until a business is marked exempt.
-- Adds one column to businesses; no existing column or row data changes.
-- Safe to run more than once.

ALTER TABLE businesses
    ADD COLUMN IF NOT EXISTS billing_exempt BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN businesses.billing_exempt IS
    'PantryPro: true for test accounts that skip the billing check.';
