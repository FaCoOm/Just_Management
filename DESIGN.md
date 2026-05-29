# Just Management Hospitality Design System

## Overview

Just Management is a hospitality operations dashboard for eight Vietnamese properties. UI must feel like a calm digital concierge: operationally dense, fast to scan, and refined enough for boutique-hotel management. Stack: React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, Radix UI primitives, Lucide React, Recharts, TanStack Router, Track B REST repositories, Express, Prisma, Azure PostgreSQL.

Design direction: harbor-blue operational confidence, brass hospitality warmth, clear white surfaces, compact data density, and editorial headings. Use structure, spacing, and tonal layering before decoration.

## Brand Identity

| Role | Value |
|---|---|
| Product | Just Management |
| Suite | Hospitality Operations Dashboard |
| Personality | Calm, precise, premium, data-forward |
| Primary metaphor | Digital concierge for front-office, room, booking, and maintenance work |
| Visual anchor | Harbor blue with brass accent |

Avoid generic SaaS purple gradients, decorative noise, heavy shadows, and arbitrary color flourishes. Every visual choice must improve scanning, priority, or operational confidence.

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 with `@theme inline` tokens |
| Components | shadcn/ui new-york style + Radix UI primitives |
| Icons | Lucide React |
| Charts | Recharts through shadcn chart wrappers |
| Routing | TanStack Router |
| Data | Track B REST repositories backed by Express + Prisma + Azure PostgreSQL |
| Fonts | `Newsreader` headings, `Plus Jakarta Sans` body and data |

## Typography

Use `Newsreader` for editorial display moments: page titles, hero numerals, empty-state headlines, and high-level section introductions. Use `Plus Jakarta Sans` for navigation, body copy, labels, dense tables, controls, and most dashboard data.

| Token | Font | Size | Line height | Weight | Tracking | Use |
|---|---|---:|---:|---:|---:|---|
| `display-lg` | Newsreader | 48px | 56px | 600 | -0.02em | Executive summary hero |
| `display-md` | Newsreader | 36px | 44px | 600 | -0.02em | Large KPI/portfolio headline |
| `headline-lg` | Newsreader | 28px | 36px | 600 | -0.015em | Page title on wide screens |
| `headline-md` | Newsreader | 24px | 32px | 600 | -0.01em | Section hero title |
| `title-lg` | Plus Jakarta Sans | 18px | 28px | 700 | -0.01em | Card groups, important panels |
| `title-md` | Plus Jakarta Sans | 16px | 24px | 600 | -0.005em | Page headers, dialogs |
| `body-lg` | Plus Jakarta Sans | 16px | 28px | 400 | 0 | Descriptive content |
| `body-md` | Plus Jakarta Sans | 14px | 22px | 400 | 0 | Default UI text |
| `body-sm` | Plus Jakarta Sans | 13px | 20px | 400 | 0 | Dense operational copy |
| `label-md` | Plus Jakarta Sans | 12px | 16px | 600 | 0.02em | Buttons, field labels |
| `caption` | Plus Jakarta Sans | 12px | 16px | 500 | 0 | Muted metadata |
| `data-xl` | Plus Jakarta Sans | 24px | 32px | 700 | -0.02em | KPI values |
| `data-md` | Plus Jakarta Sans | 14px | 20px | 600 | -0.01em | Counts, dates, room numbers |

Implementation tokens in `src/index.css`:

```css
--font-sans: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
--font-serif: "Newsreader", ui-serif, Georgia, serif;
```

## Color Tokens

### Brand Tokens

| Token | Light | Dark | Foreground | Use |
|---|---|---|---|---|
| `--harbor` | `#4F6FB5` | `#6b8fd4` | `--harbor-foreground` | Primary brand actions, active nav, chart lead series |
| `--harbor-foreground` | `#ffffff` | `#ffffff` | n/a | Text/icons on harbor |
| `--harbor-deep` | `#35569B` | `#4F6FB5` | white when used as fill | Secondary brand emphasis, deeper chart series |
| `--brass` | `#B89A6A` | `#d4b87a` | `--brass-foreground` | Premium warmth, occupancy/revenue highlights, VIP cues |
| `--brass-foreground` | `#ffffff` | `#1a1f36` | n/a | Text/icons on brass |

