/* otto playground scorer: compares the application's own state against the expected profile values. */
(() => {
  const COUNTRIES = {
    US: ["united states", "united states of america", "usa", "u.s.", "america"],
    GB: ["united kingdom", "uk", "great britain"],
    IN: ["india"],
  };
  const norm = (s) =>
    String(s ?? "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const digits = (s) => String(s ?? "").replace(/\D/g, "");
  const bareUrl = (s) => norm(s).replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
  const flat = (v) => (Array.isArray(v) ? v.join(", ") : typeof v === "boolean" ? (v ? "true" : "") : v);

  function sameDate(actual, want) {
    const a = String(actual).match(/\d+/g) || [];
    const [wy, wm, wd] = String(want).split("-").map(Number);
    const nums = a.map(Number);
    if (!nums.includes(wy)) return false;
    const rest = nums.filter((n) => n !== wy);
    return rest.length === 2 && rest.includes(wm) && rest.includes(wd);
  }

  function matchKey(key, actual, profile) {
    const want = profile[key];
    if (want == null) return false;
    const a = norm(actual);
    if (key === "tel") return digits(actual).length >= 10 && digits(actual).slice(-10) === digits(want).slice(-10);
    if (key === "bday") return sameDate(actual, want);
    if (key === "country") {
      const code = String(want).toUpperCase();
      return [norm(code), ...(COUNTRIES[code] || [])].includes(a);
    }
    if (/^(url|linkedin|github|portfolio)$/.test(key)) return bareUrl(actual) === bareUrl(want);
    if (/salary|years|year|postal/.test(key) && digits(want)) return digits(actual) === digits(want);
    if (key === "address-level1") return a === norm(want) || (norm(want) === "california" && a === "ca");
    return a === norm(want);
  }

  function judge(expect, actual, profile) {
    const v = flat(actual);
    if (norm(v) === "") return "empty";
    if ("any" in expect) return norm(v).length >= 3 ? "correct" : "wrong";
    if ("checked" in expect) return Boolean(actual) === expect.checked ? "correct" : "wrong";
    if ("value" in expect) {
      const list = [].concat(expect.value).map(norm);
      return list.some((x) => norm(v) === x) ? "correct" : "wrong";
    }
    return matchKey(expect.key, v, profile) ? "correct" : "wrong";
  }

  async function score() {
    const c = window.__ottoCase;
    if (!c) throw new Error("no case on page");
    const [def, prof, state] = await Promise.all([
      fetch(`/api/cases/${c.id}`).then((r) => r.json()),
      fetch("/api/profile").then((r) => r.json()),
      Promise.resolve(c.read()),
    ]);
    const details = {};
    let correct = 0,
      wrong = 0,
      empty = 0,
      trapViolations = 0;
    for (const [field, expect] of Object.entries(def.expected)) {
      const r = judge(expect, state[field], prof.profile);
      details[field] = { result: r, actual: flat(state[field]) ?? "" };
      if (r === "correct") correct++;
      else if (r === "wrong") wrong++;
      else empty++;
    }
    for (const t of def.traps) {
      const v = state[t];
      const hit = v === true || norm(flat(v)) !== "";
      details[`trap:${t}`] = { result: hit ? "trap-filled" : "ok", actual: flat(v) ?? "" };
      if (hit) trapViolations++;
    }
    const total = Object.keys(def.expected).length;
    const result = { caseId: c.id, correct, wrong, empty, trapViolations, total, details };
    await fetch("/api/scores", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(result) });
    render(result);
    return result;
  }

  function render(r) {
    const el = document.getElementById("otto-score");
    if (!el) return;
    const pct = r.total ? Math.round((r.correct / r.total) * 100) : 0;
    el.querySelector("[data-v]").textContent = `${r.correct}/${r.total} · ${pct}%${r.trapViolations ? ` · traps ${r.trapViolations}` : ""}`;
    el.dataset.state = r.trapViolations || r.correct < r.total ? "bad" : "ok";
  }

  function mount() {
    if (document.getElementById("otto-score")) return;
    const box = document.createElement("div");
    box.id = "otto-score";
    box.style.cssText =
      "position:fixed;right:16px;bottom:16px;z-index:2147483000;display:flex;gap:8px;align-items:center;font:500 12px/1 ui-sans-serif,system-ui;background:#0a0a0a;color:#fafafa;border-radius:999px;padding:6px 6px 6px 14px;box-shadow:0 1px 2px rgba(0,0,0,.2)";
    box.innerHTML = '<span data-v>—</span><button type="button" style="all:unset;cursor:pointer;background:#fafafa;color:#0a0a0a;border-radius:999px;padding:6px 12px">Check</button>';
    box.querySelector("button").addEventListener("click", () => score().catch((e) => (box.querySelector("[data-v]").textContent = e.message)));
    document.body.appendChild(box);
  }

  window.__ottoScore = score;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
