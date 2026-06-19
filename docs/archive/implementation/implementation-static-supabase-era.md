> **Historical. Not current runtime truth.** This document describes a retired architecture (static data with optional Supabase). The current system uses REST repositories + Express + Prisma + Azure PostgreSQL.


---

# Latte Lounge Executive Multi-Property Portfolio Dashboard
## Implementation Summary

### Overview
A comprehensive hospitality management dashboard for 8 Vietnamese property branches built with React, TypeScript, Vite, shadcn/ui, and Supabase.

**Tech Stack:**
- Frontend: React 19 + TypeScript + Vite
- UI: shadcn/ui (new-york style) with Tailwind CSS v4
- Icons: Lucide React
- Charts: Recharts v3
- Database: Supabase (optional; currently uses static data)
- State: React hooks + static data layer

---

## Architecture

### Project Structure
```
src/
├── components/
│   ├── app-sidebar.tsx          # Main sidebar with grouped navigation
│   ├── theme-provider.tsx        # Dark mode theme context
│   ├── ui/                       # 20 shadcn/ui components (pre-installed)
│   └── dashboard/
│       ├── dashboard-page.tsx    # Main dashboard container
│       ├── header.tsx            # Top header with greeting, search, date range
│       ├── kpi-summary.tsx       # 4 KPI cards (arrivals, departures, occupancy, maintenance)
│       ├── occupancy-chart.tsx   # 14-day stacked bar chart
│       ├── revenue-overview.tsx  # Revenue by booking channel horizontal chart
│       ├── recent-arrivals.tsx   # Recent arrivals table (6 rows)
│       ├── bookings-panel.tsx    # Right sidebar with guest search & tabbed lists
│       ├── branch-comparison.tsx # Portfolio comparison table (all 8 properties)
│       ├── arrivals-detail.tsx   # Today's arrivals detail module
│       ├── departures-detail.tsx # Today's departures detail module
│       ├── occupancy-detail.tsx  # Occupancy by property breakdown
│       └── maintenance-detail.tsx# Open maintenance issues queue
├── hooks/
│   └── use-dashboard-data.ts     # Custom hook for fetching/computing metrics
├── lib/
│   ├── supabase.ts               # Supabase client initialization
│   └── utils.ts                  # Tailwind classname merge utility
├── data/
│   ├── properties.ts             # 8 properties seed data
│   ├── guests.ts                 # 20 guests seed data
│   ├── maintenance.ts            # 12 maintenance issues seed data
│   └── metrics.ts                # Computed metrics & aggregations
├── types/
│   └── database.ts               # TypeScript interfaces for all data models
├── App.tsx                       # Root component with SidebarProvider
├── main.tsx                      # React entry point
└── index.css                     # Harbor & Hearth theme with custom tokens
```

### Data Models
- **Property**: id, name, slug, total_rooms, location, status
- **Room**: id, property_id, room_number, room_name, room_type, status, passcode, floor
- **Guest**: id, property_id, room_id, guest_name, eta, etd, check_in_status, booking_source, is_vip, guest_count
- **MaintenanceIssue**: id, property_id, room_id, title, description, severity, status
- **PropertyMetrics**: Computed metrics aggregating property performance (occupancy %, arrivals, departures, maintenance open)

---

## Design System: Harbor & Hearth Palette

### Colors
- **Harbor Indigo**: `#4F6FB5` (primary actions, charts, badges)
- **Deep Harbor**: `#35569B` (darker accent, secondary charts)
- **Soft Brass**: `#B89A6A` (VIP badges, maintenance alerts)
- **Zinc Linen**: `#F8F9FB` (background)

### Fonts
- **Headlines**: Newsreader (serif) - "elegant, readable typography"
- **Body/UI**: Plus Jakarta Sans (sans-serif) - "clean operational UI"

### CSS Variables (src/index.css)
```css
--harbor: #4F6FB5
--harbor-foreground: #ffffff
--harbor-deep: #35569B
--brass: #B89A6A
--brass-foreground: #ffffff
--background: #F8F9FB
--chart-1: #4F6FB5 (Harbor Indigo)
--chart-2: #35569B (Deep Harbor)
--chart-3: #6b7280 (Neutral gray)
--chart-4: #B89A6A (Soft Brass)
```

---

## Key Features

### 1. Sidebar Navigation (3 columns layout)
- **Left**: AppSidebar with sections:
  - Overview (Dashboard)
  - Front Office (Arrivals, Departures, Occupancy, Guests)
  - Property (All Properties, Maintenance)
  - Revenue (Analytics)
  - Admin (Settings, Help & Support)
- Collapsible on mobile via SidebarProvider
- SidebarInset wraps main content

### 2. Header Bar
- Greeting ("Good morning")
- Guest/room search field
- "All Properties" dropdown selector
- Notification bell icon
- Date range displays "Thursday, April 9, 2026"

### 3. KPI Summary Cards (4 cards in 2x2 grid on mobile, 1x4 on desktop)
- Arrivals Today: 13 guests
- Departures Today: 4 guests
- Occupancy Rate: 14% (portfolio-wide average)
- Maintenance Open: 12 issues
- Color-coded icons (Harbor, Deep Harbor, Brass, Neutral)

### 4. Occupancy Trend Chart
- 14-day stacked bar chart (occupied vs. available rooms)
- X-axis: day labels (27 Fri, 28 Sat, 29 Sun, etc.)
- Y-axis: room counts
- Legend: "Available" (light bar) and "Occupied" (Harbor blue bar)
- Interactive Recharts with tooltips

### 5. Revenue Overview Chart
- Horizontal bar chart by booking channel
- Channels: Booking.com ($12.4k), Direct ($8.6k), Agoda ($6.8k), Airbnb ($5.4k)
- Color-coded by chart tokens (--chart-1 through --chart-4)

