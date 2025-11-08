# Restaurant Inventory Management System - MVP Technical Specification

## AI Agent Build Instructions

---

## Project Overview

**Goal:** Build a mobile-first restaurant inventory management system using modular architecture that can later be adapted for other business types.

**Tech Stack:**

- Frontend: React 18 + Vite (JavaScript, NO TypeScript)
- Backend: Express.js (JavaScript, NO TypeScript)
- Database: Supabase (PostgreSQL)
- Auth: Clerk
- Payments: Stripe
- Styling: Tailwind CSS
- State Management: React hooks (useState, useEffect, useContext)

**Build Approach:** Convert existing Yard Card Express (YCE) patterns into restaurant-specific functionality using configuration-driven modularity.

---

## Database Schema

### Core Tables (Shared Infrastructure)

```sql
-- Users table (already exists from YCE)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  firstName VARCHAR(100),
  lastName VARCHAR(100),
  clerkUserId VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

-- Businesses table (generic for all business types)
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  domain VARCHAR(255),
  businessType VARCHAR(50) NOT NULL, -- 'agency' or 'restaurant'
  isActive BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

-- Link users to businesses
ALTER TABLE users ADD COLUMN businessId UUID REFERENCES businesses(id);
```

### Restaurant-Specific Tables

```sql
-- Restaurants table (mirrors agencies table from YCE)
CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  businessId UUID REFERENCES businesses(id),
  restaurantCode VARCHAR(50) UNIQUE,
  posSystem VARCHAR(50), -- 'toast', 'square', etc.
  posIntegrationData JSONB DEFAULT '{}',
  closeoutHour INTEGER DEFAULT 4,
  settings JSONB DEFAULT '{}',
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

-- Ingredient library (mirrors sign_library from YCE)
CREATE TABLE ingredient_library (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100), -- 'protein', 'produce', 'dairy', 'dry goods', 'alcohol'
  subcategory VARCHAR(100),
  unit VARCHAR(50), -- 'lbs', 'oz', 'gallons', 'cases', 'each'
  storageType VARCHAR(50), -- 'refrigerated', 'frozen', 'dry', 'room temp'
  shelfLifeDays INTEGER,
  imageUrl TEXT,
  barcode VARCHAR(100),
  isPlatform BOOLEAN DEFAULT true,
  createdBy UUID REFERENCES users(id),
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

-- Restaurant inventory (mirrors agency_inventory from YCE)
CREATE TABLE restaurant_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurantId UUID REFERENCES restaurants(id),
  ingredientId UUID REFERENCES ingredient_library(id),
  quantity DECIMAL(10,2) DEFAULT 0,
  unit VARCHAR(50),
  minimumQuantity DECIMAL(10,2), -- reorder threshold
  costPerUnit DECIMAL(10,2),
  supplierId UUID, -- for future supplier management
  lastRestocked TIMESTAMP,
  expirationDate DATE,
  location VARCHAR(100), -- 'walk-in', 'dry storage', 'bar', etc.
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

-- Purchase orders (mirrors orders from YCE)
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurantId UUID REFERENCES restaurants(id),
  orderNumber VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'ordered', 'received', 'stocked'
  supplierId UUID,
  supplierName VARCHAR(255),
  orderDate TIMESTAMP DEFAULT NOW(),
  expectedDeliveryDate DATE,
  actualDeliveryDate DATE,
  subtotal DECIMAL(10,2),
  tax DECIMAL(10,2),
  total DECIMAL(10,2),
  notes TEXT,
  createdBy UUID REFERENCES users(id),
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

-- Purchase order items (mirrors order_items from YCE)
CREATE TABLE purchase_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchaseOrderId UUID REFERENCES purchase_orders(id),
  ingredientId UUID REFERENCES ingredient_library(id),
  quantityOrdered DECIMAL(10,2),
  quantityReceived DECIMAL(10,2),
  unit VARCHAR(50),
  unitPrice DECIMAL(10,2),
  lineTotal DECIMAL(10,2),
  expirationDate DATE,
  batchNumber VARCHAR(100)
);

-- Menu items (for recipe management)
CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurantId UUID REFERENCES restaurants(id),
  name VARCHAR(255) NOT NULL,
  toastMenuItemId VARCHAR(255), -- for POS integration
  category VARCHAR(100),
  price DECIMAL(10,2),
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

-- Recipe ingredients (maps menu items to ingredients)
CREATE TABLE recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menuItemId UUID REFERENCES menu_items(id),
  ingredientId UUID REFERENCES ingredient_library(id),
  quantity DECIMAL(10,2) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  prepLossFactor DECIMAL(5,2) DEFAULT 0 -- percentage of waste during prep
);
```

