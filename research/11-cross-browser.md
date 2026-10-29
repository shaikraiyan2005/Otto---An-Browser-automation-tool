# Cross-browser plan (as of Oct 2026)

Confidence: H = primary/official source this session; M = remembered official doc or several secondary sources; L = inference/conflict. Verify M/L against MDN browser-compat-data before locking design.

## 0. Key facts
- **`browser.*` in Chrome 148** — same object as `chrome.*`, promises, works in content scripts/SW/offscreen; `chrome` stays (H). Chrome 136 attempt rolled back; Chrome 149 added DevTools promise support. → Write `browser.*` + promises everywhere; drop `webextension-polyfill` once Chrome floor ≥148 (WXT handles before). https://developer.chrome.com/docs/extensions/develop/concepts/browser-namespace
- **No `sidePanel` or `offscreen` outside Chromium.** Firefox: `sidebar_action` (desktop only). Safari: neither (M).
- **Chrome on Android: no extensions** (desktop-Android builds in development, no date) (M). **Kiwi shut down 2025** (M).

## 1. API matrix
Chromium = Chrome, Edge, Brave, Opera, Vivaldi, Yandex (Arc ≈ Chrome with exceptions).

| API | Chrome/Edge/Brave/Vivaldi | Opera | Firefox desktop (+LibreWolf, Zen, Waterfox) | Firefox Android | Safari macOS | Safari iOS/iPadOS | Orion | Samsung Internet |
|---|---|---|---|---|---|---|---|---|
| Background | `service_worker` | SW | `background.scripts` event page with DOM; SW unsupported (H) | scripts | SW or `scripts` (H) | must be non-persistent (H) | partial (L) | MV2 subset (L) |
| Side UI | `sidePanel` (114+) | own `sidebar_action`; `sidePanel` L | `sidebar_action` (H) | none | none (popup) | none (popup sheet) | L | none |
| `offscreen` | 109+, only `runtime` inside (H) | L | no → event page DOM + Workers/WebGPU | no | no → background page DOM if `scripts` (M) | no | no | no |
| `executeScript` ISOLATED | yes | yes | FF 102+ | yes | 15.4+ | yes | L | partial |
| `world:'MAIN'` | yes | yes | FF 128+ (H) | 128+ | Safari 17+ (M/L) | same | L | L |
| `storage.session` | 102+ | yes | 115+ (M) | yes | 16.4+, cleared on Safari quit (H) | same | L | L |
| Closed shadow roots | `chrome.dom.openOrClosedShadowRoot` | yes | `element.openOrClosedShadowRoot()` in content scripts (M) | same | **none** → MAIN `attachShadow` hook at `document_start` | none | none | none |
| `debugger` | yes (infobar) | yes | no | no | no | no | no | no |
| `userScripts` | 120+ with toggle (M) | L | MV3 ~FF 134–136 (M) | L | no | no | no | no |
| `nativeMessaging` | yes | yes | yes | no | containing app only (H) | same; handler memory-capped | no | no |
| `activeTab` | std | std | yes; host perms user-revocable | yes | per-site prompts (one day / always / every site) (M) | same | L | L |
| `optional_host_permissions` | yes | yes | yes; host perms granted at install since ~127 (M) | yes | funneled to Safari prompts (M) | same | L | L |
| `webNavigation`, `alarms` | yes | yes | yes | yes | yes | yes (alarms throttled) | L | L |
| `idle` | yes | yes | yes | L | no (L) | no | L | L |
| WASM in ext pages | CSP `'wasm-unsafe-eval'` | same | same | yes | same | memory-capped | yes | yes |
| WebGPU in ext | 113+; SW ~124 (M) | yes | FF 141 Windows; Mac/Linux rolling (M) | no | Safari 26 (M) | iOS 26 (M), LLMs impractical | L | L |
| Built-in AI | Chrome Prompt API ext ~138; Summarizer/Translator/LanguageDetector 138; 22 GB disk (H). **Edge: Prompt + Writing Assistance on Phi-4-mini, experimental Canary/Dev; Aion-1.0-Instruct prerelease Edge 150 (H).** Brave/Opera/Vivaldi: assume none (L) | none | extension-only `trial.ml` (Transformers.js) (M/L) | no | **Apple Foundation Models (macOS/iOS 26) via native app / handler** (M) | same, memory limits | no | no |
| WebMCP | Chrome 149 origin trial; `document.modelContext` ~150; Edge 150 trial (M/L) | ? | no | no | no | no | no | no |
| WebAuthn PRF | 116+ (M) | yes | ~135+ (L) | L | 18+ (M) | iOS 18+ | L | L |

Sources: https://developer.chrome.com/docs/ai/prompt-api · https://learn.microsoft.com/en-us/microsoft-edge/web-platform/prompt-api · https://blog.mozilla.org/addons/?p=9190 · https://developer.apple.com/documentation/safariservices/optimizing-your-web-extension-for-safari

