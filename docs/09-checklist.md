# 09 — Things to take care of

Short, practical list. Most items come from `research/09-edge-cases.md` and the widget research in `research/07`.

## Must handle in the prototype

### Extension mechanics
- [ ] **No `content_scripts` in the manifest.** Inject on demand. A page where otto was never opened must be untouched.
- [ ] **Service worker is stateless.** Chrome stops it after ~30 s idle. All state lives in the side panel or the backend.
- [ ] **"Receiving end does not exist"** → inject engine, retry once.
- [ ] **Orphaned engine** after extension reload: engine checks `browser.runtime?.id` before each message; if gone, removes its overlay and listeners.
- [ ] **Restricted pages** (`chrome://`, Chrome Web Store, other extensions, `view-source:`, PDF viewer, `file://` without permission): detect by URL before injecting and show a clear message.
- [ ] **Side panel opens only from a user gesture** (toolbar click) — set `openPanelOnActionClick: true`.
- [ ] **Tab switching**: panel follows the active tab; refs are per tab and per frame.

### Reading pages
- [ ] Don't rely on ARIA or `<label>`; use the full label cascade (`06-engine.md` §1.5).
- [ ] Walk **open and closed shadow roots** and **same-origin iframes**; inject into **cross-origin frames** separately.
- [ ] Never write attributes into the page DOM during scan (use the ref registry).
- [ ] Yield to the page every ~8 ms on big pages.
- [ ] Hidden real inputs behind styled widgets are **not** honeypots.

### Filling
- [ ] Set values through the **native prototype setter**, then fire `input` and `change` (bubbling, composed). Never just `el.value = …` in MAIN world.
- [ ] Checkboxes/radios via **`click()`** — React listens to `click`.
- [ ] Custom dropdowns: **select an option**; typed text alone is not a value.
- [ ] Use full **PointerEvent** init (`button: 0`, `buttons: 1`, `pointerType: 'mouse'`, coordinates) — Radix/Headless ignore bare `.click()`.
- [ ] **One field at a time.**
- [ ] **Scroll into view** and wait for the element to stop moving before acting.
- [ ] **Check what's on top** (`elementFromPoint`) — cookie banners and sticky headers steal clicks.
- [ ] **Verify** after a settle tick, and **again after 1 s** (pages that re-render wipe early values).
- [ ] AntD DatePicker commits on **Enter**, not blur. MUI Autocomplete must **select before blur**.
- [ ] Masked inputs: type **raw characters one at a time**.
- [ ] Re-scan after each fill: new fields appear (conditional questions, wizard steps).

### Safety rules kept even in the prototype (cheap, and they protect the test results)
- [ ] Never click submit / pay / send / delete automatically — otto fills, the user submits.
- [ ] Never fill: password, `one-time-code`, `cc-*`, CAPTCHA, honeypots, consent/terms/marketing checkboxes.
- [ ] AI actions may only reference refs that exist in the request; unknown refs are dropped.

### AI
- [ ] Only leftovers go to `/api/map`, in **one** call per form step.
- [ ] Structured output with zod (`messages.parse` + `zodOutputFormat`); handle `parsed_output === null` and `stop_reason === "refusal"`.
- [ ] Static system prompt first with `cache_control`; check `cache_read_input_tokens` in run logs.
- [ ] Select fields: the model must return the **exact option text**.
- [ ] Model is configurable (`OTTO_MODEL`); record model name in every RunReport to compare.

### Measurement
- [ ] Every action produces a RunReport with timings, counts and AI usage.
- [ ] Every playground case reports a score.
- [ ] Add a playground case for every real-site failure you find.

## Known gotchas

| Gotcha | What to do |
|---|---|
| Prisma 7 needs a driver adapter | `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`; the datasource URL lives in `prisma.config.ts` |
| Next.js route handler defaults | Add `export const runtime = "nodejs"` and `export const dynamic = "force-dynamic"` to API routes |
| WXT dev mode + side panel | Side panel reloads on rebuild; the engine in open tabs becomes orphaned → handled by the orphan check |
| `chrome.dom` not in types | Declare `chrome.dom.openOrClosedShadowRoot` in a `.d.ts` if the types package lacks it |
| `execCommand` deprecated warnings | Still works in Chrome/Firefox/Safari; it is the most reliable "real typing" without a debugger |
| Cross-origin iframe case on localhost | `localhost` and `127.0.0.1` are different origins — that's how case 15 gets a real cross-origin frame |
| MUI / AntD in the same Next app | Load each heavy library only on its own case page (route-level code splitting) |
| CSP of real sites | The engine never uses `innerHTML`/`eval`; overlay built with `createElement` + `adoptedStyleSheets` |
| `scheduler.yield` missing (Firefox/Safari) | Fallback to `setTimeout(0)` in `chunk.ts` |

## Out of scope for the prototype (by decision)

- Encrypted vault, passkey unlock, auto-lock, origin binding of personal data
- Keeping personal data away from the AI (prototype may send profile values for generated answers)
- Per-site permissions (`activeTab` / optional hosts) — prototype uses `<all_urls>`
- Store publishing, privacy policy, legal review
- Safari, mobile, Edge/Opera listings (Firefox build only as a stretch check)
- Pro build with `chrome.debugger` trusted input
- Visual fallback (screenshots, ONNX detectors, OCR), canvas apps, Flutter
- WebMCP consumption
- Multi-user accounts, sync, telemetry

These are all designed in `research/` and can be added once the prototype proves the core.
