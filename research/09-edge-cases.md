# Edge-case catalog: websites and situations that break a client-side MV3 extension

Confidence: H = primary source / established platform behavior; M = community/vendor/issue evidence or strong inference; L = informed guess, test first.

**Reconciled with other research:**
- Where this catalog says "persist task state in `chrome.storage.session`", use **IndexedDB / `storage.local`** instead for anything that must survive restart or update (see 03 C9, 05). `storage.session` only for hot state.
- Where it says `all_frames`, follow 10-lightweight-performance: inject **on demand** into the top frame plus the specific `frameIds` that contain the form — not every frame by default.
- Value setting: from the isolated world plain `.value=` reaches the native setter; the prototype-setter call is equivalent and harmless (07 §0).

## Sources
1. Content scripts manifest: https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts
2. Chrome 133: `executeScript` uses `match_origin_as_fallback` by default: https://groups.google.com/a/chromium.org/g/chromium-extensions/c/D8DcJARVM90/m/mj4U-XOCAAAJ
3. content_scripts IDL: https://chromium.googlesource.com/chromium/src/+/main/extensions/common/api/content_scripts.idl
4. Prerender / documentLifecycle / documentId: https://developer.chrome.com/blog/extension-instantnav
5. Prerender into new tab: https://groups.google.com/a/chromium.org/g/chromium-extensions/c/-vKmiKi5mmY
6. bfcache restore doesn't re-run scripts: https://groups.google.com/a/chromium.org/g/chromium-extensions/c/1ikOwxWiU_g
7. `runtime_blocked_hosts` policy: https://support.google.com/chrome/a/answer/9867568
8. `isAllowedFileSchemeAccess()`: https://developer.chrome.com/docs/extensions/reference/api/extension
9. PDF viewer component extension: https://groups.google.com/a/chromium.org/g/chromium-extensions/c/CNPumQ7X4qs
10. Incognito modes: https://developer.chrome.com/docs/extensions/reference/manifest/incognito
11. Trusted Types and extensions: https://github.com/w3c/trusted-types/wiki/Effects-of-deploying-Trusted-Types-on-browser-extension-developers
12. React controlled inputs: https://github.com/facebook/react/issues/10135
13. Bitwarden shadow DOM / iframe CVE: https://community.bitwarden.com/t/autofill-is-not-working-for-these-sites/60115 · https://www.opencve.io/cve/CVE-2018-25081
14. Salesforce synthetic shadow / Locker: https://developer.salesforce.com/docs/platform/lwc/guide/create-dom-synthetic.html
15. Grammarly vs editors: https://github.com/facebook/draft-js/issues/616 · https://www.grammarly.com/blog/engineering/making-grammarly-feel-native-on-every-website/
16. Hydration mismatch from extensions: https://nextjs.org/docs/messages/react-hydration-error · https://github.com/remix-run/remix/issues/2947
17. Autofill across iframes: https://chromium.googlesource.com/chromium/src.git/+/lkgr/docs/security/autofill-across-iframes.md
18. Debugger infobar / policy: https://developer.chrome.com/docs/extensions/reference/api/debugger
19. SW lifecycle, "Extension context invalidated": https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle
20. Stagehand #943 shadow DOM/iframes: https://github.com/browserbase/stagehand/issues/943
21. Chrome Android extensions: https://www.ubergizmo.com/2025/04/chrome-extension-support-android/