---

## Project Structure

```
restaurant-inventory-mvp/
├── frontend/                      # Vite React app
│   ├── src/
│   │   ├── core/                 # Reusable core modules
│   │   │   ├── auth/
│   │   │   │   ├── AuthProvider.jsx
│   │   │   │   └── useAuth.js
│   │   │   ├── database/
│   │   │   │   ├── supabase-client.js
│   │   │   │   └── business-data.js
│   │   │   └── hooks/
│   │   │       ├── useDashboardData.js
│   │   │       └── useInventory.js
│   │   ├── modules/              # Business logic modules
│   │   │   ├── dashboard/
│   │   │   │   ├── DashboardMetrics.jsx
│   │   │   │   └── MetricCard.jsx
│   │   │   ├── inventory/
│   │   │   │   ├── InventoryList.jsx
│   │   │   │   ├── InventoryCard.jsx
│   │   │   │   ├── BarcodeScanner.jsx
│   │   │   │   └── ReceivingForm.jsx
│   │   │   └── orders/
│   │   │       ├── PurchaseOrderList.jsx
│   │   │       └── CreatePurchaseOrder.jsx
│   │   ├── config/
│   │   │   └── restaurant.js     # Restaurant-specific config
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Inventory.jsx
│   │   │   ├── Orders.jsx
│   │   │   └── Receiving.jsx
│   │   ├── shared/
│   │   │   └── components/
│   │   │       ├── Header.jsx
│   │   │       ├── Button.jsx
│   │   │       └── Modal.jsx
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── backend/                       # Express server
│   ├── src/
│   │   ├── routes/
│   │   │   ├── dashboard.js
│   │   │   ├── inventory.js
│   │   │   └── orders.js
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   └── errorHandler.js
│   │   ├── services/
│   │   │   ├── supabase.js
│   │   │   └── toast-integration.js
│   │   └── index.js
│   ├── package.json
│   └── .env
│
└── README.md
```

---

## Configuration System

### Restaurant Configuration File

**File: `frontend/src/config/restaurant.js`**

```javascript
export const restaurantConfig = {
	// Business type
	businessType: "restaurant",
	businessEntityName: "restaurant",

	// Database mappings
	businessTable: "restaurants",
	inventoryTable: "restaurant_inventory",
	productTable: "ingredient_library",
	orderTable: "purchase_orders",
	orderItemsTable: "purchase_order_items",

	// Auth config
	defaultRole: "kitchen_staff",
	userRoles: ["restaurant_admin", "manager", "kitchen_staff"],

	// UI config
	appName: "Restaurant Inventory Pro",
	primaryColor: "green",

	// Dashboard metrics
	dashboardMetrics: [
		{
			key: "lowStockAlerts",
			title: "Low Stock Alerts",
			icon: "⚠️",
		},
		{
			key: "itemsExpiringSoon",
			title: "Expiring Soon",
			icon: "📅",
			threshold: 7, // days
		},
		{
			key: "monthlyFoodCost",
			title: "Food Cost %",
			icon: "💰",
			formatter: (value) => `${value?.toFixed(1) || 0}%`,
		},
	],

	// Product/Inventory config
	productName: "ingredients",
	productCategories: [
		"protein",
		"produce",
		"dairy",
		"dry goods",
		"alcohol",
		"beverages",
		"supplies",
	],

	// Order status workflow
	orderStatuses: [
		{ value: "draft", label: "Draft", color: "gray" },
		{ value: "ordered", label: "Ordered", color: "blue" },
		{ value: "received", label: "Received", color: "yellow" },
		{ value: "stocked", label: "Stocked", color: "green" },
	],

	// Units of measurement
	units: ["lbs", "oz", "gallons", "quarts", "cases", "each", "bags"],

	// Storage locations
	storageLocations: [
		"walk-in cooler",
		"walk-in freezer",
		"dry storage",
		"bar",
		"prep area",
		"office",
	],
};
```

