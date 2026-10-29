SUMMARY: The verified evidence points to one main design for a fast, low-cost AI browser automation and form-fill product. Run an LLM the first time to understand a page or form. Save the result as a cached action or as generated deterministic code, with form fields as variables. Replay later runs with no LLM calls, and fall back to the AI agent only when a selector breaks or the page changes. Stagehand (server-side cache on Browserbase), Skyvern (code generation with AI fallback on by default) and Browser Use's workflow-use (record once, replay with variables, agent fallback) all ship this pattern. For page understanding, a practitioner preprint recommends compact accessibility-tree snapshots as the main context, with vision only as a supplement. The same source reports that batching independent field fills cut tool calls and latency sharply on a 28-field form. On robustness and safety: agents break badly under network faults and malicious popups, and prompt injection has no reliable LLM-side fix. Safety therefore has to be enforced in execution-layer code: confirmations, domain allowlists, least privilege and snapshot filtering. For the reference tools: Google Antigravity drives Chrome through the CDP-based Chrome DevTools MCP server, with on-demand screenshots and WebM session recordings. Visual 'select a component, then prompt' editors (Lovable Visual Edits, v0 Design Mode, Onlook, React Grab) combine live-app element selection with either source maps (React component stack plus file:line) or model-based mapping from a selector or screenshot to code.

- [high] Cache AI-resolved actions so repeat runs skip the LLM. Stagehand v4 caches act(), observe() and extract() server-side. A cache hit returns the result with no LLM inference and no token cost. The cache key is the instruction, page content (including URL) and call options. Model configuration is deliberately left out, so switching models keeps the cache valid. A cached act() replays deterministically with self-healing turned off. If the recorded selector no longer resolves, or the page content or structure changed, Stagehand runs full LLM inference.
  src: https://docs.stagehand.dev/v4/best-practices/caching
  ev: Vendor v4 docs, verified word for word: 'On a cache hit, the server returns the response directly with no LLM inference and no token cost.' Limits: it needs a Browserbase browser and API key, and has no effect with a local browser. Calls that pass locator or ignoreLocators are not cached. Small runtime differences change the accessibility tree and therefore the cache key. Caching is best-effort and falls back to inference.

- [high] Compile successful agent runs into deterministic code, with AI fallback. Skyvern can generate code from the actions a successful agent run took. Later runs execute that code with no model call per step. If the code fails, for example because the page changed, Skyvern falls back to the agent and regenerates the code. The AI fallback is on by default.
  src: https://skyvern.com/docs/developers/features/code-caching
  ev: Skyvern developer docs: 'Later runs can execute that code directly instead of asking the model at each step'; 'if the cached code fails ... Skyvern falls back to the agent and regenerates the code.' The feature is opt-in (run_with=code). The first run still needs the model. The 'on by default' setting is shown as a Studio toggle, and the SDK or API default was not confirmed.

- [medium] Record once, then replay parameterized form fills (the most direct fit for 'auto-fill from stored user info'). Browser Use's workflow-use records browser interactions once. It automatically extracts form fields as variables and replays the workflow deterministically with different user data. When a step fails, it falls back to the Browser Use agent. In Generation Mode, a natural-language task runs once through the agent and is stored as a parameterized workflow. Reruns make no LLM calls while every step succeeds.
  src: https://github.com/browser-use/workflow-use
  ev: README: 'deterministic workflows with variables which fallback to Browser Use', 'automatically extract variables from forms', 'No LLM calls'. Confidence is reduced because the README itself says 'very early development ... don't recommend using this in production'. Writing self-healing fixes back into the workflow file is an unshipped roadmap item. The roadmap also calls the LLM fallback 'currently really bad'.

- [medium] Page representation: use compact accessibility-tree snapshots as the main LLM context and vision as a supplement. Use vision as the fallback for canvas apps such as Sheets and Figma and for visually dense tasks. The author argues that architecture matters more than model capability. Vision-only agents misidentify small targets such as calendar cells. Accessibility-tree approaches depend on WCAG-compliant markup.
  src: https://arxiv.org/html/2511.19477
  ev: Single-author, non-peer-reviewed preprint by the founder of FillApp (Nov 2025). The approach matches common practice in Playwright MCP snapshots and Browser Use. Its 85% WebGames figure is internal and unverified.

