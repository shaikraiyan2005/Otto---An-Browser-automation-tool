# 05 — Frontend

Two frontends share one design system:

1. **Web dashboard** (`apps/web`, Next.js) — profile, recipes, runs, settings, playground.
2. **Side panel** (`apps/extension`, React) — where the user actually works on a page.

## 1. Design system

Minimal, neutral, black and white. Content first; no decoration.

### Tokens (`globals.css`, shared by both apps)

```css
:root {
  --bg: #fafafa;  --surface: #ffffff;  --surface-2: #f5f5f5;
  --text: #0a0a0a; --muted: #737373;   --line: #e5e5e5;
  --primary: #0a0a0a; --primary-fg: #fafafa;
  --ok: #16a34a; --warn: #ca8a04; --bad: #dc2626;   /* status dots/text only */
  --radius: 10px;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #0a0a0a;  --surface: #111111; --surface-2: #171717;
  --text: #fafafa; --muted: #a3a3a3;  --line: #262626;
  --primary: #fafafa; --primary-fg: #0a0a0a;
}}
:root[data-theme="dark"] { /* same as above */ }
```

### Rules

- Type: Geist Sans 14 px base, Geist Mono for values, refs, JSON and timings.
- Headings: 600 weight, tight letter-spacing (−0.02em). Only two sizes: 20 px page title, 14 px section title.
- Buttons: primary = solid `--primary`; secondary = 1 px `--line` border; ghost for icon buttons. Height 32 px.
- Cards: `--surface`, 1 px `--line` border, no shadow, radius 10 px.
- Tables: zebra-free, 1 px row dividers, monospace numbers right-aligned.
- Status: a 6 px dot + word (`verified`, `filled`, `failed`, `skipped`). Colour appears only here.
- Confidence: a thin 40 px bar in `--text` on `--surface-2`.
- Motion: 120 ms opacity/transform only.
- Logo: `brand/otto-mark.svg` (currentColor) at 20 px + the word "otto" in 600 weight.
- Icons: lucide line icons at 16 px, inside buttons only.

## 2. Web dashboard (`apps/web`)

### Layout

```
┌───────────────┬────────────────────────────────────────────────────────────┐
│ ◖◗ otto       │  Overview                                    ● backend ok  │
│               │                                                            │
│ Overview      │  ┌ Field accuracy ┐ ┌ Avg fill time ┐ ┌ AI calls/form ┐    │
│ Profile       │  │ 94.2 %         │ │ 1.8 s         │ │ 0.4           │    │
│ Recipes       │  └────────────────┘ └───────────────┘ └───────────────┘    │
│ Runs          │  ┌ Recipe hit rate┐ ┌ Honeypot fills┐ ┌ Runs          ┐    │
│ Playground    │  │ 71 %           │ │ 0             │ │ 132           │    │
│ Settings      │  └────────────────┘ └───────────────┘ └───────────────┘    │
│               │                                                            │
│               │  Recent runs                                               │
│ ◐ theme       │  time   kind    site                 fields  ok  ai  ms    │
└───────────────┴────────────────────────────────────────────────────────────┘
```

### Pages

| Route | Content | Data |
|---|---|---|
| `/` Overview | 6 stat cards; recent runs table; setup checklist (API key set? extension connected? profile filled?) | `GET /api/health`, `GET /api/runs?limit=20` |
| `/profile` | Grouped form (Identity, Contact, Address, Work, Education, Links, Documents, Custom). Each row: label, input, key in mono. "Add custom field". Save bar appears when dirty. | `GET/PUT /api/profile` |
| `/recipes` | Table: site, form title, steps, runs, healed, last used. Row → detail. | `GET /api/recipes` |
| `/recipes/[id]` | Steps table (key, widget, locators, fingerprint summary), heal history, raw JSON, delete. | `GET/DELETE /api/recipes/:id` |
| `/runs` | Filterable table (kind, site, case). Columns: time, kind, site, found, filled, verified, failed, AI calls, tokens, total ms. | `GET /api/runs` |
| `/runs/[id]` | Timing bar (scan · match · AI · fill · verify), per-field results table (label, source, value, rung used, status, ms), raw JSON. | `GET /api/runs/:id` |
| `/playground` | Grid of test cases: title, stack tags (React, Vue, jQuery, Shadow DOM…), last score, "Open". "Reset all scores". | `cases.ts`, `GET /api/runs?kind=fill` |
| `/playground/[case]` | The test form + Scorer panel (sticky, right side) | local |
| `/settings` | Model select, effort per endpoint, thresholds, toggles, backend version. | `GET/PUT /api/settings` |

## 3. Side panel (`apps/extension`)

Width ~360–420 px. One column. Header + four tabs.

```
┌─────────────────────────────────────┐
│ ◖◗ otto                ● connected  │
│ playground/react-select · localhost │
├─────────────────────────────────────┤
│  Page   Fill   Pick   Log           │
├─────────────────────────────────────┤
│ [ Scan form ]          14 fields    │
│                                     │
│ ☑ First name     Ada        rule ▮▮▮│
│ ☑ Last name      Lovelace   rule ▮▮▮│
│ ☑ Country        India      ai   ▮▮▯│
│ ☐ Why us?        I enjoy…   gen  ▮▯▯│
│ –  Website       (trap)     skip    │
│                                     │
│ [ Fill 12 fields ]   [ Clear ]      │
│                                     │
│ ● verified 11  ● failed 1  1.6 s    │
│ [ Save as recipe ]                  │
└─────────────────────────────────────┘
```

### Tabs

| Tab | Does |
|---|---|
| **Page** | "Summarize this page" → summary card (purpose, key points, actions, risks). Input box below: "Ask about this page". |
| **Fill** | Scan → preview list (tick boxes, inline edit of value, source badge `recipe/rule/ai/gen`, confidence bar, hover highlights the field on the page) → Fill → live progress per row → results → Save recipe. Shows "Recipe found — 0 AI calls" when a recipe matched. |
| **Pick** | "Pick element" → page overlay → selected element card (tag, text excerpt, fields inside) → prompt box → answer + proposed actions with checkboxes → "Run selected actions". |
| **Log** | Last 20 runs on this tab: timings, AI calls, tokens; link "Open in dashboard". |

### States to design

- Backend offline → banner "Start the otto backend: `npm run dev`", disabled actions.
- Restricted page (`chrome://`, Web Store, PDF viewer) → "otto can't read this page".
- No fields found → "No form fields found. Try Pick to select a region."
- Engine orphaned after extension reload → silent re-inject on next action.

## 4. In-page UI (injected by the engine)

Only while otto is active, inside one closed shadow root host appended to `<html>`:

- **Preview outlines:** 2 px outline around each mapped field; colour by status (black = pending, green dot = verified, red dot = failed). Hovering a row in the panel pulses its outline.
- **Picker overlay:** semi-transparent fill + 1 px border on hovered element, small tag label (`div.card · 320×180`). `Esc` cancels, `Alt+↑` selects parent, click confirms.
- Removed completely on `STOP` or when the panel closes.

## 5. Playground pages

See `07-playground.md`. Visual rule: the test forms deliberately look like real sites (different styles per case) — they are *not* styled with otto's design system, except the Scorer panel.
