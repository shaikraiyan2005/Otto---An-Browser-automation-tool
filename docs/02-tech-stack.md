# 02 — Tech stack

Pin exact versions in `package.json` when you scaffold (use the latest stable release at that moment). The table says what to use and why.

## Runtime and tooling

| Tool | Version | Why |
|---|---|---|
| Node.js | 24 LTS (installed: v24.21.0) | Runs Next.js and the build tools. |
| npm | 11 (bundled with Node 24) | Workspaces for the monorepo. |
| TypeScript | 5.x, `strict: true` | One language across engine, extension and web. |
| Biome | latest | Lint + format in one fast tool (simpler than ESLint + Prettier for a prototype). |
| Vitest | latest | Unit tests for `packages/core` with `happy-dom`. |
| Playwright | latest (**dev only**) | End-to-end tests: launches Chrome with the unpacked extension and runs the playground. Never shipped in the product. |
| concurrently | latest | `npm run dev` runs web + extension watchers together. |

## Backend (inside `apps/web`)

| Library | Use |
|---|---|
| Next.js 16 (App Router) route handlers, `export const runtime = "nodejs"` | The backend. One process with the frontend; no separate server to run. |
| `@anthropic-ai/sdk` | Claude calls. Structured outputs via `client.messages.parse()` + `zodOutputFormat()` from `@anthropic-ai/sdk/helpers/zod`. |
| zod 4 | Request/response validation and structured-output schemas (shared with the extension through `packages/shared`). |
| Prisma 7 + PostgreSQL (`@prisma/adapter-pg`) | PostgreSQL 17 in Docker (`npm run db:up`). Schema in `apps/web/prisma/schema.prisma`, applied with `prisma db push`; client generated to `apps/web/src/generated/prisma`. |
| `nanoid` | IDs for recipes and runs. |

### Claude settings

| Endpoint | Model (env var) | Effort | Notes |
|---|---|---|---|
| `/api/map` | `OTTO_MODEL` default `claude-opus-5-5` | `low` | Small structured output; latency matters. |
| `/api/summarize` | `OTTO_MODEL` | `medium` | Structured summary. |
| `/api/ask` | `OTTO_MODEL` | `medium` | Answer + optional actions JSON. |

- `claude-opus-5-5` is the default. To try a faster/cheaper model, set `OTTO_MODEL=claude-haiku-5-5` (or `claude-sonnet-5-5`) in `.env.local` — no code change. The playground's metrics will show the accuracy/latency difference.
- Thinking: Opus 5.5 always uses adaptive thinking; control depth only with `output_config: { effort }`. Don't send `thinking: { type: "disabled" }` (returns 400).
- Prompt caching: put the static system prompt (rules + profile key catalogue) first and mark it `cache_control: { type: "ephemeral" }`; per-page fields come last. Check `usage.cache_read_input_tokens` in run logs.
- Always check `stop_reason` before reading output (`"refusal"`, `"max_tokens"`).
- Max tokens: `/api/map` 4 000, `/api/summarize` 8 000, `/api/ask` 8 000 (non-streaming).

Example (the pattern every endpoint follows):

```ts
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { MapResponse } from "@otto/shared";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY

const res = await client.messages.parse({
  model: process.env.OTTO_MODEL ?? "claude-opus-5-5",
  max_tokens: 4000,
  output_config: { effort: "low", format: zodOutputFormat(MapResponse) },
  system: [{ type: "text", text: MAP_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
  messages: [{ role: "user", content: renderFields(fields, page) }],
});
if (res.stop_reason === "refusal") throw new Error("model declined");
const out = res.parsed_output; // null if parsing failed → handle
```

## Frontend — web dashboard (`apps/web`)

| Library | Use |
|---|---|
| Next.js 16 + React 19 | Dashboard and playground. |
| Tailwind CSS v4 | Styling with the neutral palette as CSS variables. |
| Geist Sans + Geist Mono (`geist` package / `next/font`) | Neutral, clean type. |
| shadcn/ui (copy-in components: Button, Input, Table, Tabs, Badge, Dialog, Switch, Toast) | Minimal accessible primitives; restyled to black/white. |
| `lucide-react` | Small line icons inside the UI only (never in the logo). |
| TanStack Query | Data fetching/caching for dashboard pages. |

### Playground-only dependencies (to reproduce real widgets)

| Library | Test case |
|---|---|
| `react-select` | Searchable/async select |
| `@mui/material`, `@mui/x-date-pickers`, `dayjs`, `@emotion/react`, `@emotion/styled` | MUI Select, Autocomplete, DatePicker |
| `antd` | AntD Select (virtual list), DatePicker |
| `@radix-ui/react-select` | Radix Select (pointer events) |
| `@headlessui/react` | Headless UI Listbox/Combobox |
| `react-imask` | Masked phone / card / date |
| `@tiptap/react`, `@tiptap/starter-kit` | Rich text (ProseMirror) |
| `react-dropzone` | Drag-and-drop file upload |
| Vue 3, jQuery + Select2, flatpickr | Loaded from cdnjs/jsdelivr (pinned versions) inside **static HTML** pages under `public/playground/` — tests non-React stacks |

## Extension (`apps/extension`)

| Library | Use |
|---|---|
| WXT | Builds the MV3 extension; dev mode with reload; `wxt build -b firefox` later. |
| React 19 + Tailwind v4 | Side panel UI (same tokens as the web app). |
| `@webext-core/messaging` | Typed messaging between panel, background and engine. |
| `@wxt-dev/auto-icons` | Generates 16/32/48/128 px icons from `brand/otto-app-icon.svg`. |
| `@mozilla/readability` | Article extraction for summaries (bundled into `engine.js`). |
| `dom-accessibility-api` | `computeAccessibleName` as one label source (~10 kB). |

### Manifest (prototype)

```jsonc
{
  "manifest_version": 3,
  "name": "otto",
  "permissions": ["sidePanel", "scripting", "tabs", "storage", "webNavigation"],
  "host_permissions": ["<all_urls>"],        // prototype simplification
  "side_panel": { "default_path": "sidepanel.html" },
  "action": { "default_title": "otto" },
  "web_accessible_resources": []             // engine is injected with executeScript, not imported
  // no "content_scripts" — nothing runs until the user invokes otto
}
```

## Engine (`packages/core`)

Plain TypeScript, **no runtime dependencies** except `@mozilla/readability` and `dom-accessibility-api`. Bundled by WXT into two unlisted scripts:

- `engine.js` — ISOLATED world. Budget: < 60 kB minified for the prototype.
- `main-world.js` — MAIN world. Small (< 8 kB). Reads framework internals and calls library APIs.

## Shared (`packages/shared`)

zod schemas and TS types: profile keys, `FieldDescriptor`, `Mapping`, `Recipe`, `RunReport`, API request/response shapes, message types. Imported by web, extension and core.

## Not used (on purpose)

| Not used | Reason |
|---|---|
| Playwright / Puppeteer in the product | Too heavy; the engine is plain content scripts. Playwright is only for tests. |
| LangChain or agent frameworks | Three single-call endpoints don't need them. |
| A separate backend server (Express/Fastify) | Next.js route handlers are enough and keep one `npm run dev`. |
| Vector DB | Rules + signatures + AI fallback are enough for the prototype. |
| Plasmo | Maintenance mode; WXT is the better cross-browser base. |