## A. Pages where content scripts cannot run
| Case | Symptom / cause | Detection | Fix | Unfixable? | Conf |
|---|---|---|---|---|---|
| `chrome://`, `chrome-untrusted://`, `devtools://`, `edge://` | "Cannot access a chrome:// URL" | URL scheme check; `lastError` | "Can't read this page"; allow pasted text | Yes | H |
| Chrome Web Store | "The extensions gallery cannot be scripted" | hostname | Same message | Yes | H |
| Other extensions' pages | cross-extension isolation | scheme + id | Message | Yes | H |
| `file://` | file access off by default | `chrome.extension.isAllowedFileSchemeAccess()` | Onboarding deep link `chrome://extensions/?id=<id>`, reload | User must act | H |
| `view-source:` | restricted | prefix | Offer underlying URL | Yes | H |
| Built-in PDF viewer | only `<embed>`; viewer is component extension | `document.contentType==='application/pdf'` | Fetch PDF URL from extension page, parse with bundled pdf.js; blob PDFs → ask user to upload | Partly | H/M |
| Enterprise `runtime_blocked_hosts` | "cannot be scripted due to an ExtensionsSettings policy" | error string; `installType==='admin'` | Explain; never retry loop | Yes | H |
| Sandboxed iframe (null origin) | static scripts miss it | `frame.origin==='null'` | `match_origin_as_fallback` (default in `executeScript` since 133) | No | H |
| `about:blank`/`srcdoc`/`blob:`/`data:` frames | not URL-matchable | frame scan | `match_about_blank` + `match_origin_as_fallback`; top-level `data:` not coverable | top-level data: yes | H |
| Cross-origin iframes | own script per frame | `getAllFrames` | inject per frameId, merge form model across frames | No | H |
| Iframe origin not granted (`activeTab` = top origin only) | permission error | error on frameId | request `optional_host_permissions` for that origin | No | H |
| Prerendered pages | UI to invisible page; `tabs.query` misses it | `document.prerendering`, `prerenderingchange` | defer until activation; key by `documentId` | No | H |
| bfcache restore | stale state, dead ports, no re-run | `pageshow` `e.persisted` | reconnect + re-scan; no long-lived ports (block bfcache) | No | H/M |
| `document.open()` rewrite | UI/listeners vanish | documentElement replaced | re-attach UI root | No | M |
| Discarded/frozen tab | "Receiving end does not exist" | `tab.discarded`/`frozen` | inject then retry once | No | H |
| Tabs open before install/update | no scripts present | no receiver | inject lazily | No | H |
| HTTP auth / SSL / Safe Browsing interstitials | injection fails | `webNavigation.onErrorOccurred` | message | Yes | M |

## B. CSP and Trusted Types
| Case | Symptom / cause | Fix | Conf |
|---|---|---|---|
| `innerHTML` under `require-trusted-types-for 'script'` | "requires 'TrustedHTML' assignment"; MAIN world not exempt | `createElement`/`textContent`; UI in side panel; never innerHTML in MAIN | H/M |
| `<script>` tag injection for MAIN world | blocked by `script-src` | `chrome.scripting.executeScript({world:'MAIN'})` bypasses page CSP for injection | H |
| `eval`/`new Function` in MAIN | EvalError | never eval; static functions | H |
| Inline styles from content script | missing on strict `style-src` | `chrome.scripting.insertCSS`, `adoptedStyleSheets` in shadow root | M |
| WAR iframe/image blocked | blank overlay | prefer side panel | M |
| Site collects `securitypolicyviolation` reports | user flagged in telemetry | avoid violations entirely | M |

## C. Hostile or patched page environments
| Case | Symptom / cause | Fix | Unfixable? | Conf |
|---|---|---|---|---|
| Patched `value` setter (React tracker, Locker, anti-bot) | value shown, framework state empty | isolated world has pristine prototypes: native setter + `InputEvent('input')` + change + blur; verify persists | No | H |
| `isTrusted` checks / patched dispatch | synthetic events ignored | Pro: CDP `Input.*`; free: ask user to click/type; try `execCommand('insertText')` | Partly | H/M |
| `attachShadow` forced closed | fields invisible | `chrome.dom.openOrClosedShadowRoot(el)` | No | H |
| Anti-tamper / bot managers (Akamai, PerimeterX, DataDome) | logout, challenge | minimal DOM injection (side panel), human pacing, one field at a time, assist mode | Partly | M |
| DevTools detection | page breaks on debugger attach (Pro) | only `Input`/`DOM`/`Accessibility` domains, not `Runtime`/`Debugger`; attach late, detach fast | Partly | M |
| Frozen/patched `fetch`/`MutationObserver`/`rAF` | MAIN helpers misbehave | logic in isolated world; MAIN only reads framework internals, snapshot natives at `document_start` | No | H |
| Site removes foreign nodes | badge disappears | side panel UI; re-attach with backoff | No | M |
| Debugger blocked by policy / DevTools open | attach error | fall back to free path | Policy: yes | H/M |
| Debugger infobar, user clicks Cancel | `onDetach` `canceled_by_user` | onboarding explanation, attach only during task | Consumer: yes | H/M |

