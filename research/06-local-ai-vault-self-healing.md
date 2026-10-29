# Local AI, encrypted vault, self-healing steps (as of 2026-10-29)

Confidence: H = primary source verified; M = secondary or partial primary; L = inference/unverified.

## Part 1 — On-device / local AI

### 1.1 Chrome built-in AI (Gemini Nano)
- **Prompt API (`LanguageModel`) for extensions: stable Chrome 138 (H).** Remove expired `"aiLanguageModelOriginTrial"` permission. Extensions keep `topK` + `temperature` (pass both or neither) and `LanguageModel.params()`.
- Prompt API on web: reportedly stable Chrome 148 with `samplingMode` (M, sources conflict) — not needed for extensions.
- Translator, Language Detector, Summarizer: stable 138, web + extensions (H). Writer/Rewriter/Proofreader: still trials (H) — don't depend.
- **Hardware (H):** Windows 10/11, macOS 13+, Linux, ChromeOS Chromebook Plus; not Android/iOS. ≥22 GB free disk on profile volume (deleted if <10 GB). GPU >4 GB VRAM, or CPU ≥16 GB RAM + ≥4 cores. Unmetered network for first download only. `create()` needs user activation while `downloadable`/`downloading`.
- Not available in Web Workers (H); SW support undocumented (L) → run from side panel or offscreen document.
- Prompt languages: en, ja, es, de, fr (H). Image input OK; audio needs GPU; output text only.
- Context window: no official number (forum: 4096, L) — read `session.contextWindow`.
- No published benchmark for field→key classification (L). Use closed `enum` schema, temperature 0, batches of 10–30 fields, clone a primed session per batch; heuristics first.

```js
const opts = { expectedInputs:[{type:'text'},{type:'image'}], expectedOutputs:[{type:'text', languages:['en']}] };
const a = await LanguageModel.availability(opts); // 'unavailable'|'downloadable'|'downloading'|'available'
const s = await LanguageModel.create({ ...opts, temperature:0, topK:1, // extensions only
  initialPrompts:[{role:'system', content:'Map form fields to profile keys. Output JSON only.'}],
  monitor(m){ m.addEventListener('downloadprogress', e=>console.log(e.loaded)); } });
const schema = { type:'object', properties:{ mappings:{ type:'array', items:{ type:'object',
  properties:{ fieldId:{type:'string'}, key:{enum:['givenName','familyName','email','tel','addressLine1','postalCode','none']},
  confidence:{type:'number'} }, required:['fieldId','key'] } } }, required:['mappings'] };
const out = JSON.parse(await s.prompt(promptText, { responseConstraint: schema, omitResponseConstraintInput:false, signal }));
s.contextUsage; s.contextWindow;            // token accounting
await s.measureContextUsage(...);           // cost of a prompt or schema
s.addEventListener('contextoverflow', ...); // old turns dropped; QuotaExceededError if still too big
const fork = await s.clone();  s.append([...]);  s.destroy();
```

### 1.2 WebLLM (MLC)
- Extension examples `chrome-extension`, `chrome-extension-webgpu-service-worker`; `ServiceWorkerMLCEngine` (H). JSON mode via `response_format` (H); json_schema unverified (M).
- `AppConfig.cacheBackend`: `"cache"` (default), `"indexeddb"`, `"opfs"`, `"cross-origin"` (H).
- VRAM (q4f16_1, ctx 4096, H): SmolLM2-360M 376 MB · Llama-3.2-1B 879 MB · Qwen2.5-0.5B 945 MB · Qwen3-0.6B 1403 MB · Qwen2.5-1.5B 1630 MB · SmolLM2-1.7B 1774 MB · gemma-2-2b 1895 MB · Qwen3-1.7B 2037 MB · Llama-3.2-3B 2264 MB · Qwen2.5-3B 2505 MB · Qwen3-4B 3432 MB · Phi-3.5-mini 3672 MB.
- Embeddings: `snowflake-arctic-embed-s` (~239 MB), `-m` (~539 MB), ctx 512 (H).

