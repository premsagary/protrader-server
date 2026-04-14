---
name: Design System State
description: Current token inventory, dark mode palette problems, gaps needing new tokens
type: project
---

## Current Token Inventory (index.css :root + .dark)

### Light mode surfaces
- --bg: #F7F8FA (good — slightly warm off-white)
- --bg2: #FFFFFF (card surface)
- --bg3: #F0F1F3 (elevated/table header)
- --bg4: #E5E7EB (border-weight surface)

### Dark mode surfaces — PROBLEM
- --bg: #0B0F19 (near-black, cold blue-black — GitHub/terminal aesthetic)
- --bg2: #161b22 (GitHub dark exactly)
- --bg3: #21262d (GitHub dark exactly)
- --bg4: #30363d (GitHub dark exactly)
These are the GitHub dark theme verbatim. Not warm, not Apple-like.

### Typography
- Base font-size: 13px (too small — Apple baseline is 15-17px)
- No heading size tokens (h1/h2/h3 undefined)
- Line-height: 1.5 (good for body, too tight for headings)
- Font stack: SF Pro Text, Inter, -apple-system (good)

### Radius tokens
- --radius: 6px (too small — Apple uses 10-12px for cards)
- --radius-lg: 8px
- --radius-xl: 12px
- --radius-2xl: 16px
All need to be bumped up by ~4-6px for Apple feel.

### Shadow tokens
Light mode shadows are barely perceptible (opacity 0.04-0.08). Apple uses layered shadows with more presence.
Dark mode shadows have opacity 0.3-0.5 — better but still flat-feeling.

## Missing Tokens
- No --radius-card token (currently --radius-lg used for cards)
- No --font-size-heading, --font-size-subheading, --font-size-label tokens
- No --transition-speed token (hardcoded 0.15s everywhere)
- No hover state tokens (--bg-hover, --border-hover)
- No --accent-hover token for button states
- No glass/frosted surface token for nav

## Key Design System Issues
1. Dark palette is GitHub dark — needs Apple dark (warm charcoal, not cold blue-black)
2. Font size 13px base too small — needs 14-15px
3. Radii too small for Apple feel — cards should be 12-14px
4. Shadow system needs more presence in light mode
5. Accent blue (#2563EB) is Tailwind blue-600 — slightly too developer-ish. Apple uses #0071E3 or #007AFF