- [low] Batch independent form-field fills into 'bulk actions' to cut latency and cost. On one 28-field form with GPT-5.1, bulk actions used 74% fewer tool calls (10 vs 38), ran 57% faster (104.5s vs 245.1s) and used 41% fewer tokens (154K vs 260K).
  src: https://arxiv.org/html/2511.19477
  ev: Author's internal production figures: one form, one model, no stated number of runs. The arithmetic checks out and the direction is plausible, since fewer LLM round-trips means less time and fewer tokens. Treat this as an anecdote, not a benchmark.

- [high] Security: prompt injection is the central risk, and LLM-based defenses are not reliable. Enforce safety in execution-layer code, not in the model. Examples: confirm sensitive actions (refund, delete, transfer, password), allowlist domains, give each specialized agent least privilege, and filter sensitive containers such as inboxes out of snapshots before they reach the LLM. Agents are also very easy to hijack. On the REAL benchmark (112 tasks), agents clicked an injected 'claim FREE bitcoin' popup at 97.3% (GPT-4o), 86.6% (Qwen2.5-VL) and 98.2% (GPT-OSS).
  src: https://arxiv.org/html/2511.19477, https://arxiv.org/html/2510.03285v1
  ev: The FillApp preprint gives the design guidance. A verifier cross-checked it against OpenAI's Atlas hardening post (Dec 2025: prompt injection is 'unlikely to ever be fully solved'), Brave and the UK NCSC. The popup figures come from WAREX Table 1 (Microsoft Research preprint, Sep 2025). That was a harness-injected stress test on generic agent scaffolds, not hardened commercial agents.

- [medium] Reliability: transient network or server faults sharply reduce web-agent success, and agents tend to give up instead of retrying. With faults injected through a mitmproxy-based proxy (WAREX), GPT-4o fell from 0.124 to 0.037 under network errors (-70%) and to 0.053 under server errors (-57%) on WebArena. On WebVoyager it fell from 0.420 to 0.02 under network errors (-95%). Agents often declared tasks infeasible right away. Simple 'refresh/retry' prompting recovered much of the loss: WebVoyager back to 0.410, WebArena back to 0.071 and 0.090.
  src: https://arxiv.org/html/2510.03285v1
  ev: Single preprint with 3 agent harnesses, mostly GPT-4o, and a low WebArena baseline that makes relative drops look larger. It implies the product needs code-level retry, reload and wait logic rather than leaving recovery to the LLM.

- [high] Google Antigravity's browser subagent controls Chrome through the Chrome DevTools MCP server, which is built on CDP and Puppeteer. Antigravity starts the server automatically with no setup. The first connection asks the user to allow remote debugging in Chrome. Screenshots are taken on request. Every browser session is recorded as a WebM video, generated asynchronously, and saved to the conversation's artifacts.
  src: https://antigravity.google/docs/commands/browser/
  ev: Official current Antigravity docs, verified word for word. 'CDP-based' is not stated on the page but follows from what Chrome DevTools MCP is. A related claim was refuted 1-2: that the agent reads the UI from an accessibility snapshot and also uses console, network, traces, Lighthouse and heap snapshots. Do not rely on that detail without re-checking.

- [high] Select-a-component-then-prompt editors work in two ways. (a) Source-mapped: React Grab copies the hovered element (on Cmd/Ctrl+C) with its markup, React component stack and source file:line:column, for example LoginForm at components/login-form.tsx:46:19. That deterministically maps a DOM element to code, but only in dev builds. (b) Model-mapped: v0 Design Mode uses a model to turn rendered-element descriptions and requested changes into source edits. Selectors (designMode.element) and optional screenshots (designMode.screenshot) are hints to the model, not checked preconditions. Lovable Visual Edits lets users click 'Visual edits', select a component in the live preview, and change style or content directly with no AI chat. Onlook's canvas shows live frames of the app served by the local dev server, not a static copy.
  src: https://cdn.jsdelivr.net/gh/aidenybai/react-grab@main/README.md, https://v0.app/docs/api/v2/guides/design-mode, https://lovable.dev/blog/introducing-visual-edits, https://docs.onlook.com/developers/architecture
  ev: All are vendor or project primary docs. Lovable's no-AI direct editing (2-1 vote) covers only style and content, not logic. React Grab uses hover plus a shortcut and copies to the clipboard; it does not prompt in place. A v0 claim was refuted 1-2: that its preview uses a layer-ID browser bridge with selectNode and hoverNode. acebuilder.ai itself was not verified by any surviving claim.

