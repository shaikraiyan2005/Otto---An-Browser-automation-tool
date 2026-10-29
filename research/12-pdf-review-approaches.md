# Review: "Browser Automation Tools: Approaches, Constraints & Recommendations" (PDF, Oct 2026)

Source: `research/inputs/browser-automation-approaches.pdf` (14 pages, read in full).

## 1. What the PDF says
- Recommends a **server-side hybrid platform**: deterministic login + cached scripts for the normal path, an LLM agent for the steps that vary, official APIs for flights/payments; a browser extension only as an optional later executor for attended tasks.
- Reference tasks: (a) log in → fill form → submit (low risk); (b) find and book the cheapest flight (high risk: anti-bot, payments).
- Six server approaches: scripted Playwright/Puppeteer; API/network replay; DOM/accessibility-tree LLM agent (numbered refs, step budgets); vision computer-use (last resort); **hybrid learn-once/replay/self-heal** (recommended, with versioned scripts, expected-state checks, human review before a repaired script becomes default); RPA.
- Client side: an extension is the only real option (same-origin policy). Agent loop and LLM keys on the backend. `chrome.debugger` gives trusted input but shows a banner. Pros: user's logged-in session, real IP, human present. Cons: install friction, service-worker suspension, attended only, attack surface, hard to debug.
- Other client options: companion app (CDP / native messaging), embedded-browser app, userscripts/bookmarklets (prototype only).
- Client and server can share one backend and one action vocabulary; only the executor differs.
- Unattended tasks need the server: OAuth → vault credentials → saved sessions → service accounts; TOTP automatable, SMS/push to a human; payments via approval or pre-authorized virtual cards.
- Central rule: **the LLM never sees a real secret** (placeholders like Stagehand `%password%`); mask secrets in logs.
- Platform must-haves: isolated browsers, secrets manager, approval gates, domain allowlist, allowed-action list, step/cost budgets, page content untrusted, ToS review, traces/screenshots, task schema, queue with idempotency keys, evaluation regression suite.
- Vendors: Browserbase (cloud CDP, Stagehand, Agents API), TinyFish ($15/mo for 1,650 steps, 81% benchmark), five vendor layers, build / build-faster / buy shortlist.
- Next steps: PoC on Stagehand+Browserbase and TinyFish; compare success, cost, MFA handling; legal ToS review.

## 2. Problems in the PDF
| Claim | Verdict | Evidence |
|---|---|---|
| Use Duffel / **Amadeus** for flights | Outdated: Amadeus Self-Service shut down July 17 2026 | phocuswire.com/amadeus-shut-down-self-service-apis-portal-developers |
| **Project Mariner** as a vendor | Outdated: shut down May 4 2026, folded into Gemini Agent | androidauthority.com/google-project-mariner-shutdown-3664323/ |
| MultiOn as a current platform | Unverified / stale (possible rename) | respan.ai/market-map/multion |
| TinyFish $15/mo, 1,650 steps | Correct per official pricing | tinyfish.ai/pricing |
| TinyFish "81% success" | Under-specified: 81.9% is the *hard tier* of Online-Mind2Web, self-reported; overall 89.9% | tinyfish.ai/blog/mind2web |
| Stagehand caching = learn/replay/self-heal | Partly: v4 cached `act()` replays with self-heal off and falls back to inference; no review/promote flow | docs.stagehand.dev/v4/best-practices/caching |
| Stagehand `%password%` placeholders | Correct but experimental (`experimental: true`) | stagehand PRs 1580, 1863 |
| Claude in Chrome `chrome.debugger` banner | Correct | claudeissues 69287 |
| Chrome 136+ remote-debugging restriction | Correct | chromium-dev thread |
| "Real browser + IP → far fewer anti-bot triggers" | Overstated: synthetic events are `isTrusted=false` | research/09 §C |
| Sourcing (Unite.AI, Bitdoze…) | Weak, secondary/marketing | — |
| Omissions | Nothing on the hard part of form filling (framework-safe values, widget adapters, labels without ARIA, shadow DOM, iframes), on-device AI, WebMCP, cross-browser, summarize, select-and-prompt; its DOM agent is one LLM call per step | — |

## 3. Architecture comparison
| Dimension | PDF (server hybrid) | otto | Better |
|---|---|---|---|
| Perception | Generic AX/DOM snapshot | DOM + layout + label cascade + geometry + widget detection, shadow DOM, frames | otto |
| Execution | Playwright trusted input | Synthetic events + adapters + verify (fails on `isTrusted` sites) | PDF for fidelity; otto for user's own session |
| AI cost | LLM per step while learning/repairing | Rules first, 1 batched call, 0 on replay | otto |
| Recipes/healing | Versioned scripts, expected-state checks, review before promote | Stronger matching (signatures + Similo), no versioning/review | Matching otto, governance PDF |
| Robustness | Strong on scripted sites, vision fallback | Strong on widget variety; weak vs `isTrusted`, canvas, anti-bot | Tie |
| Weight | Containers, queues, browsers per task | Zero idle cost, small engine | otto |
| Privacy | Secrets never to LLM, isolation, audit — but user data on servers | Data stays local by design; prototype currently sends profile values to Claude | Design otto; discipline PDF |
| Cross-browser | One server Chromium | WXT shells, capability registry | otto |
| Feasibility | Months + ops | One developer | otto |
| Unattended tasks | Yes | No (not required) | PDF |

**Verdict:** for otto (lightweight, client-side, any site, every browser, attended) our architecture is better overall. Adopt the PDF's operational discipline, not its architecture.

## 4. What to adopt
**Must**
1. Docs in sync with the real stack (npm + Prisma/Postgres).
2. LLM never sees profile values for mapping — send field descriptors + key names; values only for generated answers the user enables.
3. Guardrails on `/api/ask` actions: op enum, existing refs only, max actions per ask, no navigation, budget; strip hidden/low-contrast text before sending page text.
4. Recipe versioning and safe healing: version history, heal → candidate until verified, rollback; never auto-heal dangerous steps.

**Should**
5. Page-level expected-state checks per recipe step group.
6. Evaluation regression gate (e2e over the playground per model/prompt change; compare Opus/Sonnet/Haiku for `/api/map`).
7. Traces: per-field label source, widget, rung, reason, before/after; engine version in every run.
8. Resumable multi-page flows (run journal, no auto re-submit).
9. Open decision: thin stateless LLM relay alongside BYOK/on-device.

**Could**
10. Shared action vocabulary in `packages/shared`.
11. Idempotency key on run/recipe saves.
12. Per-site policy (allow/ask/block).
13. ZDR / enterprise data terms for production.

## 5. Do not adopt
Server-side Playwright containers / queues / hosted browsers; per-step LLM loop for form filling; vault-stored passwords, TOTP secrets, cookie sessions; vision computer-use as execution; `chrome.debugger` in the main build; companion over remote-debugging port; buying TinyFish/Browserbase/RPA; flight booking and payment automation; a separate human-review queue (fold into the preview).
