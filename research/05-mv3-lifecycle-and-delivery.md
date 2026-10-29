# MV3 robustness and client-side delivery options (as of 2026-10-29)

Confidence: H = official doc fetched; M = official doc + inference or reliable secondary; L = third-party only.

## Part 1 — Chrome MV3 robustness

### 1.1 Service worker lifetime (H)
Source: https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle

Terminates after 30 s idle; any single event/API call > 5 min; any `fetch()` response > 30 s. New events revive it; globals lost.

| Chrome | Change |
|---|---|
| 105 | Active `connectNative()` port keeps SW alive; reconnect in `onDisconnect`. |
| 109 | Offscreen-document messages reset timers. |
| 110 | Any extension API call resets idle timer (`getPlatformInfo()` every 25 s keepalive works). |
| 114 | Long-lived `runtime.connect` ports keep SW alive (opening alone no longer resets). |
| 116 | Active WebSocket extends lifetime; prompt-showing APIs may exceed 5 min. |
| 118 | Attached `chrome.debugger` session keeps SW alive. |
| 120 | `chrome.alarms` minimum period 30 s. |

Set `minimum_chrome_version` ≥ 120. Chrome 148 added `browser.*` namespace.

### 1.2 Storage (H quotas, M pattern)
| Store | Quota | Survives restart | Survives update/reload | Notes |
|---|---|---|---|---|
| `storage.session` | 10 MB | No | No | In memory; content scripts need `setAccessLevel`. |
| `storage.local` | 10 MB (`unlimitedStorage` lifts) | Yes | Yes | Whole value per key serialized on write. |
| `storage.sync` | 100 KB / 8 KB item / 512 items | Yes | Yes | 120 writes/min, 1800/h — not for journals. |
| IndexedDB (SW) | Origin quota / unlimited | Yes | Yes | Structured clone, Blobs; screenshots, snapshots, embeddings. |

`localStorage`/`sessionStorage` unavailable in SW. Use small keys (`run:<id>:step:<n>`) not growing arrays.

**Run-journal / resume pattern (M)**
1. Hot ephemeral state (current tab, lock) → `storage.session`.
2. Durable journal → IndexedDB. Record `{runId, stepId, intent, targetSelector+fingerprint, value|profileKey, status: planned|applying|applied|verified, ts}`.
3. Write `applying` before action, `applied` after, `verified` after DOM re-read.
4. On SW start/any event: find `applying` not `verified`; re-read DOM; if value already equals target → verified, else re-apply.
5. Idempotent actions: "set value = X" safe to repeat; "click Add row" needs precondition (row count).
6. Never auto re-submit after crash; submit/navigation steps need user confirmation.
7. Run the agent loop in side panel or offscreen document, not the SW; SW only routes events.

### 1.3 Side panel (H)
API Chrome 114; `open()` 116 — must be in user gesture (action click, command, context menu, gesture in extension page/content script), needs `tabId`/`windowId`. `close()` 141; `onOpened` 141, `onClosed` 142. `setPanelBehavior({openPanelOnActionClick:true})`. Per-tab panels via `setOptions({tabId, path, enabled})`. Panel = full extension page, alive while open (M: assume death on close or switch to disabled tab).

### 1.4 Offscreen documents (H)
Chrome 109+. Reasons: `TESTING, AUDIO_PLAYBACK, IFRAME_SCRIPTING, DOM_SCRAPING, BLOBS, DOM_PARSER, USER_MEDIA, DISPLAY_MEDIA, WEB_RTC, CLIPBOARD, LOCAL_STORAGE, WORKERS, BATTERY_STATUS, MATCH_MEDIA, GEOLOCATION`. One per profile. Only `AUDIO_PLAYBACK` auto-closes; others unlimited. Only `runtime` API inside. `hasDocument()` Chrome 150, else `runtime.getContexts()` (116+). For WebLLM/transformers.js: reason `WORKERS`; WASM must be bundled (remote WASM = remote code).