### 1.3 Transformers.js v3/v4
- `pipeline(task, model, { device:'webgpu', dtype:'q8'|'fp16'|'q4' })`; WebGPU ~85% of browsers (HF, Mar 2026) (H). Official `browser-extension` example in `huggingface/transformers.js-examples` (H).
- Cached in Cache API (`env.useBrowserCache`) (M).
- Small models (M): `Xenova/all-MiniLM-L6-v2` (~23 MB q8, 384-d), `Xenova/bge-small-en-v1.5` (~34 MB q8), `mixedbread-ai/mxbai-embed-xsmall-v1`, `Xenova/multilingual-e5-small`; small NLI for zero-shot.
- Load (L): embedder cold load <1–2 s cached; 1–2 GB LLM tens of seconds first download, seconds from cache.

### 1.4 Extension CSP and placement (H)
- Default `extension_pages` CSP disables WASM. Max allowed: `"script-src 'self' 'wasm-unsafe-eval'; object-src 'self';"`. `'unsafe-eval'` → install error.
- Bundle all JS/WASM/ORT locally; fetch only weights (data). Run models in offscreen document (`WORKERS`/`DOM_PARSER`) or side panel, not SW.

### 1.5 Ollama / LM Studio / native messaging
- Ollama `127.0.0.1:11434`, default origins only localhost (H). Run `OLLAMA_ORIGINS=chrome-extension://<your-id> ollama serve`. Extension needs `host_permissions: ["http://localhost:11434/*"]`. `/api/chat` with `format: <json schema>` (M) or OpenAI-compatible `/v1`.
- LM Studio OpenAI API on `:1234` with CORS toggle (M). Native messaging avoids CORS/ports, costs installer (M).
- Nanobrowser requires ≥16k ctx for local agent models (H).

### 1.6 Cloud BYOK
- Nanobrowser: "Your keys stay in the browser and go only to their own provider" (H); storage location unconfirmed (historically plaintext `chrome.storage.local`, L).
- Risks: `storage.local` readable by content scripts by default (H); XSS or malicious update can exfiltrate keys. Mitigate: encrypt keys with vault key; provider calls only from SW/offscreen, never content scripts. Anthropic browser calls need `anthropic-dangerous-direct-browser-access: true` header (M).
- Prior art for "descriptors + key names, never values": FillFast, FillDef (local dictionary first, send only unmatched labels), OttoFill "labels only" (M); arXiv 2509.01527 (privacy-preserving local-LLM form filling), arXiv 2408.02373 (DeepMind contextual integrity) (H).
- Prompt caching: static system prompt + key enum + schema first, per-page descriptors last (M).
- Redact descriptors: strip prefilled values, mask runs of ≥5 digits in ids/names (mirrors Chromium `StripDigitsIfRequired`).

## Part 2 — Encrypted local vault

### 2.1 Key derivation (H)
OWASP: PBKDF2-HMAC-SHA256 600,000; PBKDF2-HMAC-SHA512 220,000; Argon2id m=19 MiB t=2 p=1 minimum (or 46/1/1, 12/3/1, 9/4/1, 7/5/1); scrypt N=2^17 r=8 p=1. Argon2id needs WASM (`hash-wasm`/`argon2-browser`) → `'wasm-unsafe-eval'`.

```js
const salt = crypto.getRandomValues(new Uint8Array(16));
const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
const kek = await crypto.subtle.deriveKey({name:'PBKDF2', hash:'SHA-256', salt, iterations:600000},
  base, {name:'AES-GCM', length:256}, false, ['wrapKey','unwrapKey']);
// Random DEK wrapped by KEK. Records: AES-GCM, fresh 12-byte IV each, AAD = recordId|schemaVer.
```

### 2.2 Passkey PRF (M)
- Chrome support: GPM passkeys Chrome 132+; iCloud Keychain macOS 15.4+/iOS 18.4+; Windows Hello needs Win11 25H2 + Chrome 147+ (conflicting); hmac-secret security keys work.
- `chrome-extension://` is a WebAuthn-capable origin; since Chrome 122 extensions can claim RP IDs for domains in `host_permissions` (H). PRF from extension origin undocumented (L), but Bitwarden ships "Unlock with passkey" via PRF (2026.1+) (H). Test; keep password fallback.
- Pattern: `prf: { eval: { first: salt32 } }` → `getClientExtensionResults().prf.results.first` → HKDF → KEK wrapping same DEK. One wrapped-DEK per unlock method.

