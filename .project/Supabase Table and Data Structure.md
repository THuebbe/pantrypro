# Supabase Database Schema Documentation

## Overview

This document details the complete database schema for the Restaurant Inventory Management System. The database is built on PostgreSQL via Supabase and includes both legacy tables (from Yard Card Express/YCE) and new restaurant-specific tables.

---

## Table Structure Reference

| Table Name | Purpose | Status |
|-----------|---------|--------|
| agencies | Legacy YCE agency data | Legacy |
| agency_inventory | Legacy YCE inventory | Legacy |
| bundles | Legacy YCE bundles | Legacy |
| businesses | Multi-business platform container | Active |
| ingredient_library | Product/ingredient master list | Active |
| inventory_hold_items | Legacy YCE holds | Legacy |
| inventory_holds | Legacy YCE holds | Legacy |
| menu_items | Restaurant menu items | Active |
| order_activities | Legacy YCE order tracking | Legacy |
| order_items | Legacy YCE order items | Legacy |
| order_signs | Legacy YCE orders | Legacy |
| orders | Legacy YCE orders | Legacy |
| purchase_order_items | Restaurant purchase order line items | Active |
| purchase_orders | Restaurant purchase orders | Active |
| recipe_ingredients | Menu item recipe ingredients | Active |
| restaurant_inventory | Restaurant inventory items | Active |
| restaurants | Restaurant business entities | Active |
| transactions | Legacy YCE transactions | Legacy |
| users | Platform user accounts | Active |
| waste_log | Waste tracking entries | Active |

---

## Active Tables (Restaurant System)

### 1. businesses

**Purpose:** Container for all business types (agencies, restaurants, etc.)

| Column | Type | Constraints | Description |
|--------|------|-----------|-------------|
| id | uuid | PRIMARY KEY | Unique business identifier |
| legacy_id | text | UNIQUE, NULL | Legacy ID for data migration |
| name | character varying | NOT NULL | Business name |
| slug | character varying | UNIQUE | URL-friendly identifier |
| domain | character varying | NULL | Custom domain |
| business_type | character varying | NOT NULL | 'agency' or 'restaurant' |
| is_active | boolean | DEFAULT true | Active/inactive flag |
| settings | jsonb | DEFAULT '{}' | Configuration JSON |
| created_at | timestamp | DEFAULT NOW() | Creation timestamp |
| updated_at | timestamp | DEFAULT NOW() | Last update timestamp |
| address | jsonb | NULL | Address information |
| city | text | NULL | City name |

---

### 2. users

**Purpose:** Platform user accounts with roles and business association

| Column | Type | Constraints | Description |
|--------|------|-----------|-------------|
| id | text | PRIMARY KEY | User ID |
| email | text | UNIQUE, NOT NULL | Email address |
| firstName | text | NULL | First name |
| lastName | text | NULL | Last name |
| avatar | text | NULL | Avatar URL |
| role | USER-DEFINED | DEFAULT 'user' | User role type |
| createdAt | timestamp | DEFAULT NOW() | Account creation date |
| updatedAt | timestamp | DEFAULT NOW() | Last update date |
| emailVerified | timestamp | NULL | Email verification date |
| hashedPassword | text | NULL | Hashed password |
| agencyId | text | NULL | Legacy agency reference |
| clerkUserId | text | NULL | Clerk authentication ID |
| businessId | uuid | REFERENCES businesses | Business association |

**Role Options:**
- USER
- MANAGER
- ADMIN
- SUPER_ADMIN
- SUPER_USER

---

### 3. restaurants

**Purpose:** Restaurant business entity configuration

| Column | Type | Constraints | Description |
|--------|------|-----------|-------------|
| id | uuid | PRIMARY KEY | Unique restaurant ID |
| business_id | uuid | REFERENCES businesses | Parent business |
| restaurant_code | character varying | UNIQUE, NULL | Internal code |
| pos_system | character varying | NULL | 'toast', 'square', 'clover', etc. |
| pos_integration_data | jsonb | DEFAULT '{}' | POS connection config |
| closeout_hour | integer | DEFAULT 4 | Daily closeout hour (24-hour format) |
| settings | jsonb | DEFAULT '{}' | Restaurant settings |
| business_name | character varying | NULL | Business name (redundant for performance) |
| email | character varying | NULL | Restaurant email |
| phone | character varying | NULL | Restaurant phone |
| address | text | NULL | Full address |
| city | character varying | NULL | City name |
| pricing_config | jsonb | NULL | Pricing tiers and configs |
| created_at | timestamp | DEFAULT NOW() | Creation date |
| updated_at | timestamp | DEFAULT NOW() | Last update date |

---

### 4. ingredient_library

