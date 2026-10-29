# otto

otto is a prototype AI browser assistant. It runs in your own browser and can:

- **Read any page** and give a structured summary.
- **Fill any form** from your saved profile: text fields, custom dropdowns, date pickers, masked inputs, rich text, file uploads, checkboxes, iframes and shadow DOM.
- **Remember forms.** A form filled once is saved as a recipe and filled again with no AI call. When the site changes, only the broken steps are repaired.
- **Select and prompt.** Click any element on a page and ask otto about it or tell it what to do.

This repository is a **working prototype**, not a product. Its job is to answer one question: *does this architecture actually work?* Security hardening, store publishing and multi-browser polish are deliberately left out (see `docs/09-checklist.md` → "Out of scope").

## How it fits together

```
┌──────────── Browser (Chrome first) ────────────┐        ┌──────── apps/web (Next.js) ────────┐
│ apps/extension (WXT)                           │  HTTP  │  Frontend: dashboard + playground   │
│  side panel UI ──► background ──► inject       │ ─────► │  Backend:  /api/* route handlers    │
│                                   engine.js    │        │            SQLite (Drizzle)         │
│  engine.js = packages/core (scan, match, fill) │        │            Claude (Anthropic SDK)   │
└────────────────────────────────────────────────┘        └─────────────────────────────────────┘
```

- **Frontend:** a Next.js web app (dashboard for profile, recipes, run history, settings) plus the extension's side panel.
- **Backend:** Next.js route handlers in the same app, with SQLite for storage and Claude for the AI steps.
- **Engine:** `packages/core`, plain TypeScript, injected into pages only when you use otto.
- **Playground:** test forms inside the web app (React, Vue, jQuery, MUI, AntD, shadow DOM, iframes, honeypots, wizards…) with automatic scoring. This is how we measure whether otto works.

## Documents

| Doc | What it covers |
|---|---|
| [docs/01-architecture.md](docs/01-architecture.md) | Components, data flow, sequence diagrams for every feature |
| [docs/02-tech-stack.md](docs/02-tech-stack.md) | Every library and tool, and why |
| [docs/03-project-structure.md](docs/03-project-structure.md) | Full folder tree and what each file does |
| [docs/04-backend-api.md](docs/04-backend-api.md) | Backend: database schema, API endpoints, AI prompts |
| [docs/05-frontend.md](docs/05-frontend.md) | Web dashboard and side panel: pages, components, design system |
| [docs/06-engine.md](docs/06-engine.md) | The core engine: scanning, labels, matching, filling, verifying, recipes, healing |
| [docs/07-playground.md](docs/07-playground.md) | Test cases, scoring, and the pass/fail criteria |
| [docs/08-build-plan.md](docs/08-build-plan.md) | Milestones, tasks and "done when" checks |
| [docs/09-checklist.md](docs/09-checklist.md) | Things to take care of, known gotchas, out-of-scope list |
| [brand/README.md](brand/README.md) | Logo files and palette |
| [research/](research/) | The research behind these decisions |

## Quick start (once milestone M0 is built)

```bash
corepack enable            # gives you pnpm
pnpm install
cp apps/web/.env.example apps/web/.env.local   # add ANTHROPIC_API_KEY
pnpm dev                   # web on http://localhost:3000, extension dev build in apps/extension/.output
```

Then load `apps/extension/.output/chrome-mv3-dev` as an unpacked extension in `chrome://extensions`, open http://localhost:3000/playground, and click the otto toolbar icon.
