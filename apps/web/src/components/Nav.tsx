"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const LINKS = [
  ["/", "Overview"],
  ["/profile", "Profile"],
  ["/recipes", "Recipes"],
  ["/runs", "Runs"],
  ["/playground", "Playground"],
  ["/settings", "Settings"],
] as const;

export function Nav() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-line px-3 py-5">
      <Link href="/" className="px-2">
        <Logo />
      </Link>
      <nav className="mt-8 flex flex-col gap-0.5">
        {LINKS.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className={`rounded-lg px-2 py-1.5 text-sm transition-colors ${
              active(href) ? "bg-surface-2 font-medium text-fg" : "text-muted hover:text-fg"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto px-2">
        <ThemeToggle />
      </div>
    </aside>
  );
}