### Core Semantic Tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | `#F8F9FB` | `#111318` | App canvas |
| `--foreground` | `#1a1f36` | `#f1f3f7` | Primary text |
| `--card` | `#ffffff` | `#1a1f2e` | Card/header surfaces |
| `--card-foreground` | `#1a1f36` | `#f1f3f7` | Card text |
| `--popover` | `#ffffff` | `#1a1f2e` | Menus, dialogs, overlays |
| `--popover-foreground` | `#1a1f36` | `#f1f3f7` | Popover text |
| `--primary` | `#1a1f36` | `#f1f3f7` | Primary controls when not using harbor |
| `--primary-foreground` | `#f8f9fb` | `#111318` | Text on primary |
| `--secondary` | `#f1f3f7` | `#252a3a` | Secondary fills |
| `--secondary-foreground` | `#1a1f36` | `#f1f3f7` | Text on secondary |
| `--muted` | `#f1f3f7` | `#252a3a` | Subtle panels, chips, skeletons |
| `--muted-foreground` | `#6b7280` | `#9ca3af` | Metadata and secondary labels |
| `--accent` | `#f1f3f7` | `#252a3a` | Hover and low-emphasis selected states |
| `--accent-foreground` | `#1a1f36` | `#f1f3f7` | Text on accent |
| `--destructive` | `#ef4444` | `#ef4444` | Errors, critical alerts |
| `--destructive-foreground` | `#ffffff` | `#ffffff` | Text on destructive |
| `--border` | `#e5e7eb` | `rgba(255, 255, 255, 0.1)` | Dividers and card outlines |
| `--input` | `#e5e7eb` | `rgba(255, 255, 255, 0.15)` | Input borders/fills |
| `--ring` | `#4F6FB5` | `#6b8fd4` | Focus rings |

### Chart Tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `--chart-1` | `#4F6FB5` | `#6b8fd4` | Primary data series |
| `--chart-2` | `#35569B` | `#4F6FB5` | Secondary data series |
| `--chart-3` | `#6b7280` | `#9ca3af` | Neutral values |
| `--chart-4` | `#B89A6A` | `#d4b87a` | Revenue, occupancy, premium metrics |
| `--chart-5` | `#9ca3af` | `#6b7280` | Low-emphasis comparison data |

### Sidebar Tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `--sidebar` | `#ffffff` | `#1a1f2e` | Sidebar surface |
| `--sidebar-foreground` | `#1a1f36` | `#f1f3f7` | Sidebar text |
| `--sidebar-primary` | `#4F6FB5` | `#6b8fd4` | Active nav fill |
| `--sidebar-primary-foreground` | `#ffffff` | `#ffffff` | Active nav text |
| `--sidebar-accent` | `#f1f3f7` | `#252a3a` | Hover nav fill |
| `--sidebar-accent-foreground` | `#1a1f36` | `#f1f3f7` | Hover nav text |
| `--sidebar-border` | `#e5e7eb` | `rgba(255, 255, 255, 0.1)` | Sidebar dividers |
| `--sidebar-ring` | `#4F6FB5` | `#6b8fd4` | Sidebar focus ring |

### Contrast Notes

| Pair | Ratio | Status |
|---|---:|---|
| Harbor `#4F6FB5` + white | 4.64:1 | WCAG AA body text pass |
| Harbor Deep `#35569B` + white | 7.11:1 | WCAG AA/AAA body text pass |
| Brass `#B89A6A` + white | 2.71:1 | Large text/icons only; use dark text for body copy |
| Brass `#B89A6A` + foreground `#1a1f36` | 6.14:1 | WCAG AA body text pass |
| Dark brass `#d4b87a` + foreground `#1a1f36` | 8.81:1 | WCAG AA/AAA body text pass |

Use `--brass-foreground` exactly as coded for compatibility, but avoid small white body text on brass in new designs. Prefer brass as tint, icon, border, chart, or large-label accent.

## Spacing

Use a 4px base grid. Current pages use `p-4`, `gap-3`, and `gap-4`; preserve that density for operations views.

| Token | Value | Tailwind | Use |
|---|---:|---|---|
| `space-0` | 0 | `0` | Reset |
| `space-1` | 4px | `1` | Icon/text micro gap |
| `space-2` | 8px | `2` | Compact controls, nav items |
| `space-3` | 12px | `3` | KPI grid gaps, form stacks |
| `space-4` | 16px | `4` | Page padding, section gap |
| `space-6` | 24px | `6` | Dialog content, major card internals |
| `space-8` | 32px | `8` | Wide-screen layout breathing room |
| `space-12` | 48px | `12` | Empty states, hero panels |
| `space-16` | 64px | `16` | Marketing or executive review layouts |

Density rule: operational pages can be compact, but never reduce tap/click targets below 40px unless control is purely informational.

## Radius

Base radius is defined in code as `--radius: 0.5rem`.

