# Fooda Tech Stack & Architecture

## 🏗️ Technology Stack

### Frontend (Web Application)
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite (Fast development server & build)
- **Styling**: Tailwind CSS v4
- **Routing**: React Router v6
- **Icons**: Lucide React
- **State Management**: React Context API (AuthContext)

### Backend & Database
- **Backend**: Supabase (PostgreSQL + REST API + Real-time)
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage (for future file uploads)
- **Row Level Security**: PostgreSQL RLS policies

### Development Tools
- **Package Manager**: npm
- **TypeScript**: Type safety across the application
- **Hot Module Replacement**: Vite HMR for instant updates

## 📊 Current Architecture

```
┌─────────────────────────────────────────────────┐
│           React Frontend (Vite)                 │
│  ┌──────────────┐  ┌──────────────┐            │
│  │ Landing Page │  │ Auth Page    │            │
│  └──────────────┘  └──────────────┘            │
│  ┌──────────────┐  ┌──────────────┐            │
│  │ Admin Dash   │  │ Vendor Dash  │            │
│  └──────────────┘  └──────────────┘            │
└─────────────────────────────────────────────────┘
                    ↓ ↑
              Supabase Client
                    ↓ ↑
┌─────────────────────────────────────────────────┐
│              Supabase Backend                   │
│  ┌──────────────┐  ┌──────────────┐            │
│  │ PostgreSQL   │  │ Auth Service │            │
│  │ Database     │  │              │            │
│  └──────────────┘  └──────────────┘            │
│  ┌──────────────┐  ┌──────────────┐            │
│  │ REST API     │  │ Real-time    │            │
│  │              │  │ Subscriptions│            │
│  └──────────────┘  └──────────────┘            │
└─────────────────────────────────────────────────┘
```

## 🐌 Performance Issues Identified

### 1. **Multiple Database Queries on Dashboard Load**
**Problem**: Each dashboard fetches data separately
- Vendors query
- Orders query
- Menu items query
- Categories query
- Settings query

**Impact**: 5+ sequential database calls = slow load time

### 2. **No Caching**
**Problem**: Every page load fetches fresh data
**Impact**: Unnecessary network requests

### 3. **Large Data Transfers**
**Problem**: Fetching all orders/vendors without pagination
**Impact**: Slow with large datasets

### 4. **Authentication Timeout**
**Problem**: 10-second timeout in AuthContext
**Impact**: Users wait unnecessarily

### 5. **No Loading States**
**Problem**: Blank screen while loading
**Impact**: Feels slower than it is

### 6. **Unoptimized Queries**
**Problem**: Not using database indexes effectively
**Impact**: Slow query execution

### 7. **Real-time Subscriptions**
**Problem**: Not implemented but code checks for them
**Impact**: Wasted processing

## 🚀 Optimization Strategy

### Immediate Wins (Quick Fixes)
1. ✅ Reduce auth timeout
2. ✅ Add loading skeletons
3. ✅ Optimize database queries
4. ✅ Add pagination
5. ✅ Implement data caching

### Medium-term Improvements
1. Code splitting
2. Lazy loading routes
3. Image optimization
4. Service worker for offline support

### Long-term Enhancements
1. Redis caching layer
2. CDN for static assets
3. Database query optimization
4. Server-side rendering (SSR)

## 📦 Dependencies

### Production Dependencies
```json
{
  "@supabase/supabase-js": "^2.x",
  "react": "^18.x",
  "react-dom": "^18.x",
  "react-router-dom": "^6.x",
  "lucide-react": "^0.x"
}
```

### Dev Dependencies
```json
{
  "@vitejs/plugin-react": "^4.x",
  "typescript": "^5.x",
  "vite": "^5.x",
  "@tailwindcss/postcss": "^4.x"
}
```

## 🎯 Performance Metrics (Before Optimization)

- **Initial Load**: ~3-5 seconds
- **Dashboard Load**: ~2-4 seconds
- **Auth Check**: ~10 seconds (timeout)
- **Database Queries**: 5-10 per page load
- **Bundle Size**: ~500KB (estimated)

## 🎯 Performance Targets (After Optimization)

- **Initial Load**: <1 second
- **Dashboard Load**: <1 second
- **Auth Check**: <2 seconds
- **Database Queries**: 1-2 per page load
- **Bundle Size**: <300KB

## 🔧 Optimization Plan

See `PERFORMANCE_OPTIMIZATION.md` for detailed implementation.