### Manifest quirks
- Single background block: `"background": {"service_worker": "bg.js", "scripts": ["bg.js"]}` (Chrome 121+ ignores `scripts`; Firefox 121+ ignores `service_worker`; Safari `scripts` + `"persistent": false` for DOM). Simpler: per-target manifests (WXT).
- Firefox: `browser_specific_settings.gecko` `id`, `strict_min_version: "128.0"`, `gecko_android`, `data_collection_permissions` (required for new AMO submissions since 2025, M). Drop Chrome-only keys (`side_panel`, `offscreen`, `minimum_chrome_version`, `key`).
- Safari: converter lists unsupported keys; `browser_specific_settings.safari.strict_min_version`; `nativeMessaging` → host app only; iOS refuses persistent background.

### Where local models run
- Chromium: offscreen document (`WORKERS`).
- Firefox: event page (DOM, Workers, WebGPU); suspends ~30 s idle → keep port open or host in sidebar/extension tab.
- Safari macOS: popup or extension tab, or Foundation Models in native app.
- iOS/Android: no local LLM in extension; iOS → Foundation Models via native handler; Android → tiny WASM models or rules only.

## 2. Distribution
| Browser | Channel | Cost / review | Notes |
|---|---|---|---|
| Chrome | Chrome Web Store | $5 once; hours–weeks; `debugger`/broad hosts add scrutiny | 2026: team roles, private enterprise publishing |
| Brave, Vivaldi, Arc, Yandex, Opera (helper) | install from CWS directly (H/M) | — | Opera also addons.opera.com (slow, separate) |
| Edge | Edge Add-ons | free; ~7 business days (M) | Edge Android: curated list only (beta) |
| Firefox desktop + Android, forks | AMO | free; auto + human review; **source upload if bundled/minified** (H) | Android: full catalog for compatible add-ons (FF 120+). Tor: advised against extensions → unsupported |
| Safari macOS + iOS | App Store container app via Xcode (`xcrun safari-web-extension-converter`) | **$99/yr**; App Review | App Store Connect web-extension packaging (2025, M/L); CI via `wxt-module-safari-xcode` |
| Orion | installs CWS + AMO extensions (experimental; iOS limited) (H) | — | best-effort |
| Samsung Internet | Galaxy Store extensions closed beta, API subset (H) | apply | low priority |
| DuckDuckGo | no third-party extensions (M) | — | fallback only |

## 3. Mobile
- **Safari iOS/iPadOS:** non-persistent background, unloaded when idle; native handler memory cap (6 MB iOS 15.0, ~80 MB 15.1+, L); content scripts normal; no side panel → in-page Shadow-DOM overlay or popup sheet; AI via Foundation Models or rules; per-site prompts.
- **Firefox Android:** AMO, content scripts, `scripting`, storage, `webNavigation`; no sidebar, nativeMessaging, debugger, WebGPU; UI = popup sheet / extension tab / overlay.
- Edge Android curated; Chrome Android none; Samsung closed beta; Orion iOS partial.
- Mobile flow: tap action (`activeTab`) → inject extractor (ISOLATED) + filler (MAIN) → deterministic matcher (LLM optional) → native setter + events → overlay with confirm/undo.

## 4. Tooling
- **WXT recommended** (M): `wxt build -b firefox|safari|edge`, per-browser manifests, `import.meta.env.BROWSER/FIREFOX/SAFARI/MANIFEST_VERSION`, unified `browser`, `wxt zip` incl. Firefox source zips; Safari via converter or `wxt-module-safari-xcode`. https://wxt.dev/guide/resources/compare
- Plasmo: maintenance mode, old Parcel — avoid (M). CRXJS: Chrome-centric (M). Extension.js: Safari alpha (H).
- Feature detection:
```js
const cap = {
  sidePanel: !!browser.sidePanel, sidebarAction: !!browser.sidebarAction, offscreen: !!browser.offscreen,
  dom: !!browser.dom?.openOrClosedShadowRoot, debugger: !!browser.debugger,
  userScripts: !!browser.userScripts && await probe(), nativeMsg: !!browser.runtime.connectNative,
  lm: 'LanguageModel' in self && (await LanguageModel.availability()) !== 'unavailable',
  webgpu: !!navigator.gpu && !!(await navigator.gpu.requestAdapter()),
  webmcp: !!(document.modelContext ?? navigator.modelContext)
};
```
- MAIN world: try/catch `executeScript({world:'MAIN'})`. Firefox `sidebarAction.open()` / `permissions.request()` lose user activation after `await` (H, bug 1800401) — call synchronously in the gesture handler.

