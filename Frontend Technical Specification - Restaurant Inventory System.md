# Restaurant Inventory Management System - Frontend Technical Specification

## Document Purpose

This document provides complete technical specifications for building the React frontend that integrates with an existing Express.js backend API. All backend endpoints, authentication flows, data structures, and business logic are documented here.

---

## Tech Stack Requirements

### Frontend (To Be Built)

- **Framework:** React 18 with Vite
- **Language:** JavaScript (NO TypeScript)
- **Styling:** Tailwind CSS
- **State Management:** React hooks (useState, useEffect, useContext) + TanStack Query for server state
- **Routing:** React Router v6
- **HTTP Client:** Axios or Fetch API
- **Data Fetching:** TanStack Query (React Query) for caching, background updates, and optimistic UI

### Backend (Already Built)

- **Server:** Express.js (JavaScript)
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth with JWT tokens
- **API Base URL:** `http://localhost:3001/api` (development)

---

## Authentication System

### Overview

The backend uses JWT (JSON Web Token) authentication. After login, the frontend receives an access token that must be included in all subsequent requests.

### Auth Flow

```
1. User enters email/password → POST /api/auth/login
2. Backend returns accessToken
3. Frontend stores token in localStorage
4. Frontend includes token in Authorization header for all requests
5. Token expires after session timeout
6. User can logout → POST /api/auth/logout
```

### Token Storage

```javascript
// Store token after login
localStorage.setItem("auth_token", accessToken);

// Retrieve token for requests
const token = localStorage.getItem("auth_token");

// Remove token on logout
localStorage.removeItem("auth_token");
```

### Request Headers

All protected endpoints require:

```javascript
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

---

## API Endpoints Documentation

### Base URL

```
Development: http://localhost:3001/api
```

---

## 🔐 Authentication Endpoints

### 1. Register User

**Endpoint:** `POST /api/auth/register`  
**Auth Required:** No  
**Description:** Create a new user account

**Request Body:**

```json
{
	"email": "user@example.com",
	"password": "SecurePass123!",
	"firstName": "John",
	"lastName": "Doe",
	"businessId": "uuid-of-business",
	"role": "USER"
}
```

**Role Options:** `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `USER`, `SUPER_USER`

**Success Response (201):**

```json
{
	"user": {
		"id": "user-uuid",
		"email": "user@example.com",
		"created_at": "2025-10-06T12:00:00.000Z"
	},
	"message": "User successfully registered"
}
```

**Error Response (400):**

```json
{
	"error": "Auth creation failed: User already exists"
}
```

---

### 2. Login

**Endpoint:** `POST /api/auth/login`  
**Auth Required:** No  
**Description:** Authenticate user and receive access token

**Request Body:**

```json
{
	"email": "user@example.com",
	"password": "SecurePass123!"
}
```

**Success Response (200):**