### 2.3 Bitwarden MV3 storage model (H, `local-backed-session-storage.service.ts`)
- Ephemeral 128-byte `"session-key"` in `chrome.storage.session`; session state encrypted with it and written to `chrome.storage.local` as `session_<key>`; in-memory read cache; if key missing (restart/reload) all `session_*` cleared; ports sync across contexts.
- `chrome.storage.session`: 10 MB, default `TRUSTED_CONTEXTS`, cleared on restart/reload/update/disable, no TTL → auto-lock via `chrome.alarms` + `chrome.idle.onStateChanged`.

### 2.4 Guardrails (M/L)
| Tier | Data | Unlock rule |
|---|---|---|
| T0 | public: name, city | once per session |
| T1 | contact: email, phone, address | once per session |
| T2 | gov ID, DOB | re-prompt (PIN/passkey UV) per fill |
| T3 | card, bank | re-prompt per fill; never to any LLM; only into `autocomplete="cc-*"` or after explicit confirmation |

- **Origin binding:** record `invokedOrigin` on user trigger; per target frame check `frame.origin === invokedOrigin` (`webNavigation.getAllFrames` / `sender.origin`); cross-origin iframes need opt-in; optional per-key origin allowlist.
- **Deterministic dangerous-step detectors** (require click to confirm): capture-phase `submit` listener + MAIN-world wrap of `HTMLFormElement.prototype.submit`/`requestSubmit`; any `input[type=password]`; `autocomplete` matching `/^(cc-|transaction-|one-time-code)/`; button text/aria-label `/\b(pay|place order|purchase|buy|submit|send|confirm|transfer|delete|sign)\b/i` (localized); cross-origin `formaction`/`action`.
- **Audit log:** append-only, encrypted, `{ts, origin, formSig, fieldSigs, keysFilled (names only), gatesTriggered, userConfirmed}`, hash-chained with `prevHash`.

## Part 3 — Self-healing and change detection

### 3.1 Similo family (H)
Similo (arXiv 2208.00677): score = Σ weight × sim over 14 properties; visible candidates only.

| Property | Comparison | Weight |
|---|---|---|
| Tag | equals | 1.5 |
| Class | normalized Levenshtein | 0.5 |
| Name | equals | 1.5 |
| Id | equals | 1.5 |
| HRef | Levenshtein | 0.5 |
| Alt | Levenshtein | 0.5 |
| Absolute XPath | Levenshtein | 0.5 |
| ID-relative XPath | Levenshtein | 0.5 |
| IsButton | equals | 0.5 |
| Location | Euclidean, 1 at 0 px → 0 at ≥100 px | 0.5 |
| Area | Euclidean | 0.5 |
| Shape (w/h) | Euclidean | 0.5 |
| VisibleText | Levenshtein | 1.5 |
| NeighborTexts | word-set overlap | 1.5 |

- VON Similo (arXiv 2301.03863): groups visually overlapping nodes (IoU > 0.85, center inside).
- **Similo++** (arXiv 2505.16424) weights: Name 2.85 Lev, VisibleText 2.80 Lev, Type 2.75 eq, Alt 1.85 eq, Attributes 1.80 intersect, NeighborText 1.45 set, Location 1.20 exp-decay, HRef 0.95 eq, Aria-Label 0.90 Jaccard, Tag 0.80 Jaccard, Id 0.50 Lev, ID-XPath 0.45 Lev, Dimension 0.35, AbsXPath 0.10 (Class, IsButton dropped). Top-1: Similo 88.9%, Similo++ 93.7%, HybridSimilo 94.7%; broken-locator subset up to 98.8%.

### 3.2 Healenium (H, `HealingService.java`)
`SelfHealingDriver` wraps WebDriver; stores reference selector + root-to-target node path; `PathFinder(LCSPathDistance, HeuristicNodeDistance)` → `findScoresToNodes` → `getSortedNodes(scores, 1000, scoreCap)` → `limit(recoveryTries)` → XPath then CSS. Config `heal-enabled`, `recovery-tries`, `score-cap` (e.g. 0.5). `HeuristicNodeDistance` weights not verified (L).