### 6. Recent Arrivals Table
- 6 most recent checked-in guests
- Columns: Guest (with avatar), Property, Booking Source, Status (Checked In / Pending)
- VIP badge for premium guests
- Avatar initials background colored with Harbor/10 opacity

### 7. Bookings Panel (Right sidebar)
- Guest search field
- Tabbed interface:
  - Arriving (13): upcoming arrivals
  - In-House (13): currently checked in
  - Departing (4): scheduled departures
- Guest list with:
  - 2-letter avatar initialsbar
  - Guest name
  - Property name
  - Guest count
  - VIP star indicator (★)
  - Check-in status badge

### 8. Property Comparison Table
- All 8 properties sorted by occupancy rate (descending)
- Columns: Property, Arrivals, Departures, Occupancy (progress bar), Maintenance
- Progress bars use Harbor Indigo theme
- Maintenance badges: "Clear" (green), numeric open issues (amber/red based on count)
- Responsive with overflow scroll on mobile

### 9. Detail Modules (Bottom 4 sections)
- **Today's Arrivals**: Guest list with VIP badges, check-in status
- **Today's Departures**: Guest list with property, booking source, departing badge
- **Occupancy by Property**: All 8 properties with occupancy percentages + progress bars
- **Open Maintenance**: Issues grouped by property, sorted by severity (Critical/High/Medium/Low)
  - Icons: AlertTriangle (Open), Clock (In Progress), CheckCircle (Resolved)
  - Severity badges with custom colors

### 10. Responsive Layout
- **Desktop (1400px)**: 3-column layout (sidebar | main dashboard | bookings panel)
- **Tablet (768-1023px)**: Collapsible sidebar, bookings panel may stack
- **Mobile (<768px)**: Sheet drawer for sidebar, bookings panel below main content

---

## Data Flow

### Static Data Approach (Current)
1. `src/data/properties.ts` → 8 properties
2. `src/data/guests.ts` → 20 guests (check-in status, ETA/ETD, VIP flags)
3. `src/data/maintenance.ts` → 12 maintenance issues
4. `src/data/metrics.ts` → Computed metrics:
   - Occupancy rate per property
   - Arrivals/departures today
   - Open maintenance count
   - Revenue aggregation by channel
   - 14-day occupancy trend

### Supabase Integration (Optional)
- `src/lib/supabase.ts` initializes client from env vars
- Currently falls back to static data if `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` missing
- Database tables exist in Supabase (8 properties, 94 rooms, 64 guests, 32 requests, 23 maintenance issues)

---

## Component Tree

```
App (SidebarProvider)
├── AppSidebar
└── SidebarInset
    └── DashboardPage
        ├── Header
        ├── KpiSummary (4 cards)
        ├── OccupancyChart (Recharts)
        ├── RevenueOverview (Recharts)
        ├── RecentArrivals (Table)
        ├── BranchComparison (Table with Progress bars)
        ├── ArrivalsDetail
        ├── DeparturesDetail
        ├── OccupancyDetail
        └── MaintenanceDetail
└── BookingsPanel (right sidebar, overlays)
```

---

## Build & Deploy

### Build Command
```bash
npm run build
```
- Runs TypeScript check + Vite build
- Output: `dist/` folder
- No errors; chunk size warning is informational

### Environment Variables (.env)
```
VITE_SUPABASE_URL=<your-url>
VITE_SUPABASE_ANON_KEY=<your-key>
```
- Optional; app works without them (uses static data)

---

## Styling & Theming

### Tailwind CSS v4
- Custom CSS variables in `src/index.css` under `:root` and `.dark` selectors
- `@theme inline` directive maps CSS vars to Tailwind utilities
- All colors use `--harbor`, `--harbor-deep`, `--brass` tokens
- Font stack: Plus Jakarta Sans (body), Newsreader (serif headings)

### Component Styling
- shadcn/ui components use design system tokens
- Progress bars: `className="bg-harbor/20 [&>[data-slot=progress-indicator]]:bg-harbor"`
- Badge colors: custom `className` for severity/status
- Card gaps/padding: `gap-3 py-4` for consistency

---

## Testing & Verification

### Visual Verification
- Dashboard loads with all 4 KPI cards
- Charts render without errors (Recharts)
- Tables display all rows
- Sidebar collapses/expands on mobile
- Dark mode toggle works (Cmd/Ctrl+D)
- Colors match Harbor & Hearth palette

### Browser Support
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile: iOS Safari, Android Chrome

---

## Files Created/Modified in This Session

### Created:
- `src/types/database.ts` - TypeScript interfaces
- `src/lib/supabase.ts` - Supabase client
- `src/data/properties.ts` - 8 properties seed
- `src/data/guests.ts` - 20 guests seed
- `src/data/maintenance.ts` - 12 maintenance issues
- `src/data/metrics.ts` - Computed metrics
- `src/components/dashboard/kpi-summary.tsx`
- `src/components/dashboard/recent-arrivals.tsx`
- `src/components/dashboard/branch-comparison.tsx`
- `src/components/dashboard/maintenance-detail.tsx`
- (Plus 9 other dashboard components already created)

### Modified:
- `src/App.tsx` - Updated to use SidebarProvider + DashboardPage
- `index.html` - Added Google Fonts (Plus Jakarta Sans, Newsreader)
- `src/index.css` - Harbor & Hearth theme tokens + @theme inline

### Pre-installed (via shadcn CLI):
- 20 shadcn/ui components in `src/components/ui/`

---

## Build Status
✅ **Compiles without errors**
✅ **All TypeScript types pass**
✅ **Visual verification complete**
✅ **Responsive layout tested**

---
