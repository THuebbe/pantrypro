-- Toast reports item quantities as decimals (for example 0.5 lb of an item
-- sold by weight). The quantity column was INTEGER, which rejects those rows.
-- Run this SQL in your Supabase SQL Editor.

ALTER TABLE pos_sales_items
    ALTER COLUMN quantity TYPE NUMERIC(10,3) USING quantity::NUMERIC(10,3);