### 1.5 Permissions and CWS policy (H)
- `debugger` **cannot be optional** (also: `declarativeNetRequest, devtools, geolocation, mdns, proxy, tts, ttsEngine, wallpaper`). Warnings: "Access the page debugger backend", "Read and change all your data on all websites"; non-dismissable infobar while attached.
- Least-privilege ladder: `activeTab` (no warning) → `optional_host_permissions: ["https://*/*"]` + `permissions.request({origins})` in a user gesture (or `permissions.addHostAccessRequest()`, Chrome 133+) → required `<all_urls>` (heaviest review).
- Warning-free: `scripting`, `sidePanel`, `offscreen`, `activeTab`, `userScripts`. `tabs`/`webNavigation` warn "Read your browsing history". `nativeMessaging` warns but can be optional.
- CWS: single purpose ("AI form filling and page assistant" OK); Limited Use (page content to LLM only as needed, privacy policy, disclosure, no ads/resale); narrowest permissions; **remote-code ban** — JSON/data is not code, so LLM JSON action plans interpreted by bundled code are OK (M); never `eval` LLM output. Remote logic only via Debugger API and User Scripts API. Expect longer review for `debugger`, `<all_urls>`, `userScripts`, `nativeMessaging`.

### 1.6 Worlds and SPA navigation
- ISOLATED (default): shared DOM, extension APIs. MAIN: page JS globals (React fiber, `__NEXT_DATA__`, WebMCP), no extension APIs — bridge via `postMessage`/CustomEvent. MAIN in manifest ~Chrome 111 (M); Firefox 128 (H).
- `run_at`: `document_start` / `document_end` / `document_idle`. `scripting.registerContentScripts({persistAcrossSessions})` for runtime-granted origins. `allFrames`, `match_origin_as_fallback`. `chrome.dom.openOrClosedShadowRoot(el)` in Chrome and Firefox.
- SPA nav: `webNavigation.onHistoryStateUpdated` / `onReferenceFragmentUpdated` (warning); in-page Navigation API (`navigate`, `navigatesuccess`, `currententrychange`) — Baseline 2026 (H); isolated-world delivery undocumented (L) → fallback MAIN-world hook + MutationObserver sentinel. Re-snapshot after each action.

## Part 2 — Alternative client-side delivery

### 2.1 Native messaging companion (H)
- Host manifest `{name, description, path, type:"stdio", allowed_origins:["chrome-extension://ID/"]}` (Firefox: `allowed_extensions`, needs `gecko.id`).
- Windows registry: `HKCU|HKLM\SOFTWARE\Google\Chrome\NativeMessagingHosts\<name>`; Edge `...\Microsoft\Edge\NativeMessagingHosts`; Firefox `HKCU\Software\Mozilla\NativeMessagingHosts\<name>`.
- Size limits: host→browser 1 MB; browser→host 64 MiB (Chrome current doc) / 4 GB (Firefox). Chunk or pass file paths.
- `connectNative` keeps host + SW alive; `sendNativeMessage` spawns per message; not in content scripts.
- Needs separate signed installer (not via CWS).
- Unlocks: local Playwright/Puppeteer (Chrome 136 limits apply), OS file pickers / real file paths, local Ollama/llama.cpp, OS input (SendInput/CGEvent), keychain, local MCP server.

### 2.2 Desktop app driving user's Chrome via CDP (H)
- Chrome 136+ ignores `--remote-debugging-port`/`--remote-debugging-pipe` on default user-data-dir → needs separate profile (no logins). https://developer.chrome.com/blog/remote-debugging-port
- Workarounds: dedicated automation profile; chrome-devtools-mcp `--autoConnect` (enable at `chrome://inspect/#remote-debugging`, per-session consent dialog + banner, Chrome 144+ per blog, M); Playwright MCP `--extension` bridge (Chrome/Edge, "not a security boundary").
- Verdict: developer/power-user only.