```json
{
	"user": {
		"id": "user-uuid",
		"email": "user@example.com",
		"created_at": "2025-10-06T12:00:00.000Z"
	},
	"session": {
		"access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
		"expires_at": 1760847728,
		"refresh_token": "..."
	},
	"userDetails": {
		"id": "user-uuid",
		"email": "user@example.com",
		"firstName": "John",
		"lastName": "Doe",
		"role": "USER",
		"businessId": "business-uuid",
		"createdAt": "2025-10-06T12:00:00.000",
		"updatedAt": "2025-10-06T12:00:00.000"
	},
	"accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Important:** Save `accessToken` to localStorage for subsequent requests.

**Error Response (401):**

```json
{
	"error": "Login failed: Invalid credentials"
}
```

---

### 3. Get Current User

**Endpoint:** `GET /api/auth/me`  
**Auth Required:** Yes  
**Description:** Get currently logged-in user's information

**Request Headers:**

```
Authorization: Bearer {accessToken}
```

**Success Response (200):**

```json
{
	"user": {
		"id": "user-uuid",
		"email": "user@example.com"
	},
	"userDetails": {
		"id": "user-uuid",
		"email": "user@example.com",
		"firstName": "John",
		"lastName": "Doe",
		"role": "USER",
		"businessId": "business-uuid",
		"createdAt": "2025-10-06T12:00:00.000",
		"updatedAt": "2025-10-06T12:00:00.000"
	},
	"businessId": "business-uuid",
	"role": "USER"
}
```

**Error Response (401):**

```json
{
	"error": "Access token required"
}
```

---

### 4. Update User Profile

**Endpoint:** `PUT /api/auth/me`  
**Auth Required:** Yes  
**Description:** Update current user's profile

**Request Body:**

```json
{
	"firstName": "John Updated",
	"lastName": "Doe Updated",
	"email": "newemail@example.com",
	"password": "NewSecurePass123!"
}
```

**Note:** `email` and `password` are optional fields.

**Success Response (200):**

```json
{
	"id": "user-uuid",
	"email": "newemail@example.com",
	"firstName": "John Updated",
	"lastName": "Doe Updated",
	"role": "USER",
	"businessId": "business-uuid",
	"updatedAt": "2025-10-06T13:00:00.000"
}
```

---

### 5. Logout

**Endpoint:** `POST /api/auth/logout`  
**Auth Required:** Yes  
**Description:** Invalidate current session

**Success Response (200):**

```json
{
	"message": "Logged out successfully"
}
```

**Frontend Action:** Remove token from localStorage after successful logout.

---

### 6. Reset Password

**Endpoint:** `POST /api/auth/reset-password`  
**Auth Required:** No  
**Description:** Send password reset email

**Request Body:**

```json
{
	"email": "user@example.com"
}
```

**Success Response (200):**

```json
{
	"message": "Password reset email sent"
}
```

---

## 📊 Dashboard Endpoints

### 1. Get Dashboard Metrics

**Endpoint:** `GET /api/dashboard`  
**Auth Required:** Yes  
**Description:** Get key metrics for the user's restaurant

**Request Headers:**

```
Authorization: Bearer {accessToken}
```

**Success Response (200):**

```json
{
	"low_stock_alerts": 5,
	"items_expiring_soon": 3,
	"monthly_food_cost": 28.5
}
```

**Notes:**

- Data is automatically filtered to the logged-in user's restaurant
- No need to pass restaurant ID - it's determined from the auth token
- `low_stock_alerts`: Count of items where quantity <= minimum_quantity
- `items_expiring_soon`: Count of items expiring within 7 days
- `monthly_food_cost`: Food cost percentage (currently mock data)

**Error Response (401):**

```json
{
	"error": "Access token required"
}
```

**Error Response (404):**

```json
{
	"error": "No restaurant found for this business. Please contact support."
}
```

---

## 📦 Inventory Endpoints

### 1. Get Inventory List

**Endpoint:** `GET /api/inventory`  
**Auth Required:** Yes  
**Description:** Get all inventory items for the user's restaurant

**Request Headers:**

```
Authorization: Bearer {accessToken}
```

**Success Response (200):**

```json
[
	{
		"id": "inventory-item-uuid",
		"ingredient_id": "ingredient-uuid",
		"ingredient_name": "Chicken Breast",
		"category": "protein",
		"quantity": 50.5,
		"unit": "lbs",
		"minimum_quantity": 20,
		"cost_per_unit": 3.5,
		"location": "walk-in cooler",
		"expiration_date": "2025-11-15",
		"last_restocked": "2025-10-05T10:30:00.000Z"
	},
	{
		"id": "inventory-item-uuid-2",
		"ingredient_id": "ingredient-uuid-2",
		"ingredient_name": "Tomatoes",
		"category": "produce",
		"quantity": 15,
		"unit": "lbs",
		"minimum_quantity": 10,
		"cost_per_unit": 2.25,
		"location": "walk-in cooler",
		"expiration_date": "2025-10-20",
		"last_restocked": "2025-10-04T08:15:00.000Z"
	}
]
```

**Field Descriptions:**

- `id`: Unique inventory item ID
- `ingredient_id`: Reference to ingredient in library
- `ingredient_name`: Human-readable name
- `category`: One of: 'protein', 'produce', 'dairy', 'dry goods', 'alcohol', 'beverages', 'supplies'
- `quantity`: Current amount in stock
- `unit`: Measurement unit ('lbs', 'oz', 'gallons', 'quarts', 'cases', 'each', 'bags')
- `minimum_quantity`: Reorder threshold - alerts when quantity falls below this
- `cost_per_unit`: Cost per unit of measurement
- `location`: Storage location ('walk-in cooler', 'walk-in freezer', 'dry storage', 'bar', 'prep area', 'office')
- `expiration_date`: Date product expires (YYYY-MM-DD format)
- `last_restocked`: Timestamp of last restock

**Error Response (401):**

```json
{
	"error": "Access token required"
}
```

---

### 2. Lookup Ingredient by Barcode

**Endpoint:** `GET /api/inventory/lookup?barcode={barcode}`  
**Auth Required:** Yes  
**Description:** Find ingredient by barcode (used in receiving workflow)

**Request Headers:**

```
Authorization: Bearer {accessToken}
```

**Query Parameters:**

- `barcode` (string, required): The barcode/UPC to search for

**Example:**

```
GET /api/inventory/lookup?barcode=123456789
```

**Success Response (200):**

```json
{
	"id": "ingredient-uuid",
	"name": "Chicken Breast",
	"description": "Boneless, skinless chicken breast",
	"category": "protein",
	"subcategory": "poultry",
	"unit": "lbs",
	"storage_type": "refrigerated",
	"shelf_life_days": 7,
	"barcode": "123456789"
}
```

**Error Response (404):**

```json
{
	"error": "Ingredient not found"
}
```

---

### 3. Receive Inventory

**Endpoint:** `POST /api/inventory/receive`  
**Auth Required:** Yes  
**Description:** Add received items to inventory (creates new or updates existing)

**Request Headers:**

```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request Body:**

