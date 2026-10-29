export type WidgetKind =
  | "native-text"
  | "native-select"
  | "native-date"
  | "checkbox"
  | "radio-group"
  | "range"
  | "combobox"
  | "react-select"
  | "mui-select"
  | "mui-autocomplete"
  | "mui-date"
  | "antd-select"
  | "antd-date"
  | "radix-select"
  | "headless"
  | "select2"
  | "chosen"
  | "flatpickr"
  | "masked"
  | "rich-text"
  | "file";

export type FieldKind =
  | "text"
  | "longtext"
  | "email"
  | "tel"
  | "url"
  | "number"
  | "date"
  | "choice"
  | "boolean"
  | "file"
  | "range";

export type LabelSource =
  | "label"
  | "aria"
  | "title"
  | "sibling"
  | "table"
  | "ancestor"
  | "geometry"
  | "placeholder"
  | "attribute"
  | "none";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Fingerprint {
  tag: string;
  type: string;
  id: string;
  name: string;
  classes: string[];
  ariaLabel: string;
  role: string;
  autocomplete: string;
  label: string;
  placeholder: string;
  neighborText: string[];
  section: string;
  xpath: string;
  rect: Rect;
}

export interface FieldDescriptor {
  ref: string;
  frameId: number;
  kind: FieldKind;
  widget: WidgetKind;
  label: string;
  labelSource: LabelSource;
  placeholder?: string;
  name?: string;
  idAttr?: string;
  autocomplete?: string;
  inputType?: string;
  required: boolean;
  maxLength?: number;
  pattern?: string;
  dateFormat?: string;
  options?: string[];
  optionCount?: number;
  section?: string;
  currentValue?: string;
  rect: Rect;
  /** hidden trap field: must never be filled */
  trap?: string;
  /** sensitive field otto never fills (password, card, otp, captcha, consent) */
  blocked?: string;
  fieldSig: string;
  fp: Fingerprint;
}

export interface ScanResult {
  frameId: number;
  url: string;
  title: string;
  caseId?: string;
  fields: FieldDescriptor[];
  elements: number;
  truncated: boolean;
  ms: number;
}

export interface FileValue {
  name: string;
  type: string;
  base64: string;
}

export type MappingSource = "recipe" | "rule" | "ai" | "generated" | "user" | "skip";

export interface Mapping {
  ref: string;
  source: MappingSource;
  key?: string | null;
  value: string;
  file?: FileValue;
  confidence: number;
  reason?: string;
  enabled: boolean;
}

export type FillStatus = "verified" | "filled" | "failed" | "skipped" | "covered";

export interface FillResult {
  ref: string;
  status: FillStatus;
  rung: number;
  ms: number;
  readBack?: string;
  error?: string;
}

export interface RecipeStep {
  key?: string | null;
  value?: string;
  source: MappingSource;
  widget: WidgetKind;
  kind: FieldKind;
  fieldSig: string;
  label: string;
  fp: Fingerprint;
}

export interface RecipeStats {
  runs: number;
  healed: number;
  lastRunAt: number;
}

export interface Recipe {
  id: string;
  origin: string;
  path: string;
  formSig: string;
  title: string;
  steps: RecipeStep[];
  stats: RecipeStats;
  createdAt?: string;
  updatedAt?: string;
}

export type StepResolution =
  | { stepIndex: number; status: "ok"; ref: string; score: number }
  | { stepIndex: number; status: "healed"; ref: string; score: number }
  | { stepIndex: number; status: "broken"; score: number };

export type RunKind = "fill" | "replay" | "summarize" | "ask";

export interface RunTimings {
  scan: number;
  match: number;
  ai: number;
  fill: number;
  total: number;
}

export interface RunReport {
  kind: RunKind;
  url: string;
  origin: string;
  caseId?: string | null;
  model?: string | null;
  fieldsFound: number;
  filled: number;
  verified: number;
  failed: number;
  skipped: number;
  llmCalls: number;
  tokensIn: number;
  tokensOut: number;
  cacheRead: number;
  recipeId?: string | null;
  healed: number;
  timings: RunTimings;
  details: unknown;
}

export interface Settings {
  model: string;
  effortMap: "low" | "medium" | "high";
  effortSummarize: "low" | "medium" | "high";
  effortAsk: "low" | "medium" | "high";
  autoSaveRecipes: boolean;
  confidenceAutofill: number;
  allowGenerate: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  model: "claude-opus-5-5",
  effortMap: "low",
  effortSummarize: "medium",
  effortAsk: "medium",
  autoSaveRecipes: true,
  confidenceAutofill: 0.6,
  allowGenerate: true,
};

export interface ElementContext {
  ref: string;
  frameId: number;
  tag: string;
  text: string;
  html: string;
  path: string;
  headings: string[];
  rect: Rect;
}

export interface Action {
  op: "fill" | "select" | "check" | "click";
  ref: string;
  value?: string | null;
  why: string;
}

export interface PageText {
  url: string;
  title: string;
  text: string;
  headings: string[];
  forms: number;
  tables: number;
  links: number;
}

export interface Usage {
  model: string;
  tokensIn: number;
  tokensOut: number;
  cacheRead: number;
  ms: number;
}
