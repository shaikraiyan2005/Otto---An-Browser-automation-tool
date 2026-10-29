# 07 — Playground and scoring

The playground answers "does it work?" with numbers. Every case is a form we control, so we know the correct value for every field.

## 1. How scoring works

- The demo profile is seeded into the backend. Each case declares `expected: Record<fieldId, ExpectedValue>` derived from that profile, plus `mustStayEmpty: fieldId[]` (honeypots, consent boxes).
- The **Scorer** panel (sticky on the right, styled with otto's design system) has **Check result**. It reads the *application state*, not just the DOM:
  - React cases: the form's state object (exposed through a ref) — proves the framework registered the value.
  - Static HTML cases: `new FormData(form)` + Vue/jQuery model read via a small hook on `window.__caseState()`.
- Result per field: `correct`, `wrong`, `empty`, `trap-filled`. Score = correct / total expected.
- Posts to `/api/playground/score`, linked to the latest run on that page (the extension sends `caseId` from `<meta name="otto-case" content="…">`).
- `window.__ottoScore()` returns the same result so Playwright can assert it.
- **Reset** clears the form (and for cases with "v2" variants, switches layout).

## 2. Cases

| # | Case id | Stack | What it tests | Fields |
|---|---|---|---|---|
| 1 | `plain-html` | static HTML, `<form method="post">` like a PHP site | baseline: `<label for>`, native inputs, select, radio, checkbox, textarea | 14 |
| 2 | `no-labels` | static HTML, "div soup", hashed class names, no `<label>`, no ARIA | label inference: previous text, geometry, placeholders only | 12 |
| 3 | `table-layout` | static HTML, labels in `<td>` left column, old-school | Chromium table label inference | 10 |
| 4 | `react-controlled` | React state, controlled inputs, live JSON of state | value registers in React state | 12 |
| 5 | `react-select` | react-select single, multi, async (search) | custom combobox, typing to filter, portals | 4 |
| 6 | `mui` | MUI TextField, Select, Autocomplete, X DatePicker, Checkbox, RadioGroup | hidden native input, sectioned date, select-before-blur | 8 |
| 7 | `antd` | AntD Input, Select (country list, virtual), DatePicker, Radio, Switch | virtual list filtering, Enter-to-commit date | 7 |
| 8 | `radix-headless` | Radix Select, Headless UI Listbox + Combobox | PointerEvent-only widgets | 4 |
| 9 | `masked` | react-imask phone, card-like number (not a real card), date `DD/MM/YYYY`, postcode | per-character typing | 5 |
| 10 | `rich-text` | Tiptap editor + plain contenteditable + textarea | `insertText`, paste fallback | 3 |
| 11 | `files` | `<input type=file>` + react-dropzone | DataTransfer upload (sample PDF from `public/sample-resume.pdf`) | 2 |
| 12 | `vue` | static HTML + Vue 3 (CDN), `v-model`, `v-model.lazy`, custom select component | non-React framework events | 9 |
| 13 | `jquery-select2` | static HTML + jQuery + Select2 + flatpickr (CDN) | legacy stack, plugin widgets | 6 |
| 14 | `shadow-dom` | web components: open shadow root form + closed shadow root form | deep walk, `openOrClosedShadowRoot` | 8 |
| 15 | `iframes` | same-origin iframe form + cross-origin iframe (`http://127.0.0.1:3000/playground/frame-child.html`) | per-frame injection and merge | 8 |
| 16 | `wizard` | 3-step form, "Next" buttons, step 2 appears only after step 1 is valid | multi-step, settle, re-scan | 15 |
| 17 | `dynamic` | fields appear after a radio choice; whole form loads after 1.5 s; one field resets once after hydration-like re-render | settle detection, verify-after-1s refill | 10 |
| 18 | `honeypot` | 3 hidden trap fields (display:none, off-screen, 1 px) + "leave blank" field + consent & marketing checkboxes | must stay empty | 6 + 6 traps |
| 19 | `job-application` | realistic long ATS-style form: personal, address (billing/shipping-style sections), work history, education, links, free-text questions, resume upload | everything together, generated answers | 40 |
| 20 | `layout-v2` | same as case 19 but toggle "v2": ids/names renamed, order changed, labels reworded slightly, a wrapper added | recipe healing | 40 |
| 21 | `big-dom` | 50 000-element page with a 20-field form at the bottom | scan performance, chunking | 20 |
| 22 | `article` | long article page with headings, a table, a sign-up form | summarize + ask | — |

## 3. Pass criteria (the prototype "works" if…)

| Metric | Target | How measured |
|---|---|---|
| Field accuracy, cases 1–18 (first visit, rules + AI) | ≥ 90 % overall, no case below 75 % | Scorer |
| Field accuracy, case 19 | ≥ 85 % (free-text answers judged by "non-empty and relevant") | Scorer + manual glance |
| Honeypot / consent violations | **0** | Scorer |
| AI calls on a first visit | ≤ 1 per form step | RunReport.llmCalls |
| Fields resolved by rules (no AI) | ≥ 60 % on cases 1, 4, 19 | RunReport details |
| Repeat visit (recipe replay) | 0 AI calls, same accuracy | RunReport |
| Healing on `layout-v2` | ≥ 80 % of steps healed without AI; total accuracy ≥ 85 % | RunReport + Scorer |
| Scan time, case 19 | < 50 ms | RunReport.timings.scan |
| Scan time, case 21 | < 300 ms, no long task > 50 ms | RunReport + DevTools |
| Summary (case 22) | purpose correct, ≥ 3 relevant key points, mentions the form | manual |
| Pick + prompt "fill this section" on case 19 | fills the selected section only | manual |
| Real sites (manual smoke test) | 5 real forms (e.g. a Greenhouse job page, a Google Form, a Typeform, a Shopify checkout address step, a government contact form) filled ≥ 80 % without breaking the page | manual notes in `/runs` |

If these hold, the architecture is validated and the next step is the product work from the research (vault, cross-browser shells, Pro build).

## 4. Automated run (`e2e/cases.spec.ts`)

Playwright (test harness only):

1. `chromium.launchPersistentContext('', { headless: false, args: ['--disable-extensions-except=<ext>', '--load-extension=<ext>'] })`
2. For each case: open the page, open the side panel page directly (`chrome-extension://<id>/sidepanel.html?tab=<tabId>`), trigger Scan → Fill-all through the panel's test hook (`window.__ottoTest.fillAll()`), wait for completion.
3. `await page.evaluate(() => window.__ottoScore())` → assert ≥ target.
4. Second pass on cases 19/20 for recipe replay and healing.
5. Print a summary table; results also land in `/runs`.