---

## Core Features - MVP

### Feature 1: Authentication & User Management

**Using existing YCE Clerk integration**

**File: `frontend/src/core/auth/AuthProvider.jsx`**

```javascript
import {
	ClerkProvider,
	SignedIn,
	SignedOut,
	useUser,
} from "@clerk/clerk-react";
import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export function AuthProvider({ children, config }) {
	return (
		<ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
			<AuthContextProvider config={config}>{children}</AuthContextProvider>
		</ClerkProvider>
	);
}

function AuthContextProvider({ children, config }) {
	const { user, isSignedIn } = useUser();
	const [businessId, setBusinessId] = useState(null);

	useEffect(() => {
		if (user) {
			// Get user's business ID from database
			const userBusinessId =
				user.publicMetadata?.[`${config.businessEntityName}Id`];
			setBusinessId(userBusinessId);
		}
	}, [user, config]);

	const value = {
		user,
		isSignedIn,
		businessId,
		role: user?.publicMetadata?.role || config.defaultRole,
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	return useContext(AuthContext);
}
```

### Feature 2: Dashboard with Real-Time Metrics

**File: `frontend/src/modules/dashboard/DashboardMetrics.jsx`**

```javascript
import { useState, useEffect } from "react";
import { useAuth } from "../../core/auth/useAuth";

export function DashboardMetrics({ config }) {
	const { businessId } = useAuth();
	const [metrics, setMetrics] = useState({});
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!businessId) return;

		fetch(`/api/dashboard/${businessId}`)
			.then((res) => res.json())
			.then((data) => {
				setMetrics(data);
				setLoading(false);
			})
			.catch((err) => console.error("Dashboard metrics error:", err));
	}, [businessId]);

	if (loading) {
		return <SkeletonGrid config={config} />;
	}

	return (
		<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
			{config.dashboardMetrics.map((metric) => (
				<MetricCard
					key={metric.key}
					title={metric.title}
					icon={metric.icon}
					value={
						metric.formatter
							? metric.formatter(metrics[metric.key])
							: metrics[metric.key] || 0
					}
				/>
			))}
		</div>
	);
}

function MetricCard({ title, icon, value }) {
	return (
		<div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
			<div className="flex items-center justify-between mb-2">
				<h3 className="text-sm font-medium text-gray-500">{title}</h3>
				<span className="text-2xl">{icon}</span>
			</div>
			<p className="text-3xl font-bold text-gray-900">{value}</p>
		</div>
	);
}

function SkeletonGrid({ config }) {
	return (
		<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
			{config.dashboardMetrics.map((_, idx) => (
				<div
					key={idx}
					className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 animate-pulse"
				>
					<div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
					<div className="h-8 bg-gray-200 rounded w-3/4"></div>
				</div>
			))}
		</div>
	);
}
```

### Feature 3: Inventory Management

**File: `frontend/src/modules/inventory/InventoryList.jsx`**