```json
{
	"items": [
		{
			"ingredientId": "ingredient-uuid",
			"quantity": 50,
			"unit": "lbs",
			"location": "walk-in cooler",
			"expirationDate": "2025-11-15"
		},
		{
			"ingredientId": "ingredient-uuid-2",
			"quantity": 25,
			"unit": "lbs",
			"location": "walk-in freezer",
			"expirationDate": "2026-01-30"
		}
	]
}
```

**Field Requirements:**

- `ingredientId` (string, required): UUID of ingredient from library
- `quantity` (number, required): Amount received
- `unit` (string, required): Unit of measurement
- `location` (string, required): Where item is stored
- `expirationDate` (string, required): Expiration date in YYYY-MM-DD format

**Success Response (200):**

```json
{
	"success": true,
	"message": "Received 2 items",
	"items": [
		{
			"id": "inventory-uuid-1",
			"restaurant_id": "restaurant-uuid",
			"ingredient_id": "ingredient-uuid",
			"quantity": 50,
			"unit": "lbs",
			"location": "walk-in cooler",
			"expiration_date": "2025-11-15",
			"last_restocked": "2025-10-06T14:30:00.000Z",
			"created_at": "2025-10-06T14:30:00.000Z",
			"updated_at": "2025-10-06T14:30:00.000Z"
		},
		{
			"id": "inventory-uuid-2",
			"restaurant_id": "restaurant-uuid",
			"ingredient_id": "ingredient-uuid-2",
			"quantity": 25,
			"unit": "lbs",
			"location": "walk-in freezer",
			"expiration_date": "2026-01-30",
			"last_restocked": "2025-10-06T14:30:00.000Z",
			"created_at": "2025-10-06T14:30:00.000Z",
			"updated_at": "2025-10-06T14:30:00.000Z"
		}
	]
}
```

