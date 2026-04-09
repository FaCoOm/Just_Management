# Latte Lounge Dashboard — Technical Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser / Client                          │
├─────────────────────────────────────────────────────────────────┤
│                    React App (src/App.tsx)                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ SidebarProvider (Context: sidebar state, mobile toggle) │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │                                                         │   │
│  │  ┌──────────────┐  ┌────────────────┐  ┌────────────┐  │   │
│  │  │ AppSidebar   │  │ DashboardPage  │  │ Bookings   │  │   │
│  │  │ (Left nav)   │  │ (Main content) │  │ Panel      │  │   │
│  │  │              │  │                │  │ (Right)    │  │   │
│  │  └──────────────┘  └────────────────┘  └────────────┘  │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│ Hooks Layer:                                                     │
│ ├─ useTheme() [Theme Provider]                                 │
│ ├─ useSidebar() [Sidebar Context]                              │
│ ├─ useMobile() [Responsive breakpoint detector]                │
│ └─ useDashboardData() [Custom: fetches/computes metrics]       │
│                                                                  │
│ Styling Layer (Tailwind CSS v4 + Custom Tokens):               │
│ ├─ Design tokens: --harbor, --harbor-deep, --brass             │
│ ├─ Font stack: Plus Jakarta Sans (body), Newsreader (headers)  │
│ └─ OKLCH colors in :root and .dark sections                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
           │                                        │
           │ fetch(api)                            │ localStorage
           │ Real-time subs (future)               │ theme, sidebar state
           │                                        │
           ▼                                        ▼
┌─────────────────────────────────┐   ┌──────────────────────┐
│      Data Layer                 │   │  Browser Storage     │
├─────────────────────────────────┤   ├──────────────────────┤
│ Current: Static JS objects      │   │ localStorage keys:   │
│ ├─ src/data/properties.ts       │   │ ├─ vite-ui-theme     │
│ ├─ src/data/guests.ts          │   │ ├─ sidebar_state     │
│ ├─ src/data/maintenance.ts     │   │ └─ (custom keys)     │
│ └─ src/data/metrics.ts         │   │                      │
│                                 │   │                      │
│ Supabase Client (optional):     │   └──────────────────────┘
│ ├─ src/lib/supabase.ts         │
│ ├─ Tables: properties, rooms,   │
│ │  guests, guest_requests,      │
│ │  maintenance_issues           │
│ └─ Auth: Not yet implemented    │
│                                 │
└─────────────────────────────────┘
           │
           │ SQL queries
           │ Real-time subs (future)
           │
           ▼