### 3.3 Commercial (M)
Testim: multi-attribute + parents, confidence-scored, updates after validated heal. mabl: 30–35+ attributes on target + parent; GenAI advanced heal favors purpose attributes and semantic text; **heal saved only if test passes**. Functionize: marketing (L).

### 3.4 Robula+ (H)
BFS from `//*`; transforms in order `transfConvertStar, transfAddId, transfAddText, transfAddAttribute, transfAddAttributeSet, transfAddPosition, transfAddLevel`; first unique XPath wins. Priority attrs `name, class, title, alt, value`; blacklist `href, src, onclick, onload, tabindex, width, height, style, size, maxlength`.

### 3.5 Playwright (H)
Priority: `getByRole` > `getByText` > `getByLabel` > `getByPlaceholder` > `getByAltText` > `getByTitle` > `getByTestId`; strict. `selectorGenerator.ts` scores (lower better): testId 1, other testId 2, iframe attr 10, role+name 100 (exact 105), placeholder 120, label 140, alt 160, text 180, title 200, text regex 250, `#id` 500, role no name 510, `input[type][name]` 520, tag 530, nth 10000, CSS fallback 1e7; length penalty `+min(10, len/10)` for 50–300; chain cost `Σ score_i × (n − i)`; retarget to interactive ancestor; `nth` if index ≤5 or `parent >> child` if parent narrows to ≤5; text only ≤80 chars.

### 3.6 Chromium signatures (H, `components/autofill/core/common/signatures.cc`)
```
FormSignature  = SHA1_first8bytes( scheme "://" host "&" StripDigits(formName) { "&" StripDigits(fieldName) }* )
FieldSignature = SHA1_first4bytes( fieldName "&" FormControlTypeToString(type) )
AlternativeFormSig = SHA1_8( scheme://host { "&" fieldType }* [+ path|#ref|?query if ≤2 fields] )
StripDigitsIfRequired: removes runs of ≥5 consecutive digits
```
Name-based sig = exact match; type-based alternative = "same shape, renamed fields".

### 3.7 Stuck / stagnation (H Browser Use, README-level Lumen)
- Browser Use: `max_failures=5`, `loop_detection_window=20`, `planning_replan_on_stall=3`; action hash sha256[:12] normalized; page fingerprint sha256(DOM text)[:16]; nudges at 5/8/12 repeats; stagnation nudge after ≥5 unchanged pages; soft (nudges only).
- Lumen: `RepeatDetector` 3 layers (exact repeat, category dominance, URL stall); `CheckpointManager` backtracks at level 8+; ModelVerifier completion gate.

## Recommended designs

### (a) AI routing ladder (stop at first confident answer)
1. **Deterministic:** `autocomplete` tokens, `type`, `inputmode`, localized name/id/label regex (Chromium-style), saved mapping by (FormSig, FieldSig). Accept ≥0.9.
2. **Local embeddings** (bge-small/MiniLM q8, WebGPU→WASM, offscreen): cosine of `label | placeholder | name | aria | nearby text` vs key-description embeddings. Accept top-1 ≥ ~0.75 and margin ≥0.1.
3. **Gemini Nano** if `available`: batched, enum `responseConstraint`, temp 0. Accept if agrees with embedding top-3 or confidence ≥0.7.
4. **Local server** (Ollama/LM Studio, probe `GET /api/tags` 300 ms): Qwen3 1.7B–4B with JSON-schema `format`.
5. **WebLLM** opt-in (≥1.5 GB VRAM): Qwen3-1.7B q4f16_1.
6. **Cloud BYOK** opt-in per site: descriptors + key names only, digits stripped, no values/body text; static prefix first.
- T2/T3 fields never past step 3, always confirm. Log `{tier, model, confidence}`. Cache accepted mappings by `(formSig, fieldSig)`.

### (b) Vault
- 256-bit random DEK, AES-GCM, fresh 96-bit IV, AAD `recordId|v`. KEK per unlock method: Argon2id (m=64 MiB, t=3, p=1) / PBKDF2-SHA256 ≥600k fallback; passkey PRF via HKDF(prf.first, "vault-kek-v1"); optional PIN (5 tries).
- Ciphertext + wrapped keys in `chrome.storage.local`/IndexedDB. Unlocked DEK as non-extractable CryptoKey in offscreen-document memory (or Bitwarden-style session key in `storage.session`, TRUSTED_CONTEXTS). Restart/reload = locked.
- Auto-lock: `chrome.alarms` idle (default 15 min), `chrome.idle.onStateChanged === 'locked'`, browser close.
- Content scripts never get DEK/vault — only per-fill values after: user invoked on tab; frame origin == `invokedOrigin`; tier allows; `sender.origin`/`sender.frameId` match.
- Dangerous-step gates + hash-chained encrypted audit log.