**Business Logic:**

- If ingredient already exists in inventory: Add to existing quantity
- If ingredient doesn't exist: Create new inventory record
- Always update `last_restocked` timestamp
- `expiration_date` is set to most recent value

**Error Response (400):**

```json
{
	"error": "Missing required field: ingredientId"
}
```

---

## 🗂️ Data Models & Types

### User

```javascript
{
  id: string (UUID)
  email: string
  firstName: string
  lastName: string
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER' | 'SUPER_USER'
  businessId: string (UUID)
  avatar: string | null
  createdAt: string (ISO timestamp)
  updatedAt: string (ISO timestamp)
  emailVerified: string | null
}
```

### Inventory Item

```javascript
{
  id: string (UUID)
  ingredient_id: string (UUID)
  ingredient_name: string
  category: 'protein' | 'produce' | 'dairy' | 'dry goods' | 'alcohol' | 'beverages' | 'supplies'
  quantity: number (decimal)
  unit: 'lbs' | 'oz' | 'gallons' | 'quarts' | 'cases' | 'each' | 'bags'
  minimum_quantity: number (decimal) | null
  cost_per_unit: number (decimal) | null
  location: 'walk-in cooler' | 'walk-in freezer' | 'dry storage' | 'bar' | 'prep area' | 'office'
  expiration_date: string (YYYY-MM-DD) | null
  last_restocked: string (ISO timestamp) | null
}
```

### Dashboard Metrics

```javascript
{
	low_stock_alerts: number;
	items_expiring_soon: number;
	monthly_food_cost: number(percentage);
}
```

### Ingredient (Library)

```javascript
{
	id: string(UUID);
	name: string;
	description: string | null;
	category: string;
	subcategory: string | null;
	unit: string;
	storage_type: "refrigerated" | "frozen" | "dry" | "room temp";
	shelf_life_days: number | null;
	barcode: string | null;
}
```

---

## 🎨 UI/UX Requirements

### Pages to Build

#### 1. Login Page (`/login`)

- Email input
- Password input
- "Login" button
- "Forgot Password?" link
- On success: Save token to localStorage, redirect to `/dashboard`

#### 2. Dashboard Page (`/dashboard`)

- Protected route (requires auth)
- Display 3 metric cards:
  - Low Stock Alerts (with ⚠️ icon)
  - Items Expiring Soon (with 📅 icon)
  - Monthly Food Cost % (with 💰 icon)
- Navigation to Inventory and Receiving pages

#### 3. Inventory List Page (`/inventory`)

- Protected route (requires auth)
- Display all inventory items in grid/list
- Filters:
  - "All Items" (default)
  - "Low Stock" (quantity <= minimum_quantity)
  - "Expiring Soon" (expires within 7 days)
- Each item shows:
  - Ingredient name
  - Category
  - Quantity + unit
  - Minimum quantity
  - Location
  - Expiration date
  - Visual indicators for low stock / expiring soon

#### 4. Receiving Page (`/receiving`)

- Protected route (requires auth)
- Barcode scanner input (manual entry for MVP)
- Form for each scanned item:
  - Ingredient name (auto-filled from lookup)
  - Quantity input
  - Unit dropdown
  - Location dropdown
  - Expiration date picker
- "Add to Receiving List" button
- Display list of items to receive
- "Complete Receiving" button (calls POST /api/inventory/receive)

---

## 🔒 Authentication Implementation

### Axios Instance with Interceptor

Create a reusable Axios instance that automatically adds auth headers:

```javascript
// src/api/axios.js
import axios from "axios";

const api = axios.create({
	baseURL: "http://localhost:3001/api",
});

// Request interceptor - add token to all requests
api.interceptors.request.use(
	(config) => {
		const token = localStorage.getItem("auth_token");
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}
		return config;
	},
	(error) => {
		return Promise.reject(error);
	}
);

// Response interceptor - handle 401 errors
api.interceptors.response.use(
	(response) => response,
	(error) => {
		if (error.response?.status === 401) {
			// Token expired or invalid - logout user
			localStorage.removeItem("auth_token");
			window.location.href = "/login";
		}
		return Promise.reject(error);
	}
);

export default api;
```