## D. Big, dynamic and framework DOMs
| Case | Symptom / cause | Fix | Conf |
|---|---|---|---|
| Huge DOM (100k+) | freezes, OOM on 4 GB | pruned TreeWalker, chunk with `scheduler.yield()`, cap ~5–10k candidates, Readability for text, never raw HTML | H |
| Infinite scroll | summary of first screen only | summarize visible + offer "load more" with capped auto-scroll | H |
| Virtualized lists/grids (react-window, AG Grid, MUI DataGrid) | missing rows, filled cells vanish | read `aria-rowcount`, step-scroll + dedupe by row id; fill row in view then verify | H/M |
| `content-visibility:auto`, `hidden=until-found` | empty innerText, zero rects | `textContent`; `scrollIntoView` before measuring | M |
| Lazy forms / skeletons | fill hits placeholders, values wiped | settle: no mutations 500 ms, `aria-busy` false, visible + enabled, max timeout | H |
| SSR hydration | early values wiped; hydration error | no DOM mutation before load + settle; UI outside app root; re-verify after 1 s, refill once | H |
| SPA route changes | stale model | `onHistoryStateUpdated`, Navigation API, invalidate + lazy re-scan | H |
| Turbo/HTMX/Livewire/PJAX | fragments swapped | listen `turbo:load`, `htmx:afterSwap`, `livewire:navigated`, `pjax:end`; stable fingerprints not node refs | H/M |
| ASP.NET WebForms | AutoPostBack reloads mid-fill; "Invalid postback" | detect `__VIEWSTATE` / `__doPostBack` in onchange; fill in DOM order, wait for navigation, re-scan, continue; never touch `__` fields | H/M |
| JSF / PrimeFaces / ADF | generated ids change | match by label/name suffix/ARIA; wait for `jsf.ajax` idle | M |
| PHP multi-page wizards | only step 1 filled | persist flow state, resume each load | H |
| GWT / Vaadin / Flutter web canvas | no inputs | Flutter: enable semantics (`flt-semantics` placeholder click); else Pro CDP + coordinates / visual pipeline (08) | M |
| Salesforce Lightning (LWC, Locker) | qSA misses, values revert | isolated world unpatched natives, walk real shadow roots, composed events; combobox click-type-select | M |
| ServiceNow | `gsft_main` iframe / web components | MAIN `g_form.setValue(field,val)`; else frame + shadow traversal | M |
| SAP Fiori/UI5 | model not updated | MAIN `sap.ui.getCore().byId(id).setValue(v)` + `fireChange`; else trusted keys | M |
| Workday / Oracle / Dynamics comboboxes | typed text not selected | generic combobox routine (07) | M |
| Google Forms | `div role=radio`, split dates | click by role + label | M |
| Typeform | one question at a time | fill → Enter → settle → re-scan loop, step cap | M |
| Webflow/Wix/Squarespace | iframes/custom elements | generic frame + shadow path | L/M |
| HubSpot/Marketo | late embed, sometimes iframe | wait for render; MAIN `MktoForms2.getForm(id).vals({...})` | M |

## E. Payments, auth, verification
| Case | Fix | Unfixable? | Conf |
|---|---|---|---|
| Stripe/Braintree/Adyen hosted fields | v1: don't fill cards; let Chrome/password manager. Later: per-frame, user-initiated, native setter | Product decision | H |
| Shopify checkout | address/contact only, skip payment | Partly | M |
| PayPal / Apple Pay / Google Pay | hand off; resume on focus return | native sheets: yes | H |
| reCAPTCHA / hCaptcha / Turnstile | never solve; pause, highlight, ask user | by design | H |
| OTP / 2FA / WebAuthn | pause for user; split OTP boxes per box or paste event | WebAuthn: yes | H |
| SSO redirects / OAuth popups | track by `openerTabId`; don't fill IdP credentials; resume on return | No | M |
| Session timeout mid-form | snapshot entered values before submit; offer re-fill after login | No | M |

## F. Field-level traps
| Case | Detection | Fix | Conf |
|---|---|---|---|
| **Honeypot fields** | `display:none`, `visibility:hidden`, offscreen `-9999px`, `opacity:0`, `aria-hidden`, `tabindex=-1`, 1px, names `website`/`url2`/`hp_`, "leave blank" | fill only visible (`checkVisibility({checkOpacity,checkVisibilityCSS})`), non-zero, not aria-hidden | H |
| Required hidden fields | `required` + hidden | fill trigger field, re-scan | H |
| Disabled-until-valid buttons | `disabled`/`aria-disabled` | full events + blur; report still-invalid field; never remove `disabled` | H |
| Debounce / async validation | — | wait 300–800 ms per field, verify | H |
| Server validation after submit | `aria-invalid`, `.error`, `role=alert` | parse, map to fields, ask user; no auto-resubmit | H |
| maxlength / masks | `maxlength`, `data-mask`, `inputmode` | strip format, respect maxlength, per-char typing for masks | H/M |
| Paste-blocked fields | — | setter + events bypass; respect "confirm email" intent | H |
| `autocomplete=off` / `new-password` | attribute | treat `new-password` as don't fill | H |
| Autofocus stealing / focus traps | `activeElement` ≠ target | don't rely on focus; re-focus before trusted typing chunks | M |
| Rich editors | `[contenteditable]` + class | `execCommand('insertText')`, synthetic beforeinput/paste; Pro CDP | H/M |
| Native date/time/file | `type` | ISO formats; files only via DataTransfer with user-provided File | H |
| Locale formats | `lang`, placeholder, `pattern` | infer, ask when ambiguous, `Intl` | M |
| Timezones | — | format in user zone, never via UTC `Date` | M |
| Multi-language / RTL | `lang`, `dir` | match via `autocomplete`/name/type/ARIA + model for labels; logical CSS in UI | M |