caveats: "Coverage is uneven. No surviving claims cover these parts of the research question: the consumer agent products (OpenAI Operator/Atlas, Perplexity Comet, Claude in Chrome, Gemini in Chrome, MultiOn, Magical, autofill extensions); Chrome MV3 extension architecture; shadow DOM and iframe handling; responsive or multi-screen layouts; user-profile memory design; small-vs-large model routing; and acebuilder.ai. Those parts are unanswered here and need follow-up. Several sources are weak. The architecture, bulk-action and security-design guidance rests on one non-peer-reviewed vendor-founder preprint (arXiv 2511.19477). The reliability and popup figures rest on one preprint (WAREX) that tested GPT-4o-era models in generic harnesses, and newer agents may do better. workflow-use is explicitly pre-production. The caching claims come from vendor docs and have not been benchmarked independently. Stagehand caching works only on Browserbase, not with local Playwright or CDP. Everything here is time-sensitive (docs fetched Oct 2026, papers from late 2025), and these products change monthly. Two claims were refuted and excluded: the Antigravity accessibility-snapshot and devtools feature list, and the v0 layer-ID browser bridge."

openQuestions: [
  "How do shipping consumer agents (Claude in Chrome, Gemini in Chrome, Comet, Atlas) handle page reading: accessibility tree, DOM distillation or screenshots? What latency and cost does each get per page summary or form fill?",
  "What is a robust self-healing locator strategy across shadow DOM, cross-origin iframes, canvas UIs and responsive or mobile layouts, beyond falling back to the LLM when a selector breaks?",
  "How should stored user-profile memory (PII) be mapped to arbitrary form fields securely and accurately, with local vs cloud storage, encryption, consent and field-semantic matching, without exposing the data to prompt injection?",
  "Can the 'record once, replay with variables' pattern be done fully client-side in a Chrome MV3 extension without Browserbase, and how do cache-key stability and page-change detection hold up on dynamic SPAs?"
]

refuted: [
  {
    "claim": "The agent reads the UI from an accessibility snapshot, not raw DOM. It can also fetch console messages and network requests, evaluate JS, run performance traces and Lighthouse audits, and take heap snapshots.",
    "vote": "1-2",
    "source": "https://antigravity.google/docs/commands/browser/"
  },
  {
    "claim": "Element selection in the preview uses a browser bridge that works on layer IDs from the current tree, not CSS selectors. The bridge exposes selectNode, hoverNode and clearHoveredNode.",
    "vote": "1-2",
    "source": "https://v0.app/docs/api/v2/guides/design-mode"
  }
]

unverified: 

