<p align="center">
  <img src="brand/otto-app-icon.svg" width="72" height="72" alt="otto">
</p>

<h1 align="center">otto</h1>

<p align="center">An AI browser assistant that understands any web page, fills any form from your profile, and remembers the forms it has filled.</p>

---

otto runs in your own browser, on the tabs where you are already logged in. Open the side panel on any page and otto can:

- **Fill forms**: text fields, custom dropdowns, date pickers, masked inputs, rich-text editors, file uploads, checkboxes and radios, inside iframes and shadow DOM. It works on React, Vue, Angular, Svelte, jQuery and plain HTML/PHP sites.
- **Remember forms**: a filled form is saved as a *recipe*. The next visit fills it with no AI call. When the site changes, otto repairs only the steps that broke.
- **Summarize pages**: purpose, key points, actions and risks.
- **Select and prompt**: pick any element on the page and ask about it or tell otto what to do with it.

> **Status:** working prototype, built to prove that the architecture works. Security hardening (encrypted vault, per-site permissions) and store publishing are designed in [`research/`](research/) but not built yet.

## Results

The repo includes a playground of 21 test forms that score themselves against the profile. With **rules only (no AI, no API key)**:

| Run | Fields correct | Trap fields filled | AI calls |
|---|---|---|---|
| First visit | **173 / 174 (99.4%)** | 0 | 0 |
| Repeat visit (recipes) | **173 / 174 (99.4%)** | 0 | 0 |

The cases cover plain HTML, a form with no labels ("div soup"), a table layout, React controlled inputs, react-select, Material UI, Ant Design, Radix + Headless UI, masked inputs, rich text, file uploads, Vue 3, jQuery + Select2 + flatpickr, open and closed shadow DOM, same- and cross-origin iframes, a multi-step wizard, a dynamic form, honeypot traps, a big page with 50,000 elements, and a 30-field job application plus a changed-layout version of it to test self-healing. A typical page scans in 25–55 ms.

## How it works

```
 Browser                                             apps/web (Next.js)
 ┌─────────────────────────────────────┐            ┌──────────────────────────────┐
 │ Side panel (React)                  │   HTTP     │ Dashboard  /, /profile,      │
 │   Fill · Page · Pick · Log          │ ─────────► │            /recipes, /runs,  │
 │        │                            │            │            /playground       │
 │        ▼ inject on demand           │            │ API        /api/map          │
 │ engine.js in every frame            │            │            /api/summarize    │
 │   scan → match → fill → verify      │            │            /api/ask …        │
 └─────────────────────────────────────┘            │ Prisma ─► PostgreSQL         │
                                                    │ Anthropic SDK ─► Claude      │
                                                    └──────────────────────────────┘
```

1. **Nothing runs until you open otto.** The engine (about 67 KB) is injected into the page only when you use it, so pages you don't use it on pay no cost.
2. **Reading the page** doesn't depend on accessibility labels. otto uses the page structure, layout, styles and hit-testing. Labels come from `<label>`, ARIA, Chrome-autofill-style inference (nearby text, table cells, legends), and finally field attributes.
3. **Matching** tries a saved recipe first, then the field's `autocomplete` hint, then a multilingual dictionary. Only the fields still unresolved go to Claude, in **one** request. The AI sees field descriptions and profile *key names*. Your values are inserted locally, except when it has to write a free-text answer.
4. **Filling** goes one field at a time with a ladder of methods, from native setter + events, to open-type-pick for custom dropdowns, to character-by-character typing. Every value is **read back**. The whole form is re-checked after the page settles, and new fields that appear are filled too.
5. **Recipes** store a fingerprint of every field (label, name, type, section, nearby text, position). When a site changes, a step is re-located by its meaning or by a Similo-style similarity score, and only broken steps go to the AI.
6. **Safety:** otto never submits, pays or sends. It never fills passwords, card numbers, one-time codes, CAPTCHAs or consent/marketing boxes, and it skips hidden honeypot fields.

The full architecture is in [`research/otto-architecture.pdf`](research/otto-architecture.pdf) (3 pages) and [`docs/`](docs/).

## Repository

```
apps/
  web/          Next.js 16 + Tailwind v4 dashboard, playground and API routes; Prisma 7 + PostgreSQL
  extension/    WXT (Chrome MV3) side panel, background worker, on-demand engine
packages/
  core/         the engine: scan, labels, rules matcher, fill adapters, verify, recipes, picker
  shared/       types, zod schemas, profile keys, message protocol
e2e/            Playwright suite that loads the extension and scores every playground case
docs/           build plan and design docs
research/       research behind the architecture
brand/          logo
```

## Getting started

**Requirements:** Node.js 24, Docker (for PostgreSQL), Chrome or another Chromium browser.

```bash
git clone https://github.com/shaikraiyan2005/Otto---An-Browser-automation-tool.git otto
cd otto
npm install
cp apps/web/.env.example apps/web/.env     # add ANTHROPIC_API_KEY for AI features (optional)
npm run db:up                              # PostgreSQL 17 in Docker
npm run db:push                            # create tables
npm run dev:web                            # http://localhost:3000
npm run build:ext                          # apps/extension/.output/chrome-mv3
```

If `npm install` reports install scripts that were not run (npm 11 asks for approval), run `npm install-scripts approve esbuild @prisma/engines prisma` and then `npm install` again.

### Load the extension

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose `apps/extension/.output/chrome-mv3`.
3. Pin otto to the toolbar.

### Try it

1. Open http://localhost:3000/playground and pick a case (for example **Job application**).
2. Click the otto icon. In the **Fill** tab press **Scan**, review the values (source, confidence, hidden traps), then press **Fill**.
3. Press **Check** at the bottom right of the test page to see the score.
4. Reload and fill again to see the recipe used with 0 AI calls. Then open `/playground/job-application?layout=v2` to see self-healing on a changed layout.
5. Edit your data in **Profile**. See every run with per-field detail in **Runs**, and saved forms in **Recipes**.

AI features (**Page** summary, **Pick** and prompt, and fields the rules can't decide) need `ANTHROPIC_API_KEY` in `apps/web/.env`. The model defaults to `claude-opus-5-5` and can be changed on the **Settings** page.

### Docker

```bash
docker compose --profile app up --build    # web on :3000, PostgreSQL on :5432
```

Pass `ANTHROPIC_API_KEY` in your shell environment to enable AI. The extension still has to be built and loaded locally.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev:web` | Web app and API in dev mode |
| `npm run dev:ext` | Extension in watch mode |
| `npm run build:ext` | Production build of the extension |
| `npm run db:up` / `npm run db:push` | Start PostgreSQL / apply the Prisma schema |
| `npm test` | Engine unit tests (Vitest) |
| `npm run e2e` | Playwright: load the extension in Chromium, fill and score every playground case (web app must be running) |

## Environment

`apps/web/.env.example`:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Claude API key (optional; rules work without it) |
| `OTTO_MODEL` | Default model, e.g. `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5` |

## Tech

TypeScript · Next.js 16 · React 19 · Tailwind CSS 4 · Prisma 7 · PostgreSQL 17 · WXT · Anthropic SDK · Mozilla Readability · Vitest · Playwright · Docker

## Limits (prototype)

- Chrome / Chromium first. Firefox and Safari builds are designed but not tested.
- Profile data is stored unencrypted in PostgreSQL, and the extension asks for access to all sites.
- Sites that accept only real keystrokes (`isTrusted` checks), canvas apps and CAPTCHAs are out of scope.
- No tool fills every field on every site. Fields otto can't fill are marked and left for you.