```javascript
import { useState, useEffect } from "react";
import { useAuth } from "../../core/auth/useAuth";

export function InventoryList({ config }) {
	const { businessId } = useAuth();
	const [inventory, setInventory] = useState([]);
	const [loading, setLoading] = useState(true);
	const [filter, setFilter] = useState("all");

	useEffect(() => {
		if (!businessId) return;

		fetch(`/api/inventory/${businessId}`)
			.then((res) => res.json())
			.then((data) => {
				setInventory(data);
				setLoading(false);
			});
	}, [businessId]);

	const filteredInventory = inventory.filter((item) => {
		if (filter === "low-stock") return item.quantity <= item.minimumQuantity;
		if (filter === "expiring") {
			const daysUntilExpiry = Math.floor(
				(new Date(item.expirationDate) - new Date()) / (1000 * 60 * 60 * 24)
			);
			return daysUntilExpiry <= 7 && daysUntilExpiry >= 0;
		}
		return true;
	});

	return (
		<div>
			<div className="flex gap-2 mb-4">
				<button
					onClick={() => setFilter("all")}
					className={`px-4 py-2 rounded ${
						filter === "all" ? "bg-blue-600 text-white" : "bg-gray-200"
					}`}
				>
					All Items
				</button>
				<button
					onClick={() => setFilter("low-stock")}
					className={`px-4 py-2 rounded ${
						filter === "low-stock" ? "bg-blue-600 text-white" : "bg-gray-200"
					}`}
				>
					Low Stock
				</button>
				<button
					onClick={() => setFilter("expiring")}
					className={`px-4 py-2 rounded ${
						filter === "expiring" ? "bg-blue-600 text-white" : "bg-gray-200"
					}`}
				>
					Expiring Soon
				</button>
			</div>

			{loading ? (
				<div>Loading inventory...</div>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{filteredInventory.map((item) => (
						<InventoryCard
							key={item.id}
							item={item}
							config={config}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function InventoryCard({ item, config }) {
	const isLowStock = item.quantity <= item.minimumQuantity;
	const daysUntilExpiry = item.expirationDate
		? Math.floor(
				(new Date(item.expirationDate) - new Date()) / (1000 * 60 * 60 * 24)
		  )
		: null;
	const isExpiringSoon =
		daysUntilExpiry !== null && daysUntilExpiry <= 7 && daysUntilExpiry >= 0;

	return (
		<div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
			<h3 className="font-semibold text-lg mb-2">{item.ingredientName}</h3>
			<div className="space-y-1 text-sm text-gray-600">
				<p>Category: {item.category}</p>
				<p>
					Quantity: {item.quantity} {item.unit}
				</p>
				<p>
					Min Quantity: {item.minimumQuantity} {item.unit}
				</p>
				<p>Location: {item.location}</p>
				{item.expirationDate && (
					<p>Expires: {new Date(item.expirationDate).toLocaleDateString()}</p>
				)}
			</div>

			{isLowStock && (
				<div className="mt-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
					⚠️ Low Stock
				</div>
			)}

			{isExpiringSoon && (
				<div className="mt-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
					📅 Expires in {daysUntilExpiry} days
				</div>
			)}
		</div>
	);
}
```

### Feature 4: Barcode Scanning for Receiving

**File: `frontend/src/modules/inventory/BarcodeScanner.jsx`**