sources: [
  {
    "url": "https://www.joinmassive.com/blog/browser-use-vs-stagehand-vs-skyvern-choosing-an-agent-browser-framework",
    "quality": "blog",
    "angle": "State of the art: AI browser agents and form-filling products",
    "claimCount": 5
  },
  {
    "url": "https://www.tinyfish.ai/blog/ai-browser-agents",
    "quality": "blog",
    "angle": "State of the art: AI browser agents and form-filling products",
    "claimCount": 5
  },
  {
    "url": "https://alexcloudstar.com/blog/ai-browser-agent-stagehand-browser-use-playwright/",
    "quality": "blog",
    "angle": "State of the art: AI browser agents and form-filling products",
    "claimCount": 5
  },
  {
    "url": "https://composio.dev/blog/chatgpt-atlas-vs-chrome-extension",
    "quality": "blog",
    "angle": "State of the art: AI browser agents and form-filling products",
    "claimCount": 5
  },
  {
    "url": "https://www.skyvern.com/blog/browser-use-alternatives/",
    "quality": "blog",
    "angle": "State of the art: AI browser agents and form-filling products",
    "claimCount": 5
  },
  {
    "url": "https://tech-insider.org/ca/chatgpt-atlas-vs-perplexity-comet-vs-gemini-chrome-2026/",
    "quality": "blog",
    "angle": "State of the art: AI browser agents and form-filling products",
    "claimCount": 5
  },
  {
    "url": "https://arxiv.org/html/2511.19477",
    "quality": "secondary",
    "angle": "Architecture: DOM distillation, accessibility tree, vision, CDP",
    "claimCount": 5
  },
  {
    "url": "https://www.mintlify.com/browserbase/stagehand/concepts/how-stagehand-works",
    "quality": "unreliable",
    "angle": "Architecture: DOM distillation, accessibility tree, vision, CDP",
    "claimCount": 0
  },
  {
    "url": "https://browserbase.com/blog/stagehand-v4",
    "quality": "blog",
    "angle": "Architecture: DOM distillation, accessibility tree, vision, CDP",
    "claimCount": 5
  },
  {
    "url": "https://www.vibebrowser.app/blog/serializing-accessibility-trees-for-browser-agents",
    "quality": "blog",
    "angle": "Architecture: DOM distillation, accessibility tree, vision, CDP",
    "claimCount": 5
  },
  {
    "url": "https://dev.to/alexey_sokolov_10deecd763/runtime-snapshots-16-the-three-architectures-of-browser-agents-4gkc",
    "quality": "blog",
    "angle": "Architecture: DOM distillation, accessibility tree, vision, CDP",
    "claimCount": 5
  },
  {
    "url": "https://prophetchrome.com/blog/accessibility-tree-vs-screenshots-browser-ai",
    "quality": "blog",
    "angle": "Architecture: DOM distillation, accessibility tree, vision, CDP",
    "claimCount": 5
  },
  {
    "url": "https://browserbase.com/blog/stagehand-caching",
    "quality": "blog",
    "angle": "Efficiency: memory, caching, cost and latency",
    "claimCount": 5
  },
  {
    "url": "https://docs.stagehand.dev/v4/best-practices/caching",
    "quality": "primary",
    "angle": "Efficiency: memory, caching, cost and latency",
    "claimCount": 5
  },
  {
    "url": "https://skyvern.com/docs/developers/features/code-caching",
    "quality": "primary",
    "angle": "Efficiency: memory, caching, cost and latency",
    "claimCount": 5
  },
  {
    "url": "https://github.com/browser-use/workflow-use",
    "quality": "primary",
    "angle": "Efficiency: memory, caching, cost and latency",
    "claimCount": 5
  },
  {
    "url": "https://arxiv.org/html/2510.03285v1",
    "quality": "primary",
    "angle": "Robustness and limitations: dynamic UIs and failure modes",
    "claimCount": 5
  },
  {
    "url": "https://www.theregister.com/2025/10/28/ai_browsers_prompt_injection",
    "quality": "secondary",
    "angle": "Robustness and limitations: dynamic UIs and failure modes",
    "claimCount": 5
  },
  {
    "url": "https://www.esecurityplanet.com/de/artificial-intelligence/perplexity-comet-browser-bug-leaks-local-files-via-ai-prompt-injection/",
    "quality": "unreliable",
    "angle": "Robustness and limitations: dynamic UIs and failure modes",
    "claimCount": 0
  },
  {
    "url": "https://antigravity.google/docs/commands/browser/",
    "quality": "primary",
    "angle": "Antigravity browser agent and click-to-select-component coding tools",
    "claimCount": 5
  },
  {
    "url": "https://lovable.dev/blog/introducing-visual-edits",
    "quality": "primary",
    "angle": "Antigravity browser agent and click-to-select-component coding tools",
    "claimCount": 4
  },
  {
    "url": "https://v0.app/docs/api/v2/guides/design-mode",
    "quality": "primary",
    "angle": "Antigravity browser agent and click-to-select-component coding tools",
    "claimCount": 5
  },
  {
    "url": "https://docs.onlook.com/developers/architecture",
    "quality": "primary",
    "angle": "Antigravity browser agent and click-to-select-component coding tools",
    "claimCount": 5
  },
  {
    "url": "https://cdn.jsdelivr.net/gh/aidenybai/react-grab@main/README.md",
    "quality": "primary",
    "angle": "Antigravity browser agent and click-to-select-component coding tools",
    "claimCount": 5
  }
]

stats: {
  "angles": 5,
  "sourcesFetched": 24,
  "claimsExtracted": 109,
  "claimsVerified": 25,
  "confirmed": 23,
  "killed": 2,
  "unverified": 0,
  "afterSynthesis": 9,
  "urlDupes": 0,
  "budgetDropped": 6,
  "agentCalls": 106
}


