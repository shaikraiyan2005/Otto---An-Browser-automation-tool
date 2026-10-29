// Debug helper: node --experimental-strip-types e2e/debug.ts /playground/antd
import path from "node:path";
import { chromium } from "@playwright/test";

const href = process.argv[2] ?? "/playground/antd";
const EXT = path.resolve(import.meta.dirname, "../apps/extension/.output/chrome-mv3");
const ctx = await chromium.launchPersistentContext("", {
  headless: true,
  channel: "chromium",
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
let [sw] = ctx.serviceWorkers();
sw ??= await ctx.waitForEvent("serviceworker");
const id = new URL(sw.url()).host;
const page = await ctx.newPage();
await page.goto(`http://localhost:3000${href}`, { waitUntil: "networkidle" });
const panel = await ctx.newPage();
await panel.goto(`chrome-extension://${id}/sidepanel.html?target=${encodeURIComponent(href)}`);
await panel.waitForFunction(() => Boolean((window as any).__ottoTest));
const out = await panel.evaluate(async (target) => {
  const tabs = await (globalThis as any).chrome.tabs.query({});
  const tab = tabs.find((t: any) => t.url.includes(target));
  await (globalThis as any).chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ["/engine.js"] });
  return (globalThis as any).chrome.tabs.sendMessage(tab.id, { type: "otto:scan" }, { frameId: 0 });
}, href);
for (const f of out.fields) console.log(f.ref, f.widget, f.kind, JSON.stringify(f.label), f.blocked ?? "", f.trap ?? "", f.fp.type, f.autocomplete ?? "");
const r = await panel.evaluate(() => (window as any).__ottoTest.fillAll());
for (const f of r.report.details.fields) console.log(f.label, "|", f.source, "|", f.value, "|", f.status, "|", f.error ?? "", "|", f.readBack ?? "");
await ctx.close();