**Purpose:** Master list of all ingredients/products available for use

| Column | Type | Constraints | Description |
|--------|------|-----------|-------------|
| id | uuid | PRIMARY KEY | Unique ingredient ID |
| name | character varying | NOT NULL | Ingredient name |
| description | text | NULL | Detailed description |
| category | character varying | NULL | 'protein', 'produce', 'dairy', etc. |
| subcategory | character varying | NULL | Subcategory |
| unit | character varying | NULL | 'lbs', 'oz', 'gallons', 'cases', 'each' |
| storage_type | character varying | NULL | 'refrigerated', 'frozen', 'dry', 'room temp' |
| shelf_life_days | integer | NULL | Days before expiration |
| image_url | text | NULL | Product image |
| thumbnail_url | text | NULL | Thumbnail image |
| barcode | character varying | UNIQUE, NULL | UPC/barcode number |
| is_platform | boolean | DEFAULT true | Platform-wide or restaurant-specific |
| created_by | text | REFERENCES users | Creator user ID |
| created_at | timestamp | DEFAULT NOW() | Creation date |
| updated_at | timestamp | DEFAULT NOW() | Last update date |

**Categories:**
- protein
- produce
- dairy
- dry goods
- alcohol
- beverages
- supplies

---

### 5. restaurant_inventory

**Purpose:** Inventory levels for each restaurant

| Column | Type | Constraints | Description |
|--------|------|-----------|-------------|
| id | uuid | PRIMARY KEY | Unique inventory item ID |
| restaurant_id | uuid | REFERENCES restaurants | Parent restaurant |
| ingredient_id | uuid | REFERENCES ingredient_library | Product reference |
| quantity | numeric | DEFAULT 0 | Current quantity on hand |
| unit | character varying | NULL | Unit of measurement |
| minimum_quantity | numeric | NULL | Reorder threshold |
| cost_per_unit | numeric | NULL | Cost per unit |
| supplier_id | uuid | NULL | Supplier reference (future use) |
| last_restocked | timestamp | NULL | Last receive date |
| expiration_date | date | NULL | Product expiration date |
| location | character varying | NULL | Storage location |
| created_at | timestamp | DEFAULT NOW() | Record creation date |
| updated_at | timestamp | DEFAULT NOW() | Last update date |

**Storage Locations:**
- walk-in cooler
- walk-in freezer
- dry storage
- bar
- prep area
- office

---

### 6. purchase_orders

**Purpose:** Purchase orders from suppliers

| Column | Type | Constraints | Description |
|--------|------|-----------|-------------|
| id | uuid | PRIMARY KEY | Unique order ID |
| restaurant_id | uuid | REFERENCES restaurants | Restaurant placing order |
| order_number | character varying | UNIQUE, NOT NULL | Purchase order number |
| status | character varying | DEFAULT 'draft' | Order status |
| supplier_id | uuid | NULL | Supplier reference |
| supplier_name | character varying | NULL | Supplier name |
| order_date | timestamp | DEFAULT NOW() | Order creation date |
| expected_delivery_date | date | NULL | Estimated delivery |
| actual_delivery_date | date | NULL | Actual delivery date |
| subtotal | numeric | NULL | Pre-tax total |
| tax | numeric | NULL | Tax amount |
| total | numeric | NULL | Final total |
| notes | text | NULL | Order notes |
| created_by | text | REFERENCES users | User who created |
| created_at | timestamp | DEFAULT NOW() | Record creation date |
| updated_at | timestamp | DEFAULT NOW() | Last update date |

**Status Values:**
- draft
- ordered
- received
- stocked
- cancelled

---

### 7. purchase_order_items

**Purpose:** Line items within a purchase order

| Column | Type | Constraints | Description |
|--------|------|-----------|-------------|
| id | uuid | PRIMARY KEY | Unique line item ID |
| purchase_order_id | uuid | REFERENCES purchase_orders | Parent order |
| ingredient_id | uuid | REFERENCES ingredient_library | Product ordered |
| quantity_ordered | numeric | NULL | Quantity ordered |
| quantity_received | numeric | NULL | Quantity received |
| unit | character varying | NULL | Unit of measurement |
| unit_price | numeric | NULL | Price per unit |
| line_total | numeric | NULL | Total for line item |
| expiration_date | date | NULL | Expiration date for this shipment |
| batch_number | character varying | NULL | Batch/lot number |

---

### 8. menu_items

**Purpose:** Restaurant menu items for recipe/BOM tracking

