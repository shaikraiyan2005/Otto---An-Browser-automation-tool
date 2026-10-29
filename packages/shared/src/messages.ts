import type {
  Action,
  ElementContext,
  FieldDescriptor,
  FillResult,
  Mapping,
  PageText,
  ScanResult,
} from "./types";

/** Requests sent from the side panel to the engine in a frame (browser.tabs.sendMessage). */
export type EngineRequest =
  | { type: "otto:ping" }
  | { type: "otto:scan" }
  | { type: "otto:fill"; mappings: Mapping[] }
  | { type: "otto:highlight"; refs: string[]; status?: Record<string, string> }
  | { type: "otto:clear" }
  | { type: "otto:text" }
  | { type: "otto:pick:start" }
  | { type: "otto:pick:stop" }
  | { type: "otto:scope"; ref: string }
  | { type: "otto:actions"; actions: Action[]; values: Mapping[] };

export interface EngineResponses {
  "otto:ping": { version: string; frameId: number; url: string };
  "otto:scan": ScanResult;
  "otto:fill": { results: FillResult[] };
  "otto:highlight": { ok: true };
  "otto:clear": { ok: true };
  "otto:text": PageText;
  "otto:pick:start": { ok: true };
  "otto:pick:stop": { ok: true };
  "otto:scope": { fields: FieldDescriptor[]; clickables: { ref: string; line: string }[] };
  "otto:actions": { results: FillResult[] };
}

/** Events sent from the engine to the extension (browser.runtime.sendMessage). */
export type EngineEvent =
  | { type: "otto:picked"; context: ElementContext }
  | { type: "otto:pick:cancel" }
  | { type: "otto:progress"; result: FillResult };

export const ENGINE_VERSION = "0.1.0";
