import path from "node:path";
import { type BrowserContext, chromium, expect, type Page, test } from "@playwright/test";

const BASE = process.env.OTTO_URL ?? "http://localhost:3000";
const EXT = path.resolve(__dirname, "../apps/extension/.output/chrome-mv3");

interface Score {
  caseId: string;
  correct: number;
  total: number;
  trapViolations: number;
  details: Record<string, { result: string; actual: string }>;
}

let ctx: BrowserContext;
let extId: string;

test.beforeAll(async () => {
  ctx = await chromium.launchPersistentContext("", {
    headless: process.env.HEADED ? false : true,
    channel: "chromium",
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
    viewport: { width: 1280, height: 900 },
  });
  let [sw] = ctx.serviceWorkers();
  sw ??= await ctx.waitForEvent("serviceworker");
  extId = new URL(sw.url()).host;
});

test.afterAll(async () => ctx?.close());

async function panelFor(target: string): Promise<Page> {
  const panel = await ctx.newPage();
  await panel.goto(`chrome-extension://${extId}/sidepanel.html?target=${encodeURIComponent(target)}`);
  await panel.waitForFunction(() => Boolean((window as unknown as { __ottoTest?: unknown }).__ottoTest), null, { timeout: 15000 });
  return panel;
}

async function fillOnce(panel: Page) {
  return panel.evaluate(() => (window as unknown as { __ottoTest: { fillAll: () => Promise<unknown> } }).__ottoTest.fillAll());
}

async function runCase(href: string, opts: { steps?: number; next?: string; waitMs?: number } = {}) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}${href}`, { waitUntil: "networkidle" });
  await page.bringToFront();
  if (opts.waitMs) await page.waitForTimeout(opts.waitMs);
  const target = href.split("?")[0] + (href.includes("?") ? `?${href.split("?")[1]}` : "");
  const panel = await panelFor(target);
  const reports: unknown[] = [];
  for (let s = 0; s < (opts.steps ?? 1); s++) {
    reports.push(await fillOnce(panel));
    if (opts.next && s < (opts.steps ?? 1) - 1) {
      await page.click(opts.next);
      await page.waitForTimeout(400);
    }
  }
  await page.waitForTimeout(600);
  const score = (await page.evaluate(() => (window as unknown as { __ottoScore: () => Promise<unknown> }).__ottoScore())) as Score;
  await panel.close();
  await page.close();
  return { score, reports };
}

const CASES: [string, Parameters<typeof runCase>[1]?][] = [
  ["/playground/plain.html"],
  ["/playground/no-labels.html"],
  ["/playground/table-layout.html"],
  ["/playground/honeypot.html"],
  ["/playground/react-controlled"],
  ["/playground/react-select"],
  ["/playground/mui"],
  ["/playground/antd"],
  ["/playground/radix-headless"],
  ["/playground/masked"],
  ["/playground/rich-text"],
  ["/playground/files"],
  ["/playground/vue.html"],
  ["/playground/jquery-select2.html"],
  ["/playground/shadow-dom.html"],
  ["/playground/iframes.html", { waitMs: 800 }],
  ["/playground/wizard", { steps: 3, next: "[data-testid=next]" }],
  ["/playground/dynamic", { waitMs: 1800 }],
  ["/playground/big-dom.html"],
  ["/playground/job-application"],
  ["/playground/job-application?layout=v2"],
];

test("playground", async () => {
  const rows: string[] = [];
  let correct = 0;
  let total = 0;
  let traps = 0;
  for (const [href, opts] of CASES) {
    const { score, reports } = await runCase(href, opts);
    correct += score.correct;
    total += score.total;
    traps += score.trapViolations;
    const r = (reports.at(-1) as { report?: { llmCalls: number; healed: number; timings: { scan: number; total: number } } })?.report;
    const misses = Object.entries(score.details)
      .filter(([, d]) => d.result !== "correct" && d.result !== "ok")
      .map(([k, d]) => `${k}=${d.result}:${String(d.actual).slice(0, 30)}`)
      .join(", ");
    rows.push(
      `${score.caseId.padEnd(22)} ${String(score.correct).padStart(2)}/${String(score.total).padEnd(2)} traps ${score.trapViolations}  ai ${r?.llmCalls ?? "-"}  healed ${r?.healed ?? "-"}  scan ${Math.round(r?.timings.scan ?? 0)}ms  total ${Math.round(r?.timings.total ?? 0)}ms  ${misses}`,
    );
  }
  console.log(`\n${rows.join("\n")}\n\nTOTAL ${correct}/${total} = ${((correct / total) * 100).toFixed(1)}%  trap violations ${traps}\n`);
  expect(traps).toBe(0);
});
