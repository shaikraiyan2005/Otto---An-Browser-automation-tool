import { Nav } from "./Nav";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Nav />
      <main className="min-w-0 flex-1 px-10 py-8">{children}</main>
    </div>
  );
}

export function PageTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-6 flex h-8 items-center justify-between">
      <h1 className="text-xl font-semibold tracking-[-0.02em]">{children}</h1>
      {right}
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-2 font-mono text-2xl tracking-tight">{value}</div>
    </div>
  );
}

export function Dot({ tone }: { tone: "ok" | "warn" | "bad" | "muted" }) {
  const c = { ok: "bg-ok", warn: "bg-warn", bad: "bg-bad", muted: "bg-muted" }[tone];
  return <span className={`inline-block size-1.5 rounded-full ${c}`} />;
}

export function Empty() {
  return <div className="px-4 py-10 text-center text-sm text-muted">—</div>;
}
