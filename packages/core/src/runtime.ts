import { ENGINE_VERSION, type EngineEvent, type EngineRequest, type FieldDescriptor, type FillResult, type Mapping, type WidgetKind } from "@otto/shared";
import { scan } from "./extract";
import { fillAll, safeClick } from "./fill";
import { clearHighlight, highlight } from "./highlight";
import { startPicker, stopPicker } from "./picker";
import { prune } from "./registry";
import { fieldLine } from "./serialize";
import { scopeOf, visibleText } from "./scope";
import { extractText } from "./text";

type Chrome = {
  runtime: {
    id?: string;
    onMessage: { addListener(fn: (msg: EngineRequest, sender: unknown, reply: (r: unknown) => void) => boolean | void): void };
    sendMessage(msg: EngineEvent): Promise<unknown>;
  };
};

declare global {
  // eslint-disable-next-line no-var
  var __ottoEngine: string | undefined;
}

let lastFields: FieldDescriptor[] = [];

function widgetsOf(fields: FieldDescriptor[]): Record<string, WidgetKind> {
  return Object.fromEntries(fields.map((f) => [f.ref, f.widget]));
}

async function handle(msg: EngineRequest, emit: (e: EngineEvent) => void): Promise<unknown> {
  switch (msg.type) {
    case "otto:ping":
      return { version: ENGINE_VERSION, frameId: 0, url: location.href };
    case "otto:scan": {
      prune();
      const r = scan();
      lastFields = r.fields;
      return r;
    }
    case "otto:fill": {
      if (!lastFields.length) lastFields = scan().fields;
      const widgets = widgetsOf(lastFields);
      highlight(msg.mappings.filter((m) => m.enabled).map((m) => ({ ref: m.ref, tone: "pending" })));
      const status: Record<string, string> = {};
      const results = await fillAll(msg.mappings, widgets, (r) => {
        status[r.ref] = r.status;
        highlight(msg.mappings.filter((m) => m.enabled).map((m) => ({ ref: m.ref, tone: status[m.ref] ?? "pending" })));
        emit({ type: "otto:progress", result: r });
      });
      return { results };
    }
    case "otto:highlight":
      highlight(msg.refs.map((ref) => ({ ref, tone: msg.status?.[ref] ?? "focus" })));
      return { ok: true };
    case "otto:clear":
      clearHighlight();
      stopPicker();
      return { ok: true };
    case "otto:text": {
      const t = extractText();
      return { ...t, text: t.text || visibleText() };
    }
    case "otto:pick:start":
      startPicker(
        (context) => emit({ type: "otto:picked", context }),
        () => emit({ type: "otto:pick:cancel" }),
      );
      return { ok: true };
    case "otto:pick:stop":
      stopPicker();
      return { ok: true };
    case "otto:scope": {
      lastFields = scan().fields;
      const s = scopeOf(msg.ref, lastFields);
      return { fields: s.fields, clickables: s.clickables, fieldLines: s.fields.map(fieldLine) };
    }
    case "otto:actions": {
      if (!lastFields.length) lastFields = scan().fields;
      const widgets = widgetsOf(lastFields);
      const results: FillResult[] = [];
      const fills: Mapping[] = [];
      for (const a of msg.actions) {
        if (a.op === "click") results.push(safeClick(a.ref));
        else fills.push(msg.values.find((v) => v.ref === a.ref) ?? { ref: a.ref, source: "ai", value: a.value ?? "", confidence: 0.7, enabled: true });
      }
      results.push(...(await fillAll(fills, widgets)));
      return { results };
    }
  }
}

/** Boot the engine inside a frame. Safe to call more than once (re-injection). */
export function installEngine(chrome: Chrome) {
  if (globalThis.__ottoEngine) return;
  globalThis.__ottoEngine = ENGINE_VERSION;
  const emit = (e: EngineEvent) => {
    if (!chrome.runtime?.id) return teardown();
    chrome.runtime.sendMessage(e).catch(() => {});
  };
  const teardown = () => {
    clearHighlight();
    stopPicker();
  };
  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (!msg || typeof msg.type !== "string" || !msg.type.startsWith("otto:")) return;
    handle(msg, emit)
      .then(reply)
      .catch((err) => reply({ error: err instanceof Error ? err.message : String(err) }));
    return true;
  });
}