| Token | Computed | Tailwind alias | Use |
|---|---:|---|---|
| `--radius-sm` | 4px | `rounded-sm` | Inline controls, tiny badges |
| `--radius-md` | 6px | `rounded-md` | Buttons, badges, icon wells |
| `--radius-lg` | 8px | `rounded-lg` | Cards, sidebar brand mark |
| `--radius-xl` | 12px | `rounded-xl` | Dialogs, elevated panels |
| `rounded-full` | 9999px | `rounded-full` | Avatars, counters, notification dots |

## Elevation

Default cards should rely on border and surface contrast, not heavy shadow. Use tinted shadows only for overlays and floating panels.

| Token | Value | Use |
|---|---|---|
| `shadow-none` | none | Standard cards, tables |
| `shadow-soft` | `0 8px 24px rgba(26, 31, 54, 0.06)` | Header menus, lightweight floating filters |
| `shadow-panel` | `0 16px 48px rgba(26, 31, 54, 0.10)` | Dialogs, command menus |
| `shadow-focus` | `0 0 0 3px rgba(79, 111, 181, 0.22)` | Focus-visible halo |

Never use pure black shadows. Tint all depth with foreground/harbor navy.

## Breakpoints And Layout

Use Tailwind defaults unless a page proves otherwise.

| Breakpoint | Width | Behavior |
|---|---:|---|
| `sm` | 640px | Reveal compact header controls |
| `md` | 768px | Two-column content grids, show header title |
| `lg` | 1024px | Four-column KPI grid |
| `xl` | 1280px | Persistent dashboard `BookingsPanel` appears at `w-[340px]` |
| `2xl` | 1536px | Add whitespace; do not add extra columns by default |

Dashboard shell pattern:

```tsx
<SidebarProvider>
  <AppSidebar />
  <SidebarInset>
    <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4" />
    <main className="flex flex-1 overflow-hidden" />
  </SidebarInset>
</SidebarProvider>
```

Keep main dashboard composition as primary scroll area plus hidden-until-`xl` `BookingsPanel`.

## Motion

Motion must communicate state, not entertain.

| Token | Duration | Use |
|---|---:|---|
| `motion-fast` | 120ms | Button hover, icon color, row hover |
| `motion-base` | 180ms | Dropdowns, sidebar submenus, focus transitions |
| `motion-slow` | 240ms | Dialog entry, page-level skeleton fade |

Easing:

| Token | Value | Use |
|---|---|---|
| `ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Default UI transitions |
| `ease-emphasized` | `cubic-bezier(0.2, 0, 0, 1.2)` | Small reveal moments only |

Animate `opacity`, `transform`, and `background-color`. Avoid animating layout, width, height, or chart geometry during data refresh unless tested for performance. Respect `prefers-reduced-motion` by removing transforms and leaving instant opacity/color changes.

## Iconography

Lucide icons are only default icon family.

| Context | Size | Class |
|---|---:|---|
| Sidebar nav | 16px | `h-4 w-4` |
| Header buttons | 16px | `h-4 w-4` |
| KPI icon well | 14px | `h-3.5 w-3.5` |
| Table row metadata | 14px | `h-3.5 w-3.5 text-muted-foreground` |
| Empty state | 24px | `h-6 w-6` |

Icons must support labels. Do not rely on icon-only meaning except standard controls with accessible labels.

## Component Patterns

### App Sidebar

Use grouped navigation: Front Office, Property, Revenue, Administration. Active item uses `--sidebar-primary` fill and `--sidebar-primary-foreground` text. Sidebar header uses a rounded harbor mark and two-line brand lockup.

### Page Header

Headers are fixed-height operational toolbars.

```tsx
<header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4">
  <SidebarTrigger className="-ml-1" />
  <Separator orientation="vertical" className="h-5" />
  <div className="flex flex-1 items-center gap-3">
    <div className="hidden md:block">
      <h2 className="text-sm font-semibold">Portfolio Dashboard</h2>
      <p className="text-xs text-muted-foreground">Vietnam time (GMT+7)</p>
    </div>
  </div>