```javascript
import { useState, useRef, useEffect } from "react";

export function BarcodeScanner({ onScan, config }) {
	const [scanning, setScanning] = useState(false);
	const [manualEntry, setManualEntry] = useState("");
	const videoRef = useRef(null);

	// For MVP: Manual barcode entry
	// TODO: Implement camera-based scanning in Phase 2

	const handleManualScan = () => {
		if (manualEntry.trim()) {
			onScan(manualEntry.trim());
			setManualEntry("");
		}
	};

	return (
		<div className="bg-white p-6 rounded-lg shadow-sm border">
			<h3 className="text-lg font-semibold mb-4">Scan {config.productName}</h3>

			{/* Manual Entry */}
			<div className="space-y-4">
				<div>
					<label className="block text-sm font-medium text-gray-700 mb-2">
						Enter Barcode or UPC
					</label>
					<div className="flex gap-2">
						<input
							type="text"
							value={manualEntry}
							onChange={(e) => setManualEntry(e.target.value)}
							onKeyPress={(e) => e.key === "Enter" && handleManualScan()}
							placeholder="Scan or type barcode..."
							className="flex-1 px-4 py-2 border rounded-lg"
							autoFocus
						/>
						<button
							onClick={handleManualScan}
							className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
						>
							Add
						</button>
					</div>
				</div>

				{/* Camera Scanner Placeholder */}
				<div className="text-center py-8 border-2 border-dashed rounded-lg">
					<p className="text-gray-500">📷 Camera scanning coming in Phase 2</p>
				</div>
			</div>
		</div>
	);
}
```

### Feature 5: Receiving Workflow

**File: `frontend/src/modules/inventory/ReceivingForm.jsx`**

```javascript
import { useState } from "react";
import { BarcodeScanner } from "./BarcodeScanner";

export function ReceivingForm({ config, onComplete }) {
	const [items, setItems] = useState([]);
	const [currentItem, setCurrentItem] = useState(null);

	const handleBarcodeScan = async (barcode) => {
		// Look up ingredient by barcode
		const response = await fetch(`/api/inventory/lookup?barcode=${barcode}`);
		const ingredient = await response.json();

		if (ingredient) {
			setCurrentItem({
				ingredientId: ingredient.id,
				ingredientName: ingredient.name,
				barcode: barcode,
				quantity: "",
				unit: ingredient.unit,
				expirationDate: "",
				location: config.storageLocations[0],
			});
		}
	};

	const addItemToReceiving = () => {
		if (currentItem && currentItem.quantity) {
			setItems([...items, currentItem]);
			setCurrentItem(null);
		}
	};

	const completeReceiving = async () => {
		// Submit receiving to backend
		const response = await fetch("/api/inventory/receive", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ items }),
		});

		if (response.ok) {
			onComplete();
		}
	};

	return (
		<div className="space-y-6">
			<BarcodeScanner
				onScan={handleBarcodeScan}
				config={config}
			/>

			{currentItem && (
				<div className="bg-blue-50 p-4 rounded-lg">
					<h4 className="font-semibold mb-3">{currentItem.ingredientName}</h4>
					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className="block text-sm font-medium mb-1">Quantity</label>
							<input
								type="number"
								value={currentItem.quantity}
								onChange={(e) =>
									setCurrentItem({ ...currentItem, quantity: e.target.value })
								}
								className="w-full px-3 py-2 border rounded"
							/>
						</div>
						<div>
							<label className="block text-sm font-medium mb-1">Unit</label>
							<select
								value={currentItem.unit}
								onChange={(e) =>
									setCurrentItem({ ...currentItem, unit: e.target.value })
								}
								className="w-full px-3 py-2 border rounded"
							>
								{config.units.map((unit) => (
									<option
										key={unit}
										value={unit}
									>
										{unit}
									</option>
								))}
							</select>
						</div>
						<div>
							<label className="block text-sm font-medium mb-1">
								Expiration Date
							</label>
							<input
								type="date"
								value={currentItem.expirationDate}
								onChange={(e) =>
									setCurrentItem({
										...currentItem,
										expirationDate: e.target.value,
									})
								}
								className="w-full px-3 py-2 border rounded"
							/>
						</div>
						<div>
							<label className="block text-sm font-medium mb-1">Location</label>
							<select
								value={currentItem.location}
								onChange={(e) =>
									setCurrentItem({ ...currentItem, location: e.target.value })
								}
								className="w-full px-3 py-2 border rounded"
							>
								{config.storageLocations.map((loc) => (
									<option
										key={loc}
										value={loc}
									>
										{loc}
									</option>
								))}
							</select>
						</div>
					</div>
					<button
						onClick={addItemToReceiving}
						className="mt-4 w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
					>
						Add to Receiving List
					</button>
				</div>
			)}

			{items.length > 0 && (
				<div>
					<h4 className="font-semibold mb-3">
						Items to Receive ({items.length})
					</h4>
					<div className="space-y-2">
						{items.map((item, idx) => (
							<div
								key={idx}
								className="flex justify-between items-center bg-gray-50 p-3 rounded"
							>
								<span>{item.ingredientName}</span>
								<span>
									{item.quantity} {item.unit}
								</span>
							</div>
						))}
					</div>
					<button
						onClick={completeReceiving}
						className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
					>
						Complete Receiving
					</button>
				</div>
			)}
		</div>
	);
}
```

