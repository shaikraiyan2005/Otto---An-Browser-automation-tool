# User-supplied research (pasted): Hybrid AI Browser Agent

Summary of the pasted research the user provided on 2026-10-29.

- Recommends a hybrid browser agent: deterministic control for ordinary actions, AI only for ambiguity or change. DOM/accessibility-tree-first perception, vision fallback, planner–actor–validator loop (cites arXiv 2511.19477).
- Market table: Playwright (deterministic, cross-browser, selectors break), Browser Use (NL agent loop, costlier), Stagehand (`act`/`observe`/`extract`, self-healing, deterministic replay), Skyvern (vision + simplified DOM, Playwright executes; slower), Playwright MCP / Chrome DevTools MCP (structured tools, a11y snapshots), Antigravity browser subagent (page/element screenshots, user review).
- Capabilities: page summary (structured: purpose, entities, actions, forms, tables, risks); form filling with field detection, profile schema mapping, confidence tiers (autofill / suggest / ask), confirmation before submit, per-domain cached mappings; schema-constrained extraction scoped to DOM subtree; record → semantic steps → replay with cached selectors → AI repair → save repaired mapping.
- Stack suggested: Playwright + CDP; Stagehand-style primitives; a11y tree + DOM; screenshot + vision / OmniParser for canvas; planner/actor/validator/memory; Chrome extension + side panel, optional desktop app; backend Node/Python + Postgres + Redis + vector DB (NOTE: user now wants client-side only, so backend parts are out of scope); small/mid/large model routing.
- Robustness layers: (1) structural a11y; (2) visual grounding with bbox→DOM mapping; (3) semantic element matching ranked by accessible name, text, role, position, nearby heading, historical mappings; (4) self-healing replay: recapture, semantic search, model only if ambiguous, validate, update mapping.
- Memory: user profile, site memory, workflow memory, episodic memory; retrieve only relevant slice.
- Context compression: pruned a11y tree, interactive elements with stable IDs, recent history, cropped screenshot only when needed.
- Antigravity-like selection: overlay markers, user clicks element, record semantic identity (role, accessible name, nearby text, DOM path, visual box); hover → select → classify → prompt → plan → confirm → execute → validate → save recipe.
- Risks: prompt injection (treat page text as untrusted; Chrome agent-security guidance https://developer.chrome.com/docs/agents/security), brittle selectors, dynamic UIs/modals, login/CAPTCHA (no bypass), privacy (encrypt, local redaction, per-field never-autofill, audit log), cost/latency, incorrect actions (confidence thresholds, diff preview, local validation, undo).
- MVP phases: copilot → smart form filling → resilient workflows → team/enterprise.
