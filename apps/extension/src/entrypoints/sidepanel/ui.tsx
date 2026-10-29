export function Mark({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <path fill="currentColor" fillRule="evenodd" d="M22 14a18 18 0 1 0 0 36a18 18 0 1 0 0-36Z M42 14a18 18 0 1 0 0 36a18 18 0 1 0 0-36Z" />
    </svg>
  );
}

export function Dot({ tone }: { tone: "ok" | "warn" | "bad" | "muted" }) {
  const c = { ok: "bg-ok", warn: "bg-warn", bad: "bg-bad", muted: "bg-muted" }[tone];
  return <span className={`inline-block size-1.5 shrink-0 rounded-full ${c}`} />;
}

export function Bar({ value }: { value: number }) {
  return (
    <span className="inline-block h-1 w-8 overflow-hidden rounded-full bg-surface-2">
      <span className="block h-full bg-fg" style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} />
    </span>
  );
}

export function Spinner() {
  return <span className="inline-block size-3 animate-spin rounded-full border border-muted border-t-fg" />;
}

export function Err({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 rounded-lg border border-line bg-surface p-2 font-mono text-[11px] text-bad">{children}</p>;
}

export const statusTone = (s?: string) => (s === "verified" ? "ok" : s === "failed" ? "bad" : s === "filled" ? "warn" : "muted") as "ok" | "bad" | "warn" | "muted";