---

## Backend API Endpoints

### Dashboard API

**File: `backend/src/routes/dashboard.js`**

```javascript
import express from "express";
import { supabase } from "../services/supabase.js";

const router = express.Router();

router.get("/:businessId", async (req, res) => {
	try {
		const { businessId } = req.params;

		// Get low stock count
		const { data: lowStock } = await supabase
			.from("restaurant_inventory")
			.select("*")
			.eq("restaurantId", businessId)
			.lte("quantity", supabase.raw("minimumQuantity"));

		// Get items expiring soon (within 7 days)
		const sevenDaysFromNow = new Date();
		sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

		const { data: expiringSoon } = await supabase
			.from("restaurant_inventory")
			.select("*")
			.eq("restaurantId", businessId)
			.lte("expirationDate", sevenDaysFromNow.toISOString())
			.gte("expirationDate", new Date().toISOString());

		// Calculate food cost percentage (mock for MVP)
		const monthlyFoodCost = 28.5; // TODO: Calculate from actual data

		res.json({
			lowStockAlerts: lowStock?.length || 0,
			itemsExpiringSoon: expiringSoon?.length || 0,
			monthlyFoodCost: monthlyFoodCost,
		});
	} catch (error) {
		console.error("Dashboard error:", error);
		res.status(500).json({ error: error.message });
	}
});

export default router;
```

### Inventory API

**File: `backend/src/routes/inventory.js`**

```javascript
import express from "express";
import { supabase } from "../services/supabase.js";

const router = express.Router();

// Get all inventory for a restaurant
router.get("/:restaurantId", async (req, res) => {
	try {
		const { restaurantId } = req.params;

		const { data, error } = await supabase
			.from("restaurant_inventory")
			.select(
				`
        *,
        ingredient:ingredient_library(*)
      `
			)
			.eq("restaurantId", restaurantId);

		if (error) throw error;

		const inventory = data.map((item) => ({
			id: item.id,
			ingredientId: item.ingredientId,
			ingredientName: item.ingredient.name,
			category: item.ingredient.category,
			quantity: item.quantity,
			unit: item.unit,
			minimumQuantity: item.minimumQuantity,
			costPerUnit: item.costPerUnit,
			location: item.location,
			expirationDate: item.expirationDate,
			lastRestocked: item.lastRestocked,
		}));

		res.json(inventory);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

// Lookup ingredient by barcode
router.get("/lookup", async (req, res) => {
	try {
		const { barcode } = req.query;

		const { data, error } = await supabase
			.from("ingredient_library")
			.select("*")
			.eq("barcode", barcode)
			.single();

		if (error) throw error;

		res.json(data);
	} catch (error) {
		res.status(404).json({ error: "Ingredient not found" });
	}
});

// Receive inventory
router.post("/receive", async (req, res) => {
	try {
		const { items } = req.body;

		// Update inventory quantities
		for (const item of items) {
			const { data: existing } = await supabase
				.from("restaurant_inventory")
				.select("*")
				.eq("restaurantId", item.restaurantId)
				.eq("ingredientId", item.ingredientId)
				.single();

			if (existing) {
				// Update existing inventory
				await supabase
					.from("restaurant_inventory")
					.update({
						quantity: existing.quantity + parseFloat(item.quantity),
						lastRestocked: new Date().toISOString(),
						expirationDate: item.expirationDate,
					})
					.eq("id", existing.id);
			} else {
				// Create new inventory record
				await supabase.from("restaurant_inventory").insert({
					restaurantId: item.restaurantId,
					ingredientId: item.ingredientId,
					quantity: parseFloat(item.quantity),
					unit: item.unit,
					location: item.location,
					expirationDate: item.expirationDate,
					lastRestocked: new Date().toISOString(),
				});
			}
		}

		res.json({ success: true });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

export default router;
```

