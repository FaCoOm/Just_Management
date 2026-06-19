> **Historical. Not current runtime truth.** This roadmap reflects a Supabase-centric future that was retired. The current system uses REST repositories + Express + Prisma + Azure PostgreSQL.


---

# Next Steps for Latte Lounge Dashboard

## Phase 1: Data Integration (Recommended)

### 1.1 Connect Supabase (Priority: HIGH)
**Status:** Database schema exists in Supabase; credentials lost during project reset

**Tasks:**
1. **Recover/Add Supabase Credentials**
   - Visit your Supabase project dashboard
   - Copy `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   - Add to `.env` file in project root:
     ```
     VITE_SUPABASE_URL=https://your-project.supabase.co
     VITE_SUPABASE_ANON_KEY=your-anon-key
     ```
   - Restart dev server: `npm run dev`

2. **Update Data Hooks**
   - Modify `src/hooks/use-dashboard-data.ts` to fetch from Supabase instead of static data
   - Replace static imports with `supabase.from('table').select()` calls
   - Add loading/error states (optional: use `useFetch` or React Query)

3. **Remove Static Data (Optional)**
   - Once Supabase is connected and verified, remove `src/data/` directory
   - Update imports in dashboard components

**Expected Benefit:** Live data synced across all properties; enables real-time updates

---

## Phase 2: Interactive Features (Recommended)

### 2.1 Add Property Filter
**Status:** Dropdown exists in header; not connected

**Tasks:**
1. Extract selected property from "All Properties" dropdown
2. Add state management (useState or context)
3. Filter all metrics/tables by selected property
4. Update KPI cards, charts, and detail modules to show filtered data

**Expected Benefit:** Users can focus on individual properties

### 2.2 Add Date Range Picker
**Status:** Date displayed in header; not selectable

**Tasks:**
1. Install `@radix-ui/react-popover` + `react-day-picker` (if not already present)
2. Replace header date text with interactive `Popover` + `Calendar` component
3. Store date range in state
4. Filter guests/arrivals/departures by selected date range
5. Update Occupancy Trend chart to show selected date range

**Expected Benefit:** Users can analyze historical or future periods

### 2.3 Add Guest Search
**Status:** Search field in bookings panel; input connected but not functional

**Tasks:**
1. Connect search input to state
2. Filter guest lists in bookings panel by name/property/booking source
3. Optional: Add search to main Recent Arrivals table

**Expected Benefit:** Faster guest lookup and check-in workflow

---

## Phase 3: Real-time & Notifications (Optional)

### 3.1 Supabase Real-time Subscriptions
**Status:** Not implemented

**Tasks:**
1. Enable Supabase real-time for `guests` and `maintenance_issues` tables
2. Set up `supabase.channel().on('postgres_changes')` listeners
3. Refetch or update state when data changes
4. Add toast notifications for new arrivals/departures (using `sonner`)

**Expected Benefit:** Dashboard auto-updates when staff check in guests or log maintenance

### 3.2 Notifications Toast
**Status:** `sonner` component installed but not used

**Tasks:**
1. Trigger toasts on:
   - New guest arrival
   - Guest check-out
   - Maintenance issue resolved
   - High-severity maintenance reported
2. Use `sonner.toast()` API

**Expected Benefit:** Staff aware of urgent events in real-time

---

## Phase 4: Guest & Maintenance Management (Optional)

### 4.1 Add Check-In/Check-Out Buttons
**Status:** Display only

**Tasks:**
1. Add action buttons to arrivals/departures detail modules
2. On click:
   - Call Supabase: `update guests set check_in_status = 'Checked In' where id = ?`
   - Refetch dashboard data
   - Show toast notification
3. Optional: Add confirmation dialog

**Expected Benefit:** Staff can manage check-ins/outs directly from dashboard

### 4.2 Add Maintenance Management
**Status:** Display only

**Tasks:**
1. Add action buttons to maintenance detail module (Mark In Progress, Mark Resolved)
2. Update `maintenance_issues` table via Supabase
3. Show issue history (optional)
4. Add filter by severity/status

**Expected Benefit:** Maintenance team can track work from dashboard

### 4.3 Add Guest Request Tracking (Future)
**Status:** Not implemented

**Tasks:**
1. Display guest requests (extra towels, room service, etc.) in a new panel
2. Allow staff to mark requests as completed
3. Filter by property/date

---

## Phase 5: Advanced Features (Future)

### 5.1 Occupancy Forecasting
**Status:** Not implemented

**Tasks:**
1. Add predicted occupancy based on upcoming bookings
2. Show predicted revenue
3. Highlight understaffed periods

### 5.2 Revenue Analytics
**Status:** Revenue by channel displayed; no drill-down

**Tasks:**
1. Show revenue trends over time
2. Add revenue per property detail
3. Compare against targets/previous period

### 5.3 Staff Workload Management
**Status:** Not implemented

**Tasks:**
1. Add staff roster view
2. Allocate staff to properties
3. Track workload (guests per staff member)

### 5.4 Mobile App (Native)
**Status:** Not started

**Tasks:**
1. Consider React Native app for iOS/Android
2. Sync with Supabase backend
3. Offline-first capabilities

---

## Phase 6: Security & Admin (Required before production)

### 6.1 Authentication
**Status:** Not implemented

**Tasks:**
1. Add Supabase Auth (email/password or OAuth)
2. Protect all routes with auth guards
3. Role-based access control (Admin, Manager, Staff)
4. Log user actions for audit trail

### 6.2 Row Level Security (RLS)
**Status:** Partially enabled; no policies set

**Tasks:**
1. Create RLS policies for each table:
   - Property managers can only see their properties
   - Staff can only see assigned properties
   - Admin sees all
2. Test policies thoroughly

### 6.3 Audit Logging
**Status:** Not implemented

**Tasks:**
1. Create `audit_logs` table
2. Log all state changes (check-ins, maintenance updates, etc.)
3. Display audit trail in admin panel

---

## Quick Start Checklist

- [ ] Add Supabase credentials to `.env`
- [ ] Test dashboard with live data (run `npm run dev`)
- [ ] Connect property filter dropdown
- [ ] Add date range picker to header
- [ ] Implement guest search in bookings panel
- [ ] Add check-in/check-out buttons
- [ ] Set up real-time subscriptions (optional)
- [ ] Add toast notifications (optional)
- [ ] Implement authentication (required for production)
- [ ] Set up RLS policies (required for production)
- [ ] Deploy to production (Vercel, Netlify, or custom server)

---

## Recommended Implementation Order

1. **Week 1:** Supabase connection + property filter + date range
2. **Week 2:** Guest check-in/check-out + real-time subscriptions
3. **Week 3:** Notifications + maintenance management
4. **Week 4:** Authentication + RLS policies
5. **Week 5:** Testing + deployment
6. **Week 6+:** Analytics, forecasting, mobile app

---

## Technology Notes

- **Supabase:** Already set up with schema; needs credentials in `.env`
- **TypeScript:** Strict mode enabled; full type coverage
- **React 19:** Latest features; hooks only (no class components)
- **Tailwind CSS v4:** OKLCH colors; custom tokens in `src/index.css`
- **shadcn/ui:** 20 components pre-installed; add more with `npx shadcn@latest add [name]`

---

## Support

- **Supabase Docs:** https://supabase.com/docs
- **shadcn/ui Docs:** https://ui.shadcn.com
- **Tailwind CSS v4:** https://tailwindcss.com/docs
- **React:** https://react.dev

---