### Auth Context Provider

```javascript
// src/contexts/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from "react";
import api from "../api/axios";

const AuthContext = createContext();

export function AuthProvider({ children }) {
	const [user, setUser] = useState(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		// Check if user is logged in on mount
		const token = localStorage.getItem("auth_token");
		if (token) {
			fetchCurrentUser();
		} else {
			setLoading(false);
		}
	}, []);

	const fetchCurrentUser = async () => {
		try {
			const response = await api.get("/auth/me");
			setUser(response.data.userDetails);
		} catch (error) {
			console.error("Failed to fetch user:", error);
			localStorage.removeItem("auth_token");
		} finally {
			setLoading(false);
		}
	};

	const login = async (email, password) => {
		const response = await api.post("/auth/login", { email, password });
		localStorage.setItem("auth_token", response.data.accessToken);
		setUser(response.data.userDetails);
		return response.data;
	};

	const logout = async () => {
		try {
			await api.post("/auth/logout");
		} catch (error) {
			console.error("Logout error:", error);
		} finally {
			localStorage.removeItem("auth_token");
			setUser(null);
		}
	};

	const value = {
		user,
		loading,
		login,
		logout,
		isAuthenticated: !!user,
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	return useContext(AuthContext);
}
```

### Protected Route Component

```javascript
// src/components/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function ProtectedRoute({ children }) {
	const { isAuthenticated, loading } = useAuth();

	if (loading) {
		return <div>Loading...</div>;
	}

	if (!isAuthenticated) {
		return (
			<Navigate
				to="/login"
				replace
			/>
		);
	}

	return children;
}
```

---

## 🔄 TanStack Query Setup

### Query Client Configuration

```javascript
// src/api/queryClient.js
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 1000 * 60 * 5, // 5 minutes
			cacheTime: 1000 * 60 * 10, // 10 minutes
			refetchOnWindowFocus: false,
			retry: 1,
		},
	},
});
```

### Example Query Hooks

```javascript
// src/hooks/useInventory.js
import { useQuery } from "@tanstack/react-query";
import api from "../api/axios";

export function useInventory() {
	return useQuery({
		queryKey: ["inventory"],
		queryFn: async () => {
			const response = await api.get("/inventory");
			return response.data;
		},
	});
}

// src/hooks/useDashboard.js
import { useQuery } from "@tanstack/react-query";
import api from "../api/axios";

export function useDashboard() {
	return useQuery({
		queryKey: ["dashboard"],
		queryFn: async () => {
			const response = await api.get("/dashboard");
			return response.data;
		},
	});
}
```

### Example Mutation Hook

```javascript
// src/hooks/useReceiveInventory.js
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/axios";

export function useReceiveInventory() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (items) => {
			const response = await api.post("/inventory/receive", { items });
			return response.data;
		},
		onSuccess: () => {
			// Invalidate and refetch inventory after receiving
			queryClient.invalidateQueries({ queryKey: ["inventory"] });
			queryClient.invalidateQueries({ queryKey: ["dashboard"] });
		},
	});
}
```

---

## 📱 Routing Structure

```javascript
// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { queryClient } from "./api/queryClient";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Receiving from "./pages/Receiving";

function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<AuthProvider>
				<BrowserRouter>
					<Routes>
						<Route
							path="/login"
							element={<Login />}
						/>
						<Route
							path="/"
							element={<Navigate to="/dashboard" />}
						/>
						<Route
							path="/dashboard"
							element={
								<ProtectedRoute>
									<Dashboard />
								</ProtectedRoute>
							}
						/>
						<Route
							path="/inventory"
							element={
								<ProtectedRoute>
									<Inventory />
								</ProtectedRoute>
							}
						/>
						<Route
							path="/receiving"
							element={
								<ProtectedRoute>
									<Receiving />
								</ProtectedRoute>
							}
						/>
					</Routes>
				</BrowserRouter>
			</AuthProvider>
		</QueryClientProvider>
	);
}

export default App;
```