---

## Environment Setup

### Frontend `.env`

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
```

### Backend `.env`

```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
PORT=3001
```

---

## Main Application Files

### Frontend Entry Point

**File: `frontend/src/App.jsx`**

```javascript
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./core/auth/AuthProvider";
import { restaurantConfig } from "./config/restaurant";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Receiving from "./pages/Receiving";
import Orders from "./pages/Orders";

function App() {
	return (
		<AuthProvider config={restaurantConfig}>
			<BrowserRouter>
				<Routes>
					<Route
						path="/"
						element={<Navigate to="/dashboard" />}
					/>
					<Route
						path="/dashboard"
						element={<Dashboard />}
					/>
					<Route
						path="/inventory"
						element={<Inventory />}
					/>
					<Route
						path="/receiving"
						element={<Receiving />}
					/>
					<Route
						path="/orders"
						element={<Orders />}
					/>
				</Routes>
			</BrowserRouter>
		</AuthProvider>
	);
}

export default App;
```

### Backend Entry Point

**File: `backend/src/index.js`**

```javascript
import express from "express";
import cors from "cors";
import dashboardRoutes from "./routes/dashboard.js";
import inventoryRoutes from "./routes/inventory.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/dashboard", dashboardRoutes);
app.use("/api/inventory", inventoryRoutes);

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
	console.log(`🚀 Server running on port ${PORT}`);
});
```

---

## Development Instructions for AI Agent

### Phase 1: Setup (Day 1)

1. Create project structure as outlined above
2. Initialize Vite React project in `frontend/`
3. Initialize Express project in `backend/`
4. Install all dependencies
5. Set up Tailwind CSS
6. Configure environment variables

### Phase 2: Database (Day 2)

1. Execute all database schema SQL in Supabase
2. Create Supabase client connections
3. Test database connections

### Phase 3: Authentication (Day 3)

1. Implement Clerk authentication
2. Create AuthProvider component
3. Add protected routes
4. Test user login/logout

### Phase 4: Core Features (Days 4-7)

1. Build Dashboard with metrics
2. Build Inventory List with filtering
3. Build Barcode Scanner component
4. Build Receiving Form workflow
5. Implement backend API endpoints

### Phase 5: Integration (Days 8-9)

1. Connect frontend to backend APIs
2. Test all workflows end-to-end
3. Add error handling
4. Add loading states

### Phase 6: Polish (Day 10)

1. Responsive design testing
2. Performance optimization
3. Bug fixes
4. Documentation

---

## Success Criteria

The MVP is complete when:

- ✅ User can log in with Clerk
- ✅ Dashboard shows live metrics (low stock, expiring items, food cost %)
- ✅ User can view inventory list with filters
- ✅ User can scan/enter barcodes to receive inventory
- ✅ Inventory quantities update after receiving
- ✅ All data persists in Supabase
- ✅ Mobile responsive design works
- ✅ No console errors in production

---

## Post-MVP Features (Phase 2)

- Camera-based barcode scanning
- Toast POS integration
- Recipe/BOM management
- Purchase order generation
- Supplier management
- Advanced analytics
- Waste tracking
- Multi-location support

---

This specification provides everything needed to build a working MVP. Follow the structure exactly, use the configuration system, and leverage the existing YCE patterns where possible.
