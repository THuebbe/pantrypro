# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Invantry is a mobile-first restaurant inventory management system built with a React frontend and Express.js backend, using Supabase as the database. The application helps restaurant staff track inventory, manage receiving workflows, and monitor key metrics.

## Architecture

### Frontend (React + Vite)
- **Location**: `frontend/` directory
- **Framework**: React 18 with Vite
- **Language**: JavaScript (NO TypeScript)
- **Styling**: Tailwind CSS + HeroUI components
- **State Management**: React hooks + TanStack Query for server state
- **Routing**: React Router v6

### Backend (Express.js)
- **Location**: `backend/` directory 
- **Framework**: Express.js
- **Language**: JavaScript ES modules
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth with JWT tokens

## Development Commands

### Frontend Commands
```bash
cd frontend
npm run dev          # Start development server (port 5173)
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm test             # Run Vitest tests
npm run test:ui      # Run tests with UI
npm run test:coverage # Run tests with coverage
```

### Backend Commands
```bash
cd backend
npm run dev          # Start with nodemon (port 3001)
npm start            # Start production server
```

### Root Commands
```bash
npm install          # Install SQLite3 dependency for local development
```

## Key Architecture Patterns

### Configuration-Driven Development
The app uses a restaurant-specific configuration file (`frontend/src/config/restaurant.js`) that defines:
- Business type settings
- Database table mappings
- Dashboard metrics
- Product categories and units
- UI configuration

This pattern allows the codebase to be adapted for other business types by changing the config.

### Service Layer Pattern
Backend follows a service-oriented pattern:
- `routes/` - Express route handlers
- `services/` - Business logic and data access
- `middleware/` - Authentication and error handling

Key services include:
- `services/supabase.js` - Database client and query utilities
- `services/auth.js` - Authentication logic
- `services/inventory.js` - Inventory management
- `services/menuItemService.js` - Menu item management

### Component Architecture
Frontend uses a hierarchical component structure:
- `pages/` - Route components (Dashboard, Login, Register)
- `components/` - Reusable UI components organized by feature
  - `dashboard/` - Dashboard-specific components
  - `inventory/` - Inventory management components
  - `menu-items/` - Menu item components
  - `shared/` - Common UI components
- `core/` - Core functionality (auth, database, hooks)

## Database Structure

### Core Tables
- `users` - User accounts (camelCase columns)
- `businesses` - Business entities
- `restaurants` - Restaurant-specific data
- `ingredient_library` - Master ingredient catalog
- `restaurant_inventory` - Current inventory levels
- `menu_items` - Restaurant menu items
- `recipe_ingredients` - Menu item recipes

### Important Notes
- User table uses camelCase (`firstName`, `businessId`)
- Restaurant tables use snake_case (`ingredient_id`, `expiration_date`)
- API responses maintain these naming conventions

## Authentication Flow

1. User logs in via `/api/auth/login`
2. Backend returns JWT access token
3. Frontend stores token in localStorage as `auth_token`
4. All protected requests include `Authorization: Bearer {token}` header
5. 401 responses trigger automatic logout and redirect to login

## Key API Endpoints

- `GET /api/dashboard` - Dashboard metrics
- `GET /api/inventory` - Inventory list
- `POST /api/inventory/receive` - Add inventory items
- `GET /api/inventory/lookup?barcode={code}` - Barcode lookup
- `GET /api/menu-items` - Menu items list
- `POST /api/menu-items` - Create menu item
- `GET /api/recipes/{id}` - Recipe details

## Development Guidelines

### Code Style
- Use functional components with React hooks
- Follow existing naming conventions (camelCase for React, snake_case for API)
- Use Tailwind utility classes for styling
- Implement proper error handling and loading states

### State Management
- Use React Query for server state (caching, background updates)
- Use React hooks for local component state
- AuthContext for user authentication state

### Testing
- Frontend uses Vitest with jsdom environment
- Test files use `.test.js` extension
- Coverage excludes test files and configuration

## Common Development Tasks

### Adding New API Endpoints
1. Create route handler in `backend/src/routes/`
2. Implement business logic in appropriate service file
3. Add route to main server file (`backend/src/index.js`)

### Adding New Frontend Pages
1. Create page component in `frontend/src/pages/`
2. Add route to App.jsx routing configuration
3. Create corresponding navigation and components

### Working with Forms
- Use controlled components with useState
- Implement proper validation
- Handle loading and error states
- Use React Query mutations for data submission

### Working with Inventory
- Filter functions are implemented for low stock and expiring items
- Receiving workflow uses multi-step form pattern
- Barcode scanning is manual entry in current MVP

## Important Files to Understand

### Frontend Core
- `frontend/src/App.jsx` - Main app component with routing
- `frontend/src/core/auth/AuthContext.jsx` - Authentication context
- `frontend/src/core/database/api.js` - Axios instance with interceptors
- `frontend/src/config/restaurant.js` - Business configuration

### Backend Core  
- `backend/src/index.js` - Express server setup
- `backend/src/services/supabase.js` - Database client
- `backend/src/middleware/auth.js` - JWT authentication middleware
- `backend/src/routes/` - API route handlers

## Troubleshooting

### Common Issues
- **CORS errors**: Check backend CORS configuration includes frontend URL
- **401 Unauthorized**: Check token storage and Authorization header format  
- **Database connection**: Verify SUPABASE_URL and SUPABASE_SERVICE_KEY in backend .env
- **Build failures**: Ensure all dependencies are installed in both frontend and backend

### Environment Variables
Frontend `.env`:
```
VITE_API_URL=http://localhost:3001/api
```

Backend `.env`:
```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
PORT=3001
POS_CREDENTIALS_KEY=64_hex_chars   # encrypts stored POS credentials; see backend/.env.example
```

## Testing Strategy

- Backend: Manual testing with API endpoints
- Frontend: Component tests with Vitest
- Integration: End-to-end workflow testing
- Coverage: Focused on business logic and user interactions