| Column | Type | Constraints | Description |
|--------|------|-----------|-------------|
| id | uuid | PRIMARY KEY | Unique menu item ID |
| restaurant_id | uuid | REFERENCES restaurants | Parent restaurant |
| name | character varying | NOT NULL | Menu item name |
| toast_menu_item_id | character varying | NULL | Toast POS menu item ID |
| category | character varying | NULL | Menu category |
| price | numeric | NULL | Menu item price |
| is_active | boolean | DEFAULT true | Active/inactive flag |
| created_at | timestamp | DEFAULT NOW() | Creation date |
| updated_at | timestamp | DEFAULT NOW() | Last update date |

---

### 9. recipe_ingredients

**Purpose:** Ingredient recipes (BOMs) for menu items

| Column | Type | Constraints | Description |
|--------|------|-----------|-------------|
| id | uuid | PRIMARY KEY | Unique recipe item ID |
| menu_item_id | uuid | REFERENCES menu_items | Menu item |
| ingredient_id | uuid | REFERENCES ingredient_library | Ingredient used |
| quantity | numeric | NOT NULL | Quantity in recipe |
| unit | character varying | NOT NULL | Unit of measurement |
| prep_loss_factor | numeric | DEFAULT 0 | Waste percentage (0-100) |
| created_at | timestamp | DEFAULT NOW() | Creation date |
| updated_at | timestamp | DEFAULT NOW() | Last update date |

**Example:** A chicken dish requires 8 oz of chicken breast with 5% loss during prep
```
menu_item_id: chicken-sandwich
ingredient_id: chicken-breast-uuid
quantity: 8
unit: oz
prep_loss_factor: 5
```

---

### 10. waste_log

**Purpose:** Track all waste/disposal of inventory

| Column | Type | Constraints | Description |
|--------|------|-----------|-------------|
| id | uuid | PRIMARY KEY | Unique waste entry ID |
| restaurant_id | uuid | REFERENCES restaurants | Restaurant |
| ingredient_id | uuid | REFERENCES ingredient_library | Ingredient discarded |
| inventory_id | uuid | REFERENCES restaurant_inventory | Specific inventory batch |
| quantity | numeric | NULL | Quantity wasted |
| unit | character varying | NULL | Unit of measurement |
| cost_value | numeric | NULL | Value of waste |
| reason | character varying | NULL | Waste reason |
| category | character varying | NULL | Waste category |
| notes | text | NULL | Additional notes |
| logged_by | text | REFERENCES users | User who logged |
| logged_at | timestamp | NULL | Date/time logged |
| created_at | timestamp | DEFAULT NOW() | Record creation date |
| updated_at | timestamp | DEFAULT NOW() | Last update date |

**Waste Reasons:**
- Expired
- Spoiled
- Damaged
- Prep Loss
- Over-purchasing
- Theft/Loss
- Quality Issue
- Other

**Waste Categories:**
- Food
- Packaging
- Equipment
- Administrative

---

## Legacy Tables (From YCE - Kept for Migration/Compatibility)

### agencies

Original YCE agencies table - deprecated, replaced by `businesses` and `restaurants`

### agency_inventory

Original YCE agency inventory - deprecated, replaced by `restaurant_inventory`

### orders

Original YCE orders - deprecated, no longer used in restaurant system

### order_items

Original YCE order items - deprecated

### order_signs

Original YCE order signs - deprecated

### order_activities

Original YCE order activity log - deprecated

### inventory_holds

Original YCE inventory hold system - deprecated

### inventory_hold_items

Original YCE hold items - deprecated

### transactions

Original YCE transaction records - deprecated

### bundles

Original YCE bundles - deprecated

---

## Key Relationships

```
businesses
    ├── restaurants
    │   ├── restaurant_inventory
    │   │   └── ingredient_library
    │   ├── purchase_orders
    │   │   └── purchase_order_items
    │   │       └── ingredient_library
    │   ├── menu_items
    │   │   └── recipe_ingredients
    │   │       └── ingredient_library
    │   └── waste_log
    │       └── ingredient_library
    │
    └── users
        ├── ingredient_library (created_by)
        ├── purchase_orders (created_by)
        └── waste_log (logged_by)
```

---

## Data Types Used

| Type | Description | Examples |
|------|-------------|----------|
| uuid | Universal unique identifier | `f47ac10b-58cc-4372-a567-0e02b2c3d479` |
| text | Variable character string | User IDs, names |
| character varying | Varchar with length limit | Product names |
| integer | Whole number | Shelf life days, counts |
| numeric | Decimal number | Prices, quantities |
| date | Calendar date | `2025-12-31` |
| timestamp | Date and time | `2025-11-07T14:30:00` |
| boolean | True/False | `true`, `false` |
| jsonb | JSON binary format | Configuration objects |

---

## Sample Data Structure

### Example: Complete Inventory Flow