</header>
```

### KPI Cards

Current pattern: `grid grid-cols-2 gap-3 lg:grid-cols-4`; card `gap-3 py-4`; label `text-xs font-medium text-muted-foreground`; value `text-2xl font-bold tracking-tight`; icon well `rounded-md p-1.5 bg-chart-N/10 text-chart-N`.

Use harbor for arrivals and primary activity, harbor deep for departures or comparison, brass for occupancy/revenue, neutral gray for maintenance or low-emphasis counts.

### Section Cards

Use shadcn `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`. Keep `CardTitle` at `text-sm font-semibold`; use `text-xs` descriptions for dense pages.

### Status Badges

Use badges with text, not color alone.

| Status | Treatment |
|---|---|
| Confirmed / active | Emerald tint, explicit label |
| Pending / attention | Brass tint, explicit label |
| Check-out / complete | Muted fill, muted foreground |
| Error / critical | Destructive tint, destructive foreground |
| VIP / premium | Brass tint plus star/sparkle only when useful |

### Data Tables

Tables are compact: `text-xs` secondary columns, `py-2.5` rows, right-align numeric values, left-align names and room labels. Use hover surface shifts, not heavy row borders. Keep status and action cells visually distinct.

### Forms

Use `label-md` for labels, `body-md` for inputs, `text-xs text-muted-foreground` for helper text. Error text uses `--destructive`; focus ring uses `--ring`. Required fields need visible text or symbol plus accessible description.

### Dialogs And Popovers

Dialogs use `rounded-xl`, `shadow-panel`, `bg-popover`, and clear title/body/action hierarchy. Popovers and dropdowns can use `shadow-soft`. Avoid full-screen modals on desktop for simple edits.

### Empty States

Use one clear heading, one operational explanation, and one primary action if there is a next step. Empty state icons should be muted or harbor-tinted, never decorative-only.

### Loading States

Use shadcn `Skeleton` with current layout dimensions. Dashboard loading mirrors final structure: KPI skeleton grid, chart skeleton, then paired panel skeletons. Prefer skeletons over spinners except inline actions like `Sync Now`.

### Charts

Charts use `--chart-*` tokens only. Avoid un-tokened palette additions. Add labels/tooltips that explain operational meaning, not only numeric values. Use brass sparingly to highlight revenue, occupancy, or premium deltas.

## Dark Mode

Dark mode is toggled by `.dark` on document root. `ThemeProvider` persists preference with `localStorage` key `vite-ui-theme`. Every new surface, chart, and status treatment must use tokens so dark parity comes free.

Do not hardcode light-only backgrounds in feature components. Use token classes such as `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-harbor`, and `text-harbor-foreground`.

## Accessibility

- Minimum interactive target: 40x40px for toolbar and form controls.
- Focus-visible state: `--ring` plus sufficient outline/halo.
- Body text contrast must meet WCAG AA, 4.5:1 minimum.
- Do not use brass with white for small body text.
- Icons need text labels or accessible names.
- Status must include text, not color alone.
- Motion must respect `prefers-reduced-motion`.
- Dense tables must preserve keyboard order and visible hover/focus states.

## Voice And Microcopy

Use operational clarity over marketing flourish. Prefer concrete labels: `Sync Now`, `Arrivals Today`, `Maintenance Open`, `Vietnam time (GMT+7)`. State what changed and what user can do next. Avoid ambiguous labels like `Manage`, `View`, or `Details` unless surrounding context is explicit.

## Stitch Mapping

Primary Stitch design system should use:

| Stitch field | Value |
|---|---|
| `displayName` | `Just Management Hospitality System` |
| `projectId` | `16682351323839497135` |
| `colorMode` | `LIGHT` |
| `colorVariant` | `FIDELITY` |
| `customColor` | `#4F6FB5` |
| `overridePrimaryColor` | `#4F6FB5` |
| `overrideSecondaryColor` | `#35569B` |
| `overrideTertiaryColor` | `#B89A6A` |
| `overrideNeutralColor` | `#F8F9FB` |
| `headlineFont` | `NEWSREADER` |
| `bodyFont` | `PLUS_JAKARTA_SANS` |
| `labelFont` | `PLUS_JAKARTA_SANS` |
| `roundness` | `ROUND_EIGHT` |

## Verification Checklist

- [x] CSS variables from `src/index.css` light and dark modes are listed.
- [x] Brand triad `harbor`, `harbor-deep`, `brass` includes foreground guidance and contrast notes.
- [x] Spacing scale includes 4, 8, 12, 16, 24, 32, 48, and 64px.
- [x] Radius scale derives from `--radius: 0.5rem`.
- [x] Typography scale covers display, headline, title, body, label, caption, and data roles.
- [x] Component patterns cover KPI cards, status badges, data tables, sidebar, page header, dialogs, forms, empty states, loading skeletons, and charts.
- [x] Motion durations, easing, and reduced-motion rule are documented.
- [x] Accessibility rules cover focus, contrast, target size, status labels, icon labels, and reduced motion.
- [x] Iconography uses Lucide sizing conventions from existing components.
- [x] Brand identity is Just Management, not Latte Lounge placeholder branding.
