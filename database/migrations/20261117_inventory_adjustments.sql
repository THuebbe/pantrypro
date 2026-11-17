-- History of inventory counts and corrections.
-- One row per counted item: what PantryPro had, what was counted, and the
-- difference in units and dollars. New table only; nothing existing changes.
-- Run this SQL in your Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS inventory_adjustments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id    UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    -- Kept if the inventory item is later deleted, so history survives.
    inventory_id     UUID REFERENCES restaurant_inventory(id) ON DELETE SET NULL,
    ingredient_id    UUID NOT NULL,
    batch_id         UUID NOT NULL,
    reason           VARCHAR(30) NOT NULL,
    note             TEXT,
    quantity_before  NUMERIC NOT NULL,
    quantity_after   NUMERIC NOT NULL,
    quantity_change  NUMERIC NOT NULL,
    unit             VARCHAR(20),
    cost_per_unit    NUMERIC,
    value_change     NUMERIC,
    adjusted_by      TEXT,
    adjusted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_restaurant_time
    ON inventory_adjustments (restaurant_id, adjusted_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_batch
    ON inventory_adjustments (batch_id);

CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_ingredient
    ON inventory_adjustments (restaurant_id, ingredient_id, adjusted_at DESC);

-- Only the backend (service key) reads and writes this table.
ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE inventory_adjustments IS
    'Inventory counts and corrections: quantity before and after, and the variance.';
