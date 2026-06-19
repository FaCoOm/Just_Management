# Latte Lounge — Hospitality Suite Design System

## Overview

The Latte Lounge Hospitality Suite uses **shadcn/ui** (new-york style) on top of **Tailwind CSS v4**, with a custom hotel-brand token layer. The design language is refined, professional, and data-dense — think boutique hotel management software with clear hierarchy and understated elegance.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript + Vite |
| CSS | Tailwind CSS v4 with `@theme inline` |
| Component Library | shadcn/ui — new-york style, Radix UI primitives |
| Icons | Lucide React |
| Charts | Recharts via shadcn/ui Chart wrapper |
| Data | Supabase (PostgreSQL) |
| Fonts | Plus Jakarta Sans (sans), Newsreader (serif) |

---

## Typography

- **Font sans:** `Plus Jakarta Sans` — used for all UI, data labels, and body text
- **Font serif:** `Newsreader` — decorative headings only (rarely used)
- Tailwind classes per level:

| Level | Classes |
|-------|---------|
| Page title | `text-base font-semibold tracking-tight` |
| Section title | `text-sm font-semibold` |
| Card title | `text-xs font-medium text-muted-foreground` |
| Body | `text-sm` |
| Caption / muted | `text-xs text-muted-foreground` |
| Large data value | `text-2xl font-bold tracking-tight` |

---

## Color Tokens

### Brand Palette

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--harbor` | `#4F6FB5` | `#6b8fd4` | Primary brand blue — active states, icons, highlights |
| `--harbor-foreground` | `#ffffff` | `#ffffff` | Text on harbor backgrounds |
| `--harbor-deep` | `#35569B` | `#4F6FB5` | Deeper blue — secondary accents |
| `--brass` | `#B89A6A` | `#d4b87a` | Warm gold — VIP, premium, occupancy |
| `--brass-foreground` | `#ffffff` | `#1a1f36` | Text on brass backgrounds |

### Semantic Tokens

| Token | Purpose |
|-------|---------|
| `--background` | Page/app background (`#F8F9FB` light, `#111318` dark) |
| `--foreground` | Primary text (`#1a1f36` light, `#f1f3f7` dark) |
| `--card` | Card surface (`#ffffff` light, `#1a1f2e` dark) |
| `--card-foreground` | Text on cards |
| `--muted` | Subtle fills for chips, rows, backgrounds |
| `--muted-foreground` | Secondary/subdued text (`#6b7280` light, `#9ca3af` dark) |
| `--border` | Dividers and card borders |
| `--destructive` | Errors, critical status (`#ef4444`) |
| `--ring` | Focus ring (`#4F6FB5` light) |

### Chart Colors

| Token | Light | Dark | Meaning |
|-------|-------|------|---------|
| `--chart-1` | `#4F6FB5` | `#6b8fd4` | Harbor blue — primary data series |
| `--chart-2` | `#35569B` | `#4F6FB5` | Deep blue — secondary series |
| `--chart-3` | `#6b7280` | `#9ca3af` | Gray — neutral/tertiary |
| `--chart-4` | `#B89A6A` | `#d4b87a` | Brass gold — occupancy/revenue |
| `--chart-5` | `#9ca3af` | `#6b7280` | Light gray — low-emphasis |

### Sidebar Tokens

Sidebar uses its own token set: `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-primary-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border`, `--sidebar-ring`.