**1. Create Ingredient (ingredient_library)**
```json
{
  "id": "beef-chuck-uuid",
  "name": "Beef Chuck Roast",
  "category": "protein",
  "unit": "lbs",
  "storage_type": "refrigerated",
  "shelf_life_days": 5,
  "barcode": "012345678901"
}
```

**2. Add to Restaurant Inventory (restaurant_inventory)**
```json
{
  "id": "inv-beef-chuck-1",
  "restaurant_id": "restaurant-1-uuid",
  "ingredient_id": "beef-chuck-uuid",
  "quantity": 25,
  "unit": "lbs",
  "minimum_quantity": 10,
  "cost_per_unit": 8.50,
  "location": "walk-in cooler",
  "expiration_date": "2025-11-12"
}
```

**3. Purchase Order (purchase_orders)**
```json
{
  "id": "po-001",
  "restaurant_id": "restaurant-1-uuid",
  "order_number": "PO-2025-001",
  "status": "received",
  "supplier_name": "Quality Beef Supplier",
  "order_date": "2025-11-01",
  "expected_delivery_date": "2025-11-03",
  "actual_delivery_date": "2025-11-03",
  "total": 212.50
}
```

**4. PO Line Item (purchase_order_items)**
```json
{
  "id": "po-item-1",
  "purchase_order_id": "po-001",
  "ingredient_id": "beef-chuck-uuid",
  "quantity_ordered": 25,
  "quantity_received": 25,
  "unit": "lbs",
  "unit_price": 8.50,
  "line_total": 212.50,
  "expiration_date": "2025-11-12"
}
```

**5. Menu Recipe (menu_items + recipe_ingredients)**
```json
{
  "menu_item": {
    "id": "pot-roast-1",
    "restaurant_id": "restaurant-1-uuid",
    "name": "Beef Pot Roast",
    "price": 14.99
  },
  "recipe": {
    "id": "recipe-pot-roast-1",
    "menu_item_id": "pot-roast-1",
    "ingredient_id": "beef-chuck-uuid",
    "quantity": 8,
    "unit": "oz",
    "prep_loss_factor": 3
  }
}
```

**6. Waste Entry (waste_log)**
```json
{
  "id": "waste-1",
  "restaurant_id": "restaurant-1-uuid",
  "ingredient_id": "beef-chuck-uuid",
  "inventory_id": "inv-beef-chuck-1",
  "quantity": 2,
  "unit": "lbs",
  "cost_value": 17.00,
  "reason": "Spoiled",
  "category": "Food",
  "logged_by": "user-id",
  "logged_at": "2025-11-11"
}
```

---

## Indexes and Performance

For optimal query performance, the following indexes should be present:

```sql
-- Frequently queried fields
CREATE INDEX idx_restaurant_inventory_restaurant_id ON restaurant_inventory(restaurant_id);
CREATE INDEX idx_restaurant_inventory_expiration_date ON restaurant_inventory(expiration_date);
CREATE INDEX idx_purchase_orders_restaurant_id ON purchase_orders(restaurant_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_menu_items_restaurant_id ON menu_items(restaurant_id);
CREATE INDEX idx_waste_log_restaurant_id ON waste_log(restaurant_id);
CREATE INDEX idx_waste_log_logged_at ON waste_log(logged_at);
```

---

## Database Queries Reference

### Get low stock items
```sql
SELECT * FROM restaurant_inventory
WHERE restaurant_id = $1
AND quantity <= minimum_quantity;
```

### Get expiring items
```sql
SELECT * FROM restaurant_inventory
WHERE restaurant_id = $1
AND expiration_date <= (NOW() + INTERVAL '7 days')
AND expiration_date > NOW();
```

### Get expired items
```sql
SELECT * FROM restaurant_inventory
WHERE restaurant_id = $1
AND expiration_date <= NOW();
```

### Calculate waste value
```sql
SELECT
  SUM(cost_value) as total_waste,
  COUNT(*) as waste_count,
  category
FROM waste_log
WHERE restaurant_id = $1
AND logged_at >= (NOW() - INTERVAL '30 days')
GROUP BY category;
```

### Get purchase order status
```sql
SELECT
  status,
  COUNT(*) as count,
  SUM(total) as total_value
FROM purchase_orders
WHERE restaurant_id = $1
GROUP BY status;
```

---

## Migration Notes

- **Legacy Data:** All YCE tables are retained for backward compatibility
- **New Tables:** All restaurant-specific tables use snake_case column names
- **User Table:** Bridges old (camelCase) and new (snake_case) conventions
- **Timestamps:** All timestamps are in UTC
- **Soft Deletes:** Not currently implemented - use `is_active` flags where needed

---

## Document Version

**Version:** 1.0
**Last Updated:** November 7, 2025
**Status:** Complete and in use