## 5. Engine differences for form filling
| Item | Blink | Gecko | WebKit |
|---|---|---|---|
| Synthetic events | `isTrusted:false`; native setter + `input`/`change` bubbling works in all three (H) | same; ISOLATED Xray wrappers hide page expandos, CustomEvent `detail` needs `cloneInto` → framework fills in MAIN world (M) | same as Blink |
| `execCommand('insertText')` | works (H) | works (~FF 89) (M) | works (M) |
| Closed shadow roots | `chrome.dom.openOrClosedShadowRoot` | `el.openOrClosedShadowRoot()` | none → opt-in per-site MAIN `attachShadow` hook via `registerContentScripts` |
| `scheduler.yield` | 129+ | ~142 (L) | no (L) → `setTimeout(0)` / MessageChannel |
| `checkVisibility` | 105+ | 106+ | 17.4+ (M) |
| Navigation API | 102+ | 147+ | 26.2+ (M) → fallback `webNavigation.onHistoryStateUpdated` |
| IntersectionObserver / ResizeObserver | yes | yes | yes |
| File inputs via `DataTransfer` | yes | yes | 14.1+ (M); iOS file fields → manual fallback |

## 6. Fallbacks without an extension
| Fallback | Can do | Cannot do |
|---|---|---|
| Bookmarklet / paste-in script | run shared engine in page incl. iOS Safari, Chrome Android, DuckDuckGo, locked-down Chrome | blocked by strict CSP on many sites (L); no cross-site storage; no closed shadow; tap each time; no local LLM |
| Userscript (Tampermonkey, Violentmonkey, Safari "Userscripts" app) | auto-run per site, `GM_*` storage, MAIN world | Chrome toggle needed; heavy AI only via localhost companion |
| Desktop companion (Tauri/Electron + native messaging or 127.0.0.1) | bigger local models, OS automation, serves Firefox/Safari | no mobile; installer/signing |
| PWA | host UI/models/vault, share via clipboard | cannot read/fill other sites |

## Recommended architecture
1. **`core/`** (pure TS, no extension APIs): extractor (field graph, labels, autocomplete, ARIA, shadow traversal via injected `getShadowRoot` adapter), matcher (rules first), filler (setter + events, `execCommand` fallback), summarizer chunker, IndexedDB vault (PRF-wrapped key when available, else passphrase). Shipped as IIFE bundle → injectable by `executeScript`, bookmarklet, userscript.
2. **`ai/` provider interface** (`generate`, `embed`, `classify`), chosen at runtime: Chrome Prompt API, Edge Prompt API (Phi-4-mini), WebLLM/Transformers.js WebGPU, WASM tiny models, Apple Foundation Models via native messaging, desktop companion, none (rules only).
3. **`shell/` per browser** (WXT):

| Need | Chromium | Firefox | Safari |
|---|---|---|---|
| UI host | `sidePanel` | `sidebar_action` | popup + in-page overlay |
| Model host | offscreen document | event page or sidebar | popup or native app |
| CDP Pro | `debugger` | — | — |
| WebMCP | behind detection | — | — |

4. **Capability registry** at startup; UI greys out missing features.

### Degradation table
| Feature | Chrome/Edge | Brave/Vivaldi/Opera/Arc | Firefox desktop + forks | Firefox Android | Safari macOS | Safari iOS | Orion | Bookmarklet/userscript |
|---|---|---|---|---|---|---|---|---|
| Side UI | sidePanel | sidePanel (Opera sidebar) | sidebar | overlay/popup | popup/overlay | overlay/sheet | popup | overlay |
| On-demand inject, both worlds | yes | yes | yes | yes | yes | yes | partial | page world only |
| Closed shadow DOM | yes | yes | yes | yes | opt-in hook | opt-in hook | no | no |
| Local LLM | Nano / Phi-4-mini / WebGPU | WebGPU | WebGPU (Win) / WASM | rules + tiny WASM | Foundation Models / WebGPU | Foundation Models | WASM (L) | none / companion |
| CDP (Pro) | yes | yes | no | no | no | no | no | no |
| Native companion | yes | yes | yes | no | container app | container app | no | localhost |
| WebMCP | trial | no | no | no | no | no | no | no |
| Passkey PRF unlock | yes | yes | yes (L) | L | yes | yes | L | n/a |

### Rollout order
1. Chrome Web Store (also Brave, Vivaldi, Arc, Yandex, Opera helper).
2. Edge Add-ons (same build + Phi-4-mini provider).
3. Firefox AMO desktop + Android (event-page model host, `sidebar_action`, Android overlay; AMO source review).
4. Safari macOS + iOS ($99/yr; overlay UI; Foundation Models handler; opt-in shadow hook; test iOS memory).
5. Opera add-ons listing + Orion smoke tests.
6. Userscript/bookmarklet build of `core/` (DuckDuckGo, Chrome Android, locked-down, Tor opt-in).
7. Optional: desktop companion; Samsung Internet beta; Chrome desktop-Android when shipped.

### Verify
Safari `world:'MAIN'` version and `idle`; Opera/Vivaldi/Arc `sidePanel` parity; Firefox WebGPU Mac/Linux and `scheduler.yield`; Prompt API inside offscreen documents; Samsung MV3; WebMCP final API name.