Active sidebar item uses `--sidebar-primary` (#4F6FB5) background with white text.

---

## Spacing & Layout

- **Border radius:** `--radius: 0.5rem` (8px base); `rounded-lg` for cards, `rounded-md` for badges
- **Page padding:** `p-4` (16px) inside `SidebarInset`
- **Card gaps:** `gap-3` for KPI grid, `gap-4` for content sections
- **Grid:** `grid-cols-2 lg:grid-cols-4` for KPIs; `md:grid-cols-2` for content pairs

---

## Layout Structure

```
SidebarProvider
├── AppSidebar (fixed left, collapsible)
│   ├── SidebarHeader (logo + brand)
│   ├── SidebarContent (grouped nav)
│   └── SidebarFooter (user profile)
└── SidebarInset
    └── [Page Component]
        ├── [PageName]Header (h-14, border-b, bg-card)
        └── main content (overflow-y-auto, p-4)
```

Each page follows this shell exactly. The header (`h-14 flex items-center gap-3 border-b border-border bg-card px-4`) is consistent across all pages and contains: `SidebarTrigger`, `Separator`, page title/subtitle, and action controls.

---

## Component Patterns

### KPI Cards
- `Card` with `gap-3 py-4`
- `CardHeader`: icon badge (rounded-md, colored bg) + label (`text-xs text-muted-foreground`)
- `CardContent`: large value (`text-2xl font-bold`) + delta badge with trend icon
- Icon badge color classes follow `bg-chart-N/10 text-chart-N` pattern

### Status Badges
Use shadcn `Badge` with `variant="outline"` or `variant="secondary"`. Color via className:
- **Checked In / Active:** `bg-emerald-50 text-emerald-700 border-emerald-200` (light)
- **Pending:** `bg-chart-4/10 text-chart-4` (brass/amber)
- **Check-Out:** `bg-muted text-muted-foreground`
- **Critical:** `bg-destructive/10 text-destructive`

### Data Tables
Compact `Table` with `text-xs` rows, `text-muted-foreground` secondary columns, `py-2.5` row padding. Use `Badge` for status cells.

### Page Headers
```tsx
<header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4">
  <SidebarTrigger className="-ml-1" />
  <Separator orientation="vertical" className="h-5" />
  <div className="flex flex-1 items-center gap-3">
    <div>
      <h2 className="text-sm font-semibold">[Page Title]</h2>
      <p className="text-xs text-muted-foreground">[Subtitle]</p>
    </div>
  </div>
  {/* Right-side actions */}
</header>
```

### Section Cards
```tsx
<Card>
  <CardHeader className="pb-3">
    <CardTitle className="text-sm font-semibold">[Title]</CardTitle>
    <CardDescription className="text-xs">[Description]</CardDescription>
  </CardHeader>
  <CardContent>...</CardContent>
</Card>
```

---

## Navigation (Sidebar)

Groups:
1. **Front Office** — Dashboard, Reservations, Check-in/Check-out, Guest Profiles
2. **Property** — Rooms & Suites (collapsible: Floor Plan, Room Types, Availability), Housekeeping, Dining & Events
3. **Revenue** — Rate Manager, Billing & Invoices, Channel Distribution
4. **Administration** — Staff & Roles, Maintenance Logs, Security & Access

Active item: `isActive={true}` on `SidebarMenuButton` — renders with `--sidebar-primary` fill.

---

## Dark Mode

Toggled via `.dark` class on `<html>`. The `ThemeProvider` from `@/components/theme-provider` handles persistence via `localStorage` key `"vite-ui-theme"`. A `ModeToggle` button lives in the header area.

---

## Iconography

Lucide React icons throughout. Sizing conventions:
- Sidebar nav: `h-4 w-4` (default, passed as JSX component to `SidebarMenuButton`)
- Header actions: `h-4 w-4` inside `Button size="icon" className="h-8 w-8"`
- KPI card icons: `h-3.5 w-3.5` inside `rounded-md p-1.5` badge
- Table row icons: `h-3.5 w-3.5 text-muted-foreground`

---

## Brand Identity

- **Brand name:** Latte Lounge
- **Suite name:** Hospitality Suite
- **Brand icon:** `Coffee` (Lucide) in `bg-harbor text-harbor-foreground` rounded square
- **User:** Robert Austin (`RA` avatar fallback), `robert@lattelounge.co`
- **Tone:** Professional, clean, data-forward. No decorative flourishes.