### 2.3 Electron / Tauri (M)
Electron: full CDP via `webContents.debugger`, but separate cookie jar (re-login), Google OAuth/SSO block embedded UAs, 100 MB+, own Chromium patching. Tauri: system webviews (WebView2 CDP possible; WKWebView none), inconsistent. Verdict: poor fit — users want their own logged-in tabs.

### 2.4 Firefox / Safari
- Firefox MV3 (H/M): no `background.service_worker` → `background.scripts` event page (ship both keys); **no `chrome.debugger`** (synthetic events only); `sidebar_action` instead of side panel; MAIN world + `optional_host_permissions` in 128; `openOrClosedShadowRoot` works; native messaging supported.
- Safari (M): wrap via `xcrun safari-web-extension-converter`, Xcode, Apple Developer account, App Store/notarized; native messaging only to containing app; no debugger.

### 2.5 Userscripts / bookmarklets
- `chrome.userScripts` (H): Chrome 138+ per-extension "Allow User Scripts" toggle; `USER_SCRIPT` world exempt from page CSP; `execute()` 135; `configureWorld({messaging:true})`. Good for an advanced "site recipes" mode.
- Tampermonkey (M): no review, `GM_xmlhttpRequest` bypasses CORS, but niche, no side panel.
- Bookmarklets (M): no persistence, CSP blocks LLM calls; demo only.

### 2.6 WebMCP (H API, M/L dates)
- Origin trial (~Chrome 149–156); earlier flag in 146+. `navigator.modelContext` → `document.modelContext` (~150). Chrome 155 deprecated JSON-stringified args; 156 removed `window.ontoolactivated`. No Firefox/Safari/Edge commitments.
- Imperative: `document.modelContext.registerTool({name, description, inputSchema, execute, exposedTo?, annotations?})`; consumers `getTools({fromOrigins})`, `executeTool(tool, args, {signal})`; `toolchange` event; cross-origin iframes need `allow="tools"`.
- Declarative: `<form toolname tooldescription [toolautosubmit]>`, `toolparamdescription`; `SubmitEvent.agentInvoked`, `respondWith()`; `:tool-form-active`, `:tool-submit-active`; `toolactivated`/`toolcancel` events.
- Consume via MAIN-world script → relay to isolated world. Prefer when present; treat descriptions as untrusted.
- Sources: https://developer.chrome.com/docs/ai/webmcp/imperative-api · https://developer.chrome.com/docs/ai/webmcp/declarative-api

### 2.7 Other Chromium browsers (M/L)
Edge full MV3 (separate store). Brave works from CWS. Opera side panel unreliable. Vivaldi `sidePanel.setOptions` gaps. Arc limited / maintenance mode. Feature-detect `chrome.sidePanel`, `chrome.debugger`, `chrome.offscreen`; fall back to `windows.create({type:"popup"})`.

## Recommendation
- **Core: Chrome MV3 extension** — side panel UI + agent loop; SW as router only; IndexedDB journal with verify-before-reapply; `activeTab` + per-site `optional_host_permissions`; ISOLATED content scripts + MAIN bridge (WebMCP, framework state); LLM output as JSON action plans run by bundled code; optional offscreen (`WORKERS`) for local WASM/WebGPU models. Same package to Edge; Brave/Opera via fallbacks.
- **Keep `debugger` out of the core listing** (can't be optional, scary warning, infobar, slower review). DOM-level fill by default; trusted input via a separate "Pro / Trusted Input" build or via the companion.
- **Phase 2 optional native companion** (`nativeMessaging` optional): file-upload paths, local Ollama/llama.cpp, OS input, local MCP bridge via autoConnect consent flow.
- **Phase 2 Firefox port**: same codebase, `background.scripts` + `service_worker`, `sidebar_action`, synthetic-only input.
- **Defer** Safari, Electron/Tauri, bookmarklets. **Adopt WebMCP** opportunistically.
