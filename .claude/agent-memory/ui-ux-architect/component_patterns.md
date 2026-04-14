---
name: Component Patterns and Inconsistencies
description: Styling patterns found across components, inconsistencies, anti-patterns
type: project
---

## Styling Approach
- All components use inline styles (style={{}}) for semantic values referenced to CSS variables
- Tailwind utility classes used only for layout (flex, grid, gap, hidden, overflow)
- This is a deliberate pattern — design changes happen in index.css tokens + inline style values
- NO Tailwind color classes used for semantic colors (correct pattern)

## Inconsistencies Found

### TopBar
- Mode tabs are inside TopBar (not separate ModeTabs component) — ModeTabs.jsx exists but is unused standalone
- Logout button has `var(--red)` text color — alarming for a non-destructive-seeming action
- Stats section (Total P&L, Win Rate, Day P&L) uses `hidden md:block` — good responsive handling
- TopBar height: 44px — Apple nav bars are typically 52-56px
- Mode tab font: 12px — too small, should be 13-14px

### Mode Tabs (inline in TopBar)
- Active tab: white background on bg3, colored text from m.color
- m.color maps to CSS variable references — different color per mode (green, amber, blue, purple, teal, text3)
- Active indicator: box shadow only, no visible selection pill or underline — weak visual signal
- Gap between tabs: gap-px (1px) — too tight

### SubTabs
- Border-bottom 2px active indicator — this is good Apple-like pattern
- Height: 38px — should be 40-44px
- Font: 12px — should be 13px
- No hover state defined (only in CSS, not inline)

### StatCard
- Padding: 12px 14px — too tight for Apple feel (should be 16px 18px)
- Value font-size: 18px hardcoded — not a token
- Label: 10px (2xs) uppercase — ok but text2 color conflicts with text3 elsewhere
- No hover state for clickable cards

### DataTable
- Header: 11px uppercase — ok
- Row: 12px — correct for dense data
- Zebra striping: bg3 on odd rows — subtle, works
- Sticky headers using bg3 — correct
- Empty state uses `--` as icon with 32px size — not polished
- No column group headers supported (MFPage implements its own table)

### FilterPills
- Active: accent background (#2563EB) with white text — correct
- Inactive: transparent with border2 — correct
- Gap: 1.5 (6px) — a bit tight
- margin-bottom: 3 (12px) is baked in className — rigid

### Pill (badge)
- borderRadius: 4px — should be 6px for Apple feel (full rounded looks better)
- padding: 2px 8px — ok

### ConvictionPill
- textTransform: uppercase — correct for badges
- borderRadius: 4px — same issue, too sharp

### HorizonPill  
- borderRadius: 3px — too sharp, inconsistent with other pills
- padding: 1px 6px — minimal

### NewsCard
- borderLeft: 3px solid sentiment color — effective visual indicator
- Good component, well structured

### EmptyState
- Uses `--` as an "icon" — needs a proper SVG icon or refined treatment
- No illustration or meaningful visual cue

### LoadingSkeleton
- Shimmer animation exists — good
- card variant padding/sizing reasonable

### MFPage FundCard
- 100+ lines of inline styles with HARDCODED colors (rgba(124,58,237,.12), #bc8cff, rgba(99,102,241,0.1), #818cf8)
- DNI banner uses hardcoded colors not referencing tokens
- MiroFish projection card has hardcoded purple rgba values
- These WILL NOT respect dark/light mode properly

### RiskBanner
- Uses `x` as close button text — should be an SVG X icon
- Functional and token-correct otherwise

## Hardcoded Colors Found (bypassing token system)
- MFPage: rgba(124,58,237,.12), #bc8cff, rgba(99,102,241,0.1), #818cf8, rgba(124,58,237,.3)
- AdminPage pipeline items: hardcoded hex colors (#3b82f6, #f59e0b, #10b981, #8b5cf6)
- StockRecPage column header colors: hardcoded hex (#f59e0b, #e67e22, #8b5cf6, #10b981)
- MF category bg values in constants.js: #ede9fe, #dbeafe, #ccfbf1 — not tokens

## What Works Well
- CSS variable approach for all semantic colors — correct architecture
- Tabular numbers on numeric data — correct
- Transition: all 0.15s on interactive elements — consistent
- Keyboard shortcuts (1-6 for mode switching) — good UX
- -webkit-font-smoothing on html — correct
- Dark mode via .dark class on html — correct
- Scrollbar styling — refined detail
