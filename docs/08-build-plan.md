# 08 — Build plan

Nine milestones. Each ends with a **Done when** check you can run. The order puts measurement (playground) early, so every later step is tested as it is built.

## M0 — Repo, tooling, brand (½ day)

- [ ] `corepack enable`; root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `biome.json`, `.gitignore`, `git init`
- [ ] `packages/shared` and `packages/core` skeletons (`src/index.ts`, tsconfig, Vitest config)
- [ ] `apps/web`: `create-next-app` (TypeScript, App Router, Tailwind, src dir), Geist font, tokens in `globals.css`, `transpilePackages: ["@otto/shared", "@otto/core"]`
- [ ] `apps/extension`: WXT React template, `@wxt-dev/auto-icons` pointed at `brand/otto-app-icon.svg`, side panel entry, manifest from `02-tech-stack.md`
- [ ] Root `pnpm dev` with `concurrently`

**Done when:** `pnpm dev` starts both; `localhost:3000` shows the empty shell with the logo; the unpacked extension loads and its toolbar click opens an empty side panel with the logo.

## M1 — Backend + dashboard shell (1 day)

- [ ] Drizzle schema + `db:push` + demo profile seed
- [ ] `lib/http.ts`, `middleware.ts` (CORS), `/api/health`, `/api/profile`, `/api/settings`, `/api/runs`, `/api/recipes` (+ lookup)
- [ ] `lib/ai/client.ts` with `callStructured()`; a temporary `/api/debug/ping-model` to confirm the key works (delete after)
- [ ] Dashboard pages: Overview (cards + table, empty states), Profile (grouped editor), Settings, Runs, Recipes (tables with empty states)
- [ ] `packages/shared`: profile keys catalogue, all zod schemas from `04-backend-api.md`

**Done when:** profile edits persist across restarts; `/api/health` shows `hasApiKey: true`; the ping call returns a parsed JSON object.

## M2 — Playground first (1–1½ days)

- [ ] `playground/cases.ts` registry + `/playground` grid + `/playground/[case]` page with Scorer panel and `window.__ottoScore()`
- [ ] Build cases 1, 2, 4, 5, 9, 18, 19 first (they cover the core risks)
- [ ] Remaining cases: 3, 6, 7, 8, 10–17, 20–22
- [ ] Cross-origin child page served at `127.0.0.1:3000` for case 15

**Done when:** filling any case **by hand** and pressing Check gives 100 %; leaving it empty gives 0 %; filling a honeypot shows a violation.

## M3 — Extension shell + messaging (1 day)

- [ ] Background: open side panel on action click; `ENSURE_ENGINE` with `scripting.executeScript` (ISOLATED `engine.js` + MAIN `main-world.js`), `PING`, re-inject on "Receiving end does not exist"
- [ ] Typed messaging via `@webext-core/messaging` using `packages/shared/messages.ts`
- [ ] Side panel: header (logo, connection dot from `/api/health`, current tab URL), 4 tabs, backend-offline and restricted-page states
- [ ] Track the active tab (`tabs.onActivated`, `onUpdated`)

**Done when:** opening the panel on a playground case shows "engine ready v0.1"; switching tabs updates the header; reloading the extension and pressing an action re-injects silently.

## M4 — Scan + labels + rules (2 days)

- [ ] `dom/walk.ts` (shadow open/closed, same-origin iframes), `visibility.ts`, `honeypot.ts`, `chunk.ts`
- [ ] `fields/widget.ts`, `labels.ts` (full cascade), `section.ts`, `options.ts`, `extract.ts`, `serialize.ts`
- [ ] `match/autocomplete.ts`, `dictionary.ts`, `rules.ts`, `format.ts`
- [ ] Fill tab: Scan button → preview list (label, value, source, confidence, trap rows), hover highlight on page
- [ ] Vitest: labels on fixtures from cases 2 and 3; dictionary; format (dates, phone, country)

**Done when:** on cases 1–4, 18, 19 every field shows the right label in the preview; honeypots show as "trap"; rules propose correct values for ≥ 60 % of fields on cases 1, 4, 19; scan on case 19 < 50 ms.

## M5 — Fill engine + verify (2–3 days)

- [ ] `fill/primitives.ts`, `engine.ts` (queue, scroll, stable-rect, hit test, ladder, budget), `verify.ts`
- [ ] Adapters in this order: native-text, native-select, check-radio, native-date, range → aria-combobox → react-select → mui → antd → radix/headless → select2/flatpickr (+ main-world bridge) → masked → rich-text → file
- [ ] Fill tab: Fill button, live progress per row, results summary, RunReport → `/api/runs`
- [ ] Iframes: background injects into child frames found by the scan; panel merges results

**Done when:** with values typed into the preview manually (no AI yet), Scorer ≥ 95 % on cases 1, 4–14 and 0 honeypot violations on 18.

## M6 — AI: map, summarize, ask (1½ days)

- [ ] `/api/map` with prompt + schema; panel sends only leftovers; preview badges `ai`/`gen`
- [ ] `/api/summarize` + Page tab summary card; `text/extract.ts`
- [ ] Picker (`picker/overlay.ts`, `context.ts`) + `/api/ask` + Pick tab with proposed actions checklist + `actions/run.ts`
- [ ] Token/latency numbers in RunReport; Log tab

**Done when:** pass criteria rows 1–3 of `07-playground.md` §3 hold on a first visit; summary of case 22 is correct; "fill this section" via Pick fills only that section of case 19.

## M7 — Recipes, replay, healing (1½ days)

- [ ] `recipe/signature.ts`, `locators.ts`, `fingerprint.ts`, `resolve.ts`
- [ ] Save recipe after verified fill (auto when setting on); lookup on scan; preview shows "recipe" source
- [ ] Healing with Similo-lite; write back only after verify; broken steps → `/api/map`
- [ ] Recipes pages in dashboard (detail + heal history)

**Done when:** second visit to case 19 → 0 AI calls, same score; `layout-v2` → ≥ 80 % steps healed, ≥ 85 % accuracy.

## M8 — Measure, harden, report (1–2 days)

- [ ] Playwright `e2e/cases.spec.ts` over all cases; summary table
- [ ] Performance pass on case 21 (chunking, no long tasks) and bundle size check
- [ ] Manual smoke test on 5 real sites; note failures in `/runs`
- [ ] Write `docs/RESULTS.md`: scores per case, timings, AI calls, what failed and why, go / no-go

**Done when:** `RESULTS.md` exists with every pass criterion marked met / not met.

## Stretch (only after M8)

- Deep scan (MAIN-world `addEventListener` hook at `document_start` for chosen origins)
- `wxt build -b firefox` and run the playground in Firefox
- Pro rung: `chrome.debugger` `Input.insertText` for fields that fail all other rungs
- Visual fallback spike: `captureVisibleTab` + small ONNX detector on one canvas page
- WebMCP: use `document.modelContext` tools when a page exposes them

## Rough total

≈ 12–15 working days for one developer for M0–M8.

## Working rules while building

- Build a case before the code that handles it; check it fails, then make it pass.
- Every engine function takes and returns plain data (except DOM refs), so it can be unit-tested with happy-dom.
- Log timings for every phase from day one.
- Keep `engine.js` small: no React, no lodash, no heavy imports in `packages/core`.
- When a real-site failure appears, add a minimal reproduction as a new playground case.