### (c) Step record schema and heal algorithm
```ts
type StepRecord = {
  id: string; v: 1;
  action: 'fill'|'select'|'check'|'click'|'submit'|'wait';
  valueRef?: string;            // vault key name, never the value
  origin: string; urlPattern: string;
  form: { sig: string; altSig: string; structSig: string; fieldSigs: string[] };
  target: {
    fieldSig?: string;
    locators: { kind:'testid'|'role'|'label'|'placeholder'|'css-id'|'robula-xpath'|'abs-xpath'; value:string; score:number }[];
    fp: { tag:string; type?:string; id?:string; name?:string; classes?:string[]; ariaLabel?:string; role?:string;
          autocomplete?:string; labelText?:string; placeholder?:string; visibleText?:string; href?:string; alt?:string;
          attrs?:Record<string,string>; neighborText:string[]; absXPath:string; idXPath:string;
          rect:{x:number;y:number;w:number;h:number}; ancestorPath:{tag:string;id?:string;cls?:string}[] };
    embedding?: Float32Array;
  };
  dangerous: boolean;
  stats: { ok:number; healed:number; lastHealAt?:number; lastOkAt?:number };
  history: { at:number; oldFp:object; newFp:object; method:string; score:number }[];
};
```
**Validate (cheap first):** FormSignature equal → stored locators + quick fingerprint check. altSig/structSig equal → fields renamed; only steps whose `fieldSig` vanished are suspect. No match → all steps suspect, heal individually.

**Heal per suspect step:**
1. Ranked locators (testid, role+name, label, placeholder, id, Robula xpath); accept unique hit with Similo++ ≥ θ_accept (~0.75 normalized).
2. Else score all visible interactable compatible candidates: Similo++ + `w·cos(embedding)` + `LCS(ancestorPath)/max(len)`.
3. Accept if `score ≥ θ_accept` and `score − second ≥ δ` (~0.1).
4. Ambiguous → routing ladder tiers 2–3 pick among top 3 (descriptors only), or ask user.
5. Never auto-heal a `dangerous` step.
6. Commit heal only after step + postcondition succeed (mabl rule); append `history`.
7. After 2 failed heals or score < θ_min → mark broken, agent mode for that step only.

**Stuck control:** 20-action hash window; page fingerprint sha256(visible text + form sig); nudge/replan at 3 failures; abort at 5 repeats or 5 stagnant pages; backoff 250 ms × 2^n (max 3) only for transient errors (detached node, navigation in progress); checkpoint last good step, restore on deep stall.

## Gaps to verify before building
Nano context window + field-classification quality (measure); PRF from `chrome-extension://` (test); Healenium `HeuristicNodeDistance` weights; Nanobrowser key storage; Lumen thresholds/cache key.

## Key sources
Prompt API https://developer.chrome.com/docs/ai/prompt-api · built-in APIs https://developer.chrome.com/docs/ai/built-in-apis · extension CSP https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy · WebLLM https://github.com/mlc-ai/web-llm · Transformers.js https://huggingface.co/docs/transformers.js/guides/webgpu · Ollama https://docs.ollama.com/faq · OWASP https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html · WebAuthn origins https://chromium.googlesource.com/chromium/src/+/main/content/browser/webauth/origins.md · Bitwarden https://github.com/bitwarden/clients · Similo++ arXiv 2505.16424 · Healenium https://github.com/healenium/healenium-web · Robula+ https://github.com/cyluxx/robula-plus · Playwright selectorGenerator https://github.com/microsoft/playwright/blob/main/packages/injected/src/selectorGenerator.ts · Browser Use https://github.com/browser-use/browser-use · Lumen https://github.com/omxyz/lumen · mabl https://help.mabl.com/docs/how-auto-heal-works
