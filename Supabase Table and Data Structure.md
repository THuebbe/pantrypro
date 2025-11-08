| table_name           | column_name            | data_type                   |
| -------------------- | ---------------------- | --------------------------- |
| agencies             | id                     | text                        |
| agencies             | name                   | text                        |
| agencies             | slug                   | text                        |
| agencies             | domain                 | text                        |
| agencies             | isActive               | boolean                     |
| agencies             | createdAt              | timestamp without time zone |
| agencies             | updatedAt              | timestamp without time zone |
| agencies             | description            | text                        |
| agencies             | stripeAccountId        | text                        |
| agencies             | stripeAccountStatus    | text                        |
| agencies             | stripeOnboardingUrl    | text                        |
| agencies             | stripeChargesEnabled   | boolean                     |
| agencies             | stripePayoutsEnabled   | boolean                     |
| agencies             | stripeDetailsSubmitted | boolean                     |
| agencies             | address                | jsonb                       |
| agencies             | agencyCode             | text                        |
| agencies             | businessName           | text                        |
| agencies             | city                   | text                        |
| agencies             | email                  | text                        |
| agencies             | orderCounter           | integer                     |
| agencies             | phone                  | text                        |
| agencies             | pricingConfig          | jsonb                       |
| agencies             | settings               | jsonb                       |
| agencies             | stripeConnectStatus    | text                        |
| agencies             | stripeCustomerId       | text                        |
| agencies             | subdomain              | text                        |
| agencies             | subscriptionEndDate    | timestamp without time zone |
| agencies             | subscriptionStartDate  | timestamp without time zone |
| agencies             | subscriptionStatus     | text                        |
| agencies             | operating_hours        | jsonb                       |
| agencies             | blackout_dates         | jsonb                       |
| agencies             | booking_rules          | jsonb                       |
| agency_inventory     | id                     | text                        |
| agency_inventory     | agencyId               | text                        |
| agency_inventory     | signId                 | text                        |
| agency_inventory     | quantity               | integer                     |
| agency_inventory     | availableQuantity      | integer                     |
| agency_inventory     | allocatedQuantity      | integer                     |
| agency_inventory     | deployedQuantity       | integer                     |
| agency_inventory     | createdAt              | timestamp without time zone |
| agency_inventory     | updatedAt              | timestamp without time zone |
| bundles              | id                     | text                        |
| bundles              | name                   | text                        |
| bundles              | description            | text                        |
| bundles              | createdAt              | timestamp without time zone |
| bundles              | updatedAt              | timestamp without time zone |
| businesses           | id                     | uuid                        |
| businesses           | legacy_id              | text                        |
| businesses           | name                   | character varying           |
| businesses           | slug                   | character varying           |
| businesses           | domain                 | character varying           |
| businesses           | business_type          | character varying           |
| businesses           | is_active              | boolean                     |
| businesses           | settings               | jsonb                       |
| businesses           | created_at             | timestamp without time zone |
| businesses           | updated_at             | timestamp without time zone |
| businesses           | address                | jsonb                       |
| businesses           | city                   | text                        |
| ingredient_library   | id                     | uuid                        |
| ingredient_library   | name                   | character varying           |
| ingredient_library   | description            | text                        |
| ingredient_library   | category               | character varying           |
| ingredient_library   | subcategory            | character varying           |
| ingredient_library   | unit                   | character varying           |
| ingredient_library   | storage_type           | character varying           |
| ingredient_library   | shelf_life_days        | integer                     |
| ingredient_library   | image_url              | text                        |
| ingredient_library   | thumbnail_url          | text                        |
| ingredient_library   | barcode                | character varying           |
| ingredient_library   | is_platform            | boolean                     |
| ingredient_library   | created_by             | text                        |
| ingredient_library   | created_at             | timestamp without time zone |
| ingredient_library   | updated_at             | timestamp without time zone |
| inventory_hold_items | id                     | text                        |
| inventory_hold_items | holdId                 | text                        |
| inventory_hold_items | signId                 | text                        |
| inventory_hold_items | quantity               | integer                     |
| inventory_hold_items | unitPrice              | integer                     |
| inventory_holds      | id                     | text                        |
| inventory_holds      | agencyId               | text                        |
| inventory_holds      | orderId                | text                        |
| inventory_holds      | sessionId              | text                        |
| inventory_holds      | expiresAt              | timestamp without time zone |
| inventory_holds      | createdAt              | timestamp without time zone |
| inventory_holds      | isActive               | boolean                     |
| menu_items           | id                     | uuid                        |
| menu_items           | restaurant_id          | uuid                        |
| menu_items           | name                   | character varying           |
| menu_items           | toast_menu_item_id     | character varying           |
| menu_items           | category               | character varying           |
| menu_items           | price                  | numeric                     |
| menu_items           | is_active              | boolean                     |
| menu_items           | created_at             | timestamp without time zone |
| menu_items           | updated_at             | timestamp without time zone |
| order_activities     | id                     | text                        |
| order_activities     | orderId                | text                        |
| order_activities     | metadata               | jsonb                       |
| order_activities     | createdAt              | timestamp without time zone |
| order_activities     | action                 | text                        |
| order_activities     | notes                  | text                        |
| order_activities     | status                 | text                        |
| order_activities     | userId                 | text                        |
| order_items          | id                     | text                        |
| order_items          | orderId                | text                        |
| order_items          | signId                 | text                        |
| order_items          | quantity               | integer                     |
| order_items          | unitPrice              | numeric                     |
| order_items          | lineTotal              | numeric                     |
| order_signs          | id                     | text                        |
| order_signs          | orderId                | text                        |
| order_signs          | signId                 | text                        |
| order_signs          | quantity               | integer                     |
| orders               | id                     | text                        |
| orders               | agencyId               | text                        |
| orders               | orderNumber            | text                        |
| orders               | displayNumber          | text                        |
| orders               | internalNumber         | text                        |
| orders               | customerName           | text                        |
| orders               | customerEmail          | text                        |
| orders               | customerPhone          | text                        |
| orders               | eventDate              | timestamp without time zone |
| orders               | eventAddress           | text                        |
| orders               | deliveryTime           | text                        |
| orders               | deliveryNotes          | text                        |
| orders               | message                | text                        |
| orders               | messageText            | text                        |
| orders               | theme                  | text                        |
| orders               | layoutStyle            | text                        |
| orders               | previewUrl             | text                        |
| orders               | status                 | text                        |
| orders               | subtotal               | numeric                     |
| orders               | extraDays              | integer                     |
| orders               | extraDayFee            | numeric                     |
| orders               | lateFee                | numeric                     |
| orders               | total                  | numeric                     |
| orders               | paymentIntentId        | text                        |
| orders               | paymentStatus          | text                        |
| orders               | paymentMethod          | text                        |
| orders               | documents              | jsonb                       |
| orders               | createdAt              | timestamp without time zone |
| orders               | updatedAt              | timestamp without time zone |
| orders               | deployedAt             | timestamp without time zone |
| orders               | completedAt            | timestamp without time zone |
| orders               | cancelledAt            | timestamp without time zone |
| orders               | cancellationReason     | text                        |
| orders               | createdById            | text                        |
| orders               | eventType              | text                        |
| orders               | refundAmount           | numeric                     |
| orders               | specialInstructions    | text                        |
| orders               | stripePaymentIntentId  | text                        |
| orders               | confirmationCode       | text                        |
| orders               | confirmationcode       | text                        |
| purchase_order_items | id                     | uuid                        |
| purchase_order_items | purchase_order_id      | uuid                        |
| purchase_order_items | ingredient_id          | uuid                        |
| purchase_order_items | quantity_ordered       | numeric                     |
| purchase_order_items | quantity_received      | numeric                     |
| purchase_order_items | unit                   | character varying           |
| purchase_order_items | unit_price             | numeric                     |
| purchase_order_items | line_total             | numeric                     |
| purchase_order_items | expiration_date        | date                        |
| purchase_order_items | batch_number           | character varying           |
| purchase_orders      | id                     | uuid                        |
| purchase_orders      | restaurant_id          | uuid                        |
| purchase_orders      | order_number           | character varying           |
| purchase_orders      | status                 | character varying           |
| purchase_orders      | supplier_id            | uuid                        |
| purchase_orders      | supplier_name          | character varying           |
| purchase_orders      | order_date             | timestamp without time zone |
| purchase_orders      | expected_delivery_date | date                        |
| purchase_orders      | actual_delivery_date   | date                        |
| purchase_orders      | subtotal               | numeric                     |
| purchase_orders      | tax                    | numeric                     |
| purchase_orders      | total                  | numeric                     |
| purchase_orders      | notes                  | text                        |
| purchase_orders      | created_by             | text                        |
| purchase_orders      | created_at             | timestamp without time zone |
| purchase_orders      | updated_at             | timestamp without time zone |
| recipe_ingredients   | id                     | uuid                        |
| recipe_ingredients   | menu_item_id           | uuid                        |
| recipe_ingredients   | ingredient_id          | uuid                        |
| recipe_ingredients   | quantity               | numeric                     |
| recipe_ingredients   | unit                   | character varying           |
| recipe_ingredients   | prep_loss_factor       | numeric                     |
| recipe_ingredients   | created_at             | timestamp without time zone |
| recipe_ingredients   | updated_at             | timestamp without time zone |
| restaurant_inventory | id                     | uuid                        |
| restaurant_inventory | restaurant_id          | uuid                        |
| restaurant_inventory | ingredient_id          | uuid                        |
| restaurant_inventory | quantity               | numeric                     |
| restaurant_inventory | unit                   | character varying           |
| restaurant_inventory | minimum_quantity       | numeric                     |
| restaurant_inventory | cost_per_unit          | numeric                     |
| restaurant_inventory | supplier_id            | uuid                        |
| restaurant_inventory | last_restocked         | timestamp without time zone |
| restaurant_inventory | expiration_date        | date                        |
| restaurant_inventory | location               | character varying           |
| restaurant_inventory | created_at             | timestamp without time zone |
| restaurant_inventory | updated_at             | timestamp without time zone |
| restaurants          | id                     | uuid                        |
| restaurants          | business_id            | uuid                        |
| restaurants          | restaurant_code        | character varying           |
| restaurants          | pos_system             | character varying           |
| restaurants          | pos_integration_data   | jsonb                       |
| restaurants          | closeout_hour          | integer                     |
| restaurants          | settings               | jsonb                       |
| restaurants          | business_name          | character varying           |
| restaurants          | email                  | character varying           |
| restaurants          | phone                  | character varying           |
| restaurants          | address                | text                        |
| restaurants          | city                   | character varying           |
| restaurants          | pricing_config         | jsonb                       |
| restaurants          | created_at             | timestamp without time zone |
| restaurants          | updated_at             | timestamp without time zone |
| transactions         | id                     | text                        |
| transactions         | agencyId               | text                        |
| transactions         | orderId                | text                        |
| transactions         | grossAmount            | numeric                     |
| transactions         | platformFee            | numeric                     |
| transactions         | stripeFee              | numeric                     |
| transactions         | netAmount              | numeric                     |
| transactions         | processingType         | text                        |
| transactions         | stripePaymentId        | text                        |
| transactions         | status                 | text                        |
| transactions         | createdAt              | timestamp without time zone |
| transactions         | releasedAt             | timestamp without time zone |
| users                | id                     | text                        |
| users                | email                  | text                        |
| users                | firstName              | text                        |
| users                | lastName               | text                        |
| users                | avatar                 | text                        |
| users                | role                   | USER-DEFINED                |
| users                | createdAt              | timestamp without time zone |
| users                | updatedAt              | timestamp without time zone |
| users                | emailVerified          | timestamp without time zone |
| users                | hashedPassword         | text                        |
| users                | agencyId               | text                        |
| users                | clerkUserId            | text                        |
| users                | businessId             | uuid                        |
| waste_log            | id                     | uuid                        |
| waste_log            | restaurant_id          | uuid                        |
| waste_log            | ingredient_id          | uuid                        |
| waste_log            | inventory_id           | uuid                        |
| waste_log            | quantity               | numeric                     |
| waste_log            | unit                   | character varying           |
| waste_log            | cost_value             | numeric                     |
| waste_log            | reason                 | character varying           |
| waste_log            | category               | character varying           |
| waste_log            | notes                  | text                        |
| waste_log            | logged_by              | text                        |
| waste_log            | logged_at              | timestamp without time zone |
| waste_log            | created_at             | timestamp without time zone |
| waste_log            | updated_at             | timestamp without time zone |