---

## 🎨 Design Guidelines

### Mobile-First Responsive Design

- Primary target: Tablet devices (iPad size)
- Must work on mobile phones
- Desktop support secondary

### Tailwind CSS Classes to Use

- Use only **core utility classes** (no custom classes)
- No Tailwind compiler available
- Stick to base Tailwind stylesheet classes

### Color Scheme

- Primary color: Green (food/fresh theme)
- Alerts/Warnings: Yellow/Amber
- Errors: Red
- Success: Green
- Neutral: Gray scale

### Component Patterns

- Use functional components only
- React Hooks for state management
- No class components

---

## ⚠️ Important Notes

### Database Column Naming

- **Users table:** Uses camelCase (`firstName`, `lastName`, `businessId`)
- **Restaurant tables:** Use snake_case (`restaurant_id`, `ingredient_id`, `expiration_date`)
- API responses return snake_case for restaurant data, camelCase for user data
- Be prepared to handle both conventions

### Error Handling

All API errors follow this format:

```json
{
	"error": "Error message here"
}
```

Status codes:

- `200`: Success
- `201`: Created
- `400`: Bad Request (validation error)
- `401`: Unauthorized (no token or invalid token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `500`: Internal Server Error

### Business Logic Rules

**Low Stock Detection:**

- Item is "low stock" when: `quantity <= minimum_quantity`
- Show warning indicator on inventory cards

**Expiring Soon Detection:**

- Item is "expiring soon" when: expiration date is within 7 days
- Show urgent indicator on inventory cards

**Receiving Logic:**

- If ingredient exists in inventory: Add to existing quantity
- If ingredient doesn't exist: Create new inventory record
- Always update `last_restocked` timestamp

---

## 🧪 Testing Credentials

For development/testing, you can use:

```
Email: manager@restaurant.com
Password: SecurePass123!
Business ID: c3d4e5f6-a7b8-4c5d-0e1f-2a3b4c5d6e7f
Role: MANAGER
```

---

## 📦 Environment Variables

Create `.env` file in frontend root:

```
VITE_API_URL=http://localhost:3001/api
```

Usage in code:

```javascript
const API_URL = import.meta.env.VITE_API_URL;
```

---

## 🚀 Getting Started Checklist

1. ✅ Set up Vite React project (no TypeScript)
2. ✅ Install dependencies: react-router-dom, @tanstack/react-query, axios, tailwindcss
3. ✅ Configure Tailwind CSS
4. ✅ Create Axios instance with interceptors
5. ✅ Create AuthContext and AuthProvider
6. ✅ Create ProtectedRoute component
7. ✅ Set up React Router with routes
8. ✅ Build Login page
9. ✅ Build Dashboard page with metrics
10. ✅ Build Inventory list page
11. ✅ Build Receiving workflow page
12. ✅ Test all flows end-to-end

---

## 📚 Additional Resources

**Backend GitHub:** [Not provided - running locally]  
**API Documentation:** This document  
**Design Mockups:** To be created by frontend developer  
**Backend Developer Contact:** Available for questions via original chat session

---

## 🎯 Success Criteria

The frontend is complete when:

- ✅ Users can login and logout
- ✅ Dashboard displays real metrics from API
- ✅ Inventory list shows all items with proper filtering
- ✅ Low stock and expiring items are visually highlighted
- ✅ Receiving workflow allows adding items to inventory
- ✅ All pages are mobile-responsive
- ✅ Auth token is properly managed
- ✅ 401 errors redirect to login
- ✅ Loading and error states are handled gracefully

---

**Document Version:** 1.0  
**Last Updated:** October 6, 2025  
**Status:** Ready for Frontend Development