┌──────────────────────────────────┐
│   Supabase Backend               │
├──────────────────────────────────┤
│ PostgreSQL Database              │
│ ├─ properties (8 rows)           │
│ ├─ rooms (94 rows)               │
│ ├─ guests (64 rows)              │
│ ├─ guest_requests (32 rows)      │
│ ├─ maintenance_issues (23 rows)  │
│ └─ RLS policies (partial)        │
│                                  │
│ Authentication (not yet set up)  │
│ ├─ Email/password auth           │
│ ├─ JWT tokens                    │
│ └─ User roles/permissions        │
│                                  │
└──────────────────────────────────┘
```

---

## Component Hierarchy & Data Flow

### Dashboard Page Layout

```
DashboardPage (Main container)
│
├─ Header
│  ├─ Greeting ("Good morning")
│  ├─ Search field (guest/room search)
│  ├─ Property dropdown ("All Properties")
│  ├─ Notifications bell
│  └─ Date display ("Thursday, April 9, 2026")
│
├─ KpiSummary (4 cards grid)
│  ├─ Card: Arrivals (13)
│  ├─ Card: Departures (4)
│  ├─ Card: Occupancy (14%)
│  └─ Card: Maintenance (12)
│
├─ OccupancyChart (14-day trend)
│  └─ Recharts BarChart (stacked: occupied vs. available)
│
├─ RevenueOverview (by booking channel)
│  └─ Recharts BarChart (horizontal bars)
│
├─ RecentArrivals (Table)
│  └─ 6 checked-in guests with avatars
│
├─ BranchComparison (Property table)
│  └─ All 8 properties sorted by occupancy
│
├─ ArrivalsDetail (Today's arrivals)
│  └─ List of guests arriving today
│
├─ DeparturesDetail (Today's departures)
│  └─ List of guests leaving today
│
├─ OccupancyDetail (Occupancy breakdown)
│  └─ All properties with occupancy %, progress bars
│
└─ MaintenanceDetail (Open issues)
   └─ Issues grouped by property, sorted by severity
```

### Data Compute Pipeline

```
Raw Data (src/data/*)
├─ properties[] (8)
├─ guests[] (20)
├─ maintenance_issues[] (12)
│
└─> metrics.ts (compute functions)
    ├─ computeMetrics() → PropertyMetrics[]
    │  ├─ Filter guests by property
    │  ├─ Count occupied rooms
    │  ├─ Calculate occupancy rate
    │  ├─ Count today's arrivals/departures
    │  ├─ Count open maintenance
    │  └─ Base revenue lookup
    │
    ├─ portfolioTotals (aggregated across all properties)
    │  ├─ totalRooms
    │  ├─ occupiedRooms
    │  ├─ arrivalsToday
    │  ├─ departuresToday
    │  ├─ maintenanceOpen
    │  ├─ totalRevenue
    │  └─ avgOccupancy
    │
    ├─ revenueByChannel[] (4 channels)
    │  └─ Booking.com, Direct, Agoda, Airbnb (mock data)
    │
    └─ occupancyByDay[] (14-day trend)
       └─ Random mock data (replace with real data when connected to Supabase)
```

---

## File Organization & Responsibilities

### `/src/types/database.ts`
**Purpose:** TypeScript interfaces for all data models
**Contains:**
- `Property` interface (properties table schema)
- `Room` interface (rooms table schema)
- `Guest` interface (guests table schema)
- `GuestRequest` interface (guest_requests table schema)
- `MaintenanceIssue` interface (maintenance_issues table schema)
- `PropertyMetrics` interface (computed metrics)

**Usage:** Import and use for type-safe data handling across components

---

### `/src/lib/supabase.ts`
**Purpose:** Supabase client initialization
**Contains:**
- `supabase` client instance (creates from env vars)
- `isSupabaseConfigured` boolean flag

**Current Behavior:**
- Attempts to create client from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Gracefully handles missing credentials (returns null)

**Future Enhancement:** Replace static data imports with real Supabase queries

---

### `/src/data/*.ts`
**Purpose:** Static seed data (temporary; replace with Supabase when ready)
**Files:**
- `properties.ts` - 8 properties (id, name, location, room count)
- `guests.ts` - 20 guests (staggered ETAs/ETDs, mix of check-in statuses, VIP flags)
- `maintenance.ts` - 12 maintenance issues (varied severity, status, properties)
- `metrics.ts` - Computed metrics from seed data

**Timeline:** Remove after Supabase integration; keep as fallback example

---

### `/src/hooks/use-dashboard-data.ts`
**Purpose:** Custom hook for fetching and computing dashboard metrics
**Current Implementation:**
- Imports static data from `src/data/`
- Returns computed metrics

**Future Enhancement:**
```typescript
export function useDashboardData() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Fetch from Supabase instead of static data
    supabase.from('properties')
      .select('*')
      .then(computeMetrics)
      .then(setData)
  }, [])

  return { data, loading, error }
}
```

---

### `/src/components/dashboard/*.tsx`
**Purpose:** Individual dashboard panels
**Naming Convention:** Component name matches feature (e.g., `KpiSummary`, `OccupancyChart`)

**Key Components:**

| Component | Responsibility | Data Source |
|-----------|-----------------|-------------|
| `dashboard-page.tsx` | Main container, layout | `useDashboardData()` |
| `header.tsx` | Top bar UI | Props from `dashboard-page` |
| `kpi-summary.tsx` | 4 KPI cards | Props: totals object |
| `occupancy-chart.tsx` | 14-day stacked bar | Props: occupancyByDay[] |
| `revenue-overview.tsx` | Revenue by channel | Props: revenueByChannel[] |
| `recent-arrivals.tsx` | Guest table | Props: guests[], rooms[] |
| `branch-comparison.tsx` | Property metrics table | Props: metrics[] |
| `arrivals-detail.tsx` | Today's arrivals | Props: guests[] filtered |
| `departures-detail.tsx` | Today's departures | Props: guests[] filtered |
| `occupancy-detail.tsx` | Occupancy by property | Props: metrics[] |
| `maintenance-detail.tsx` | Maintenance queue | Props: maintenance[], properties[] |
| `bookings-panel.tsx` | Right sidebar | Props: guests[] |

**Pattern:**
```typescript
interface ComponentProps {
  data: Type
  onAction?: (id: string) => void
}

export function MyComponent({ data, onAction }: ComponentProps) {
  // Render using shadcn/ui components
  // Use design system tokens for styling
  // Call onAction callbacks for user interactions
}
```

---

### `/src/components/ui/*.tsx`
**Purpose:** Reusable UI primitives (installed via shadcn CLI)
**Count:** 20 pre-installed components
- `button.tsx`, `card.tsx`, `input.tsx`, `select.tsx`, `table.tsx`, etc.

**Usage:** Import and use as building blocks for dashboard components
**Styling:** Built-in Tailwind CSS v4 + custom tokens

---

### `/src/index.css`
**Purpose:** Global styles + design tokens
**Contains:**
1. Tailwind CSS imports (`@import "tailwindcss"`)
2. `@theme inline` directive mapping CSS vars to Tailwind utilities
3. `:root` CSS variables (colors, fonts, spacing)
4. `.dark` CSS variables (dark mode overrides)
5. Custom token definitions:
   - `--harbor`, `--harbor-deep`, `--brass` (Harbor & Hearth palette)
   - `--chart-1` through `--chart-5` (chart colors)
   - Font families (`--font-sans`, `--font-serif`)

**No component-specific styles here** (each component is self-contained with shadcn/ui + Tailwind)

---

### `/src/App.tsx`
**Purpose:** Root component
**Structure:**
```typescript
<SidebarProvider>
  <AppSidebar />
  <SidebarInset>
    <DashboardPage />
  </SidebarInset>
</SidebarProvider>
```

**Key Props:**
- `SidebarProvider`: Manages sidebar open/close state, responsive behavior
- `SidebarInset`: Wraps main content, adjusts padding when sidebar is collapsed

---

## State Management Strategy

### Current (No External Libraries)
- **React Hooks:** `useState` for local component state (e.g., search filters, dropdowns)
- **React Context:** `SidebarProvider`, `ThemeProvider` for app-level state
- **Static Data:** Imported JS objects (no real-time sync)

### Future (When Adding Features)
**Option A: React Context + useReducer** (Minimal, built-in)
- Centralize dashboard state (selected property, date range, filters)
- No external dependencies

**Option B: TanStack Query (React Query)** (Recommended for async data)
- Handle Supabase fetching, caching, background sync
- Real-time subscription support

**Option C: Zustand** (Lightweight alternative)
- Simpler than Redux, good for medium-sized apps
- Less boilerplate than Context

### Recommended Path
1. **Phase 1:** Stay with React Hooks + Context
2. **Phase 2:** Add React Query for Supabase data fetching
3. **Phase 3:** Consider Zustand if state becomes complex

---

## Styling System

### Tailwind CSS v4 + Custom Tokens

**Color Tokens (src/index.css):**
```css
:root {
  --harbor: #4F6FB5;              /* Primary blue */
  --harbor-foreground: #ffffff;   /* Text on harbor */
  --harbor-deep: #35569B;         /* Secondary blue */
  --brass: #B89A6A;               /* Accent brass */
  --brass-foreground: #ffffff;
}

.dark {
  /* Dark mode overrides (not implemented yet) */
}

@theme inline {
  --color-harbor: var(--harbor);
  --color-harbor-deep: var(--harbor-deep);
  --color-brass: var(--brass);
  /* Maps CSS vars to Tailwind utilities */
  /* Allows: bg-harbor, text-harbor-deep, etc. */
}
```

**Font Tokens:**
```css
@theme inline {
  --font-sans: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
  --font-serif: "Newsreader", ui-serif, Georgia, serif;
}
```

**Usage in Components:**
```typescript
<div className="bg-harbor text-harbor-foreground">         {/* Primary */}
<div className="bg-harbor-deep/10 text-harbor-deep">      {/* Secondary, muted */}
<div className="font-serif text-2xl font-semibold">       {/* Serif headlines */}
<div className="font-sans text-sm">                       {/* Body text */}
```

**No inline styles allowed** — always use Tailwind utilities + tokens

---

## Responsive Design

### Breakpoints (Tailwind v4)
- `sm`: 640px (mobile)
- `md`: 768px (tablet)
- `lg`: 1024px (desktop)
- `xl`: 1280px (large desktop)

### Layout Adjustments
**Desktop (lg+):**
```
┌─────────────────────────────────────────────┐
│ Sidebar │        Main Content       │ Panel │
│  200px  │        ~800px             │ 300px │
└─────────────────────────────────────────────┘
```

**Tablet (md-lg):**
```
┌─────────────────────────────────────┐
│ Collapsible Sidebar (drawer)        │
│        Main Content                 │
│        Panel below (stacked)        │
└─────────────────────────────────────┘
```

**Mobile (sm):**
```
┌─────────────────────┐
│ Sidebar (Sheet)     │ (toggle with icon)
│ Main Content        │
│ Panel (Sheet)       │ (toggle with icon)
└─────────────────────┘
```

### Component-Level Responsive Classes
```typescript
<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
  {/* 2 columns on mobile, 4 on desktop */}
</div>

<Table className="hidden md:table">
  {/* Hidden on mobile, visible on tablet+ */}
</Table>
```

---

## Performance Considerations

### Bundle Size
- **Current:** ~743 KB (minified JS), 67 KB (CSS)
- **Issue:** Chunk size warning for recharts + shadcn/ui components
- **Solution:** Code-splitting or manual chunks (future)

### Rendering Optimization
- **Memoization:** Not implemented (add if tables become large)
- **Lazy Loading:** Not implemented (add routes as needed)
- **Image Optimization:** Not applicable (no images currently)

### Recommendations
1. Split large components into smaller modules
2. Use React.memo for static table rows
3. Implement pagination for tables (currently limited to 6-8 rows per view)
4. Add virtualization for large lists (future: 100+ rows)

---

## Error Handling Strategy

### Current
- Silent failure: Static data always available
- No error UI or user feedback

### Future (After Supabase Connection)
1. **Network Errors:**
   - Catch fetch/query errors
   - Show toast notification: "Failed to load data"
   - Retry button with exponential backoff

2. **Auth Errors:**
   - Catch 401/403 from Supabase
   - Redirect to login page
   - Clear user session

3. **Validation Errors:**
   - Catch form submission errors (check-in, maintenance updates)
   - Show field-level error messages
   - Highlight invalid fields

4. **Real-time Errors:**
   - Log subscription failures
   - Attempt reconnection
   - Fallback to polling

---

## Testing Strategy (Recommended Future Work)

### Unit Tests
- Test compute functions in `src/data/metrics.ts`
- Test utility functions in `src/lib/utils.ts`
- Tool: Vitest or Jest

### Component Tests
- Test individual dashboard components in isolation
- Mock data prop
- Tool: Vitest + React Testing Library

### Integration Tests
- Test data flow from Supabase through components
- Mock Supabase client
- Tool: Playwright or Cypress

### E2E Tests
- Test full user workflows (filter, check-in, etc.)
- Run against staging environment
- Tool: Playwright

---

## Deployment Checklist

- [ ] Add Supabase credentials to `.env.production`
- [ ] Run `npm run build` and verify `dist/` folder
- [ ] Test dark mode toggle
- [ ] Test responsive layout on mobile
- [ ] Set up auth guard (protect routes)
- [ ] Configure RLS policies in Supabase
- [ ] Set up error tracking (e.g., Sentry)
- [ ] Configure CDN for static assets
- [ ] Set up CI/CD pipeline (GitHub Actions)
- [ ] Test on production URLs (Vercel/Netlify)

---

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | 19.2.4 | UI framework |
| `typescript` | ~5.9.3 | Type safety |
| `vite` | ^7.3.1 | Build tool |
| `tailwindcss` | ^4.2.1 | Styling |
| `@supabase/supabase-js` | ^2.102.1 | Database client |
| `recharts` | ^3.8.0 | Charts |
| `lucide-react` | ^1.6.0 | Icons |
| `radix-ui` | ^1.4.3 | Headless UI (shadcn uses this) |
| `sonner` | ^2.0.7 | Toast notifications |
| `date-fns` | ^4.1.0 | Date utilities |

---

## Future Migrations

### v2: Real-time Features
- Supabase real-time subscriptions
- WebSocket connections for live updates
- Optimistic UI updates

### v3: Advanced Analytics
- Historical data analysis
- Forecasting models
- Custom reports

### v4: Mobile App
- React Native version
- Offline-first capabilities
- Push notifications

### v5: AI Integration
- AI-powered recommendations
- Anomaly detection
- Predictive maintenance

---