## G. Overlays, layout, interference
| Case | Fix | Conf |
|---|---|---|
| Cookie banners / consent walls | `elementFromPoint` occlusion check; ask user or click reject only with opt-in; DOM fill still works underneath | H |
| Sticky headers | `scrollIntoView({block:'center'})` then re-check | H |
| Modal stacks / `<dialog>` / `inert` | act only in topmost modal | H |
| Accessibility overlays (UserWay, accessiBe) | exclude their widget roots; prefer original attributes | M |
| Google Translate | detect `html.translated-ltr/rtl`, `<font>` wrappers; map fields by attributes; warn | H/M |
| Other extensions (Grammarly, LastPass, 1Password, Bitwarden) | skip password/credential fields; verify after delay; exclude `grammarly-extension`, `data-lastpass-icon-root`, `com-1password-*` | M |
| Dark patterns | never toggle consent/marketing/terms/insurance checkboxes without approval; diff before submit | M |
| Zoom / DPR / responsive | element-based actions; CDP mouse uses CSS px (don't multiply by DPR) | H/M |
| Chrome Android / iOS | desktop only | H |

## H. User and environment situations
| Case | Fix | Conf |
|---|---|---|
| SW killed (30 s idle / 5 min event) | checkpoint every step (IndexedDB), idempotent resumable steps, `chrome.alarms` timers | H |
| Extension update mid-task ("Extension context invalidated") | orphans self-destruct when `!chrome.runtime?.id`; defer `runtime.reload()` via `onUpdateAvailable`; re-inject on `onInstalled`, resume | H |
| Browser/tab crash | checkpoint in `storage.local`/IndexedDB; offer resume; never auto-submit | H |
| Slow network | adaptive timeouts, progress, cancel | H |
| Offline | deterministic fill works without model; Nano/Summarizer offline where available | M |
| Low-end laptop (4 GB) | `navigator.deviceMemory ≤ 4` → lighter caps, vanilla UI, no on-device models | M |
| Multiple tabs/windows | bind task to `{tabId, documentId, frameId}`; per-tab lock | H |
| Side panel per window | refresh on `tabs.onActivated`/`onUpdated` | H |
| Incognito | `isAllowedIncognitoAccess()`; spanning mode; don't persist incognito page content | H |
| Multiple profiles | document; sync only same account | H |
| Enterprise-managed Chrome | per-feature degradation; admin guide; Pro optional | H |
| `activeTab` lost after navigation | request per-site `optional_host_permissions` or re-invoke | H |
| User site-access "On click"/"specific sites" | `permissions.contains` + `permissions.request` from gesture | H |

## Must handle in v1 (prioritized)
1. Restricted-page guard with clear "can't read this page" state.
2. Inject on demand + retry once on "Receiving end does not exist".
3. Orphan/update safety; checkpoints; idempotent steps.
4. Framework-safe value setting + verify after ~1 s; per-type handling.
5. Honeypot and visibility filter; never touch `__VIEWSTATE`-style or trap fields.
6. Hard never-fill list: passwords, card/CVV in payment iframes, OTP, captcha, consent/terms/marketing checkboxes.
7. Frames + shadow DOM traversal; one form model keyed by `frameId`.
8. Settle detection + SPA/Turbo/HTMX/pjax/bfcache handling; no DOM mutation before hydration.
9. Extraction performance budget (100k-node page on 4 GB machine).
10. Trusted-Types-safe UI (side panel; closed shadow root, createElement, insertCSS/adoptedStyleSheets).
11. Bind tasks to `{tabId, documentId, frameId}`; prerender; SSO popups.
12. Verify-and-report loop, diff, no auto-submit.
13. Occlusion handling; topmost modal only.
14. Multi-page / postback flows persisted across navigations.
15. Graceful environment messaging (incognito, file access, policy, debugger, offline).

**Defer to v1.1 / Pro:** CDP trusted input; MAIN-world platform adapters (ServiceNow `g_form`, UI5, Marketo, Salesforce comboboxes); virtualized-grid stepping; Flutter/canvas; offline summarization.

**Test before relying on (M/L):** inline-style CSP exemption for isolated-world nodes; platform MAIN-world APIs; Flutter semantics; `execCommand` on modern editors.
