"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/procesanalyse", label: "Procesanalyse" },
  { href: "/visueel-ontwerp", label: "Visueel" },
  { href: "/agent-ontwerp", label: "Agents" },
  { href: "/applicatie-ontwerp", label: "Ontwerp" },
  { href: "/bouwen", label: "Bouwen" },
  { href: "/settings", label: "Instellingen" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav
      className="sticky top-0 z-50 flex items-center justify-between px-6 h-14 border-b border-border bg-deep-black/90 backdrop-blur-sm"
      aria-label="Hoofdnavigatie"
    >
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 shrink-0" aria-label="ProcesAgents home">
        <span className="font-grotesk font-bold text-base">
          <span className="text-blue-light">AI</span>
          <span className="text-off-white">-Group</span>
          <span className="text-slate mx-1">·</span>
          <span className="text-off-white">ProcesAgents</span>
        </span>
      </Link>

      {/* Links */}
      <div className="hidden md:flex items-center gap-1" role="list">
        {NAV_LINKS.map((link) => {
          const isActive =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              role="listitem"
              className={cn(
                "px-3 py-1.5 rounded text-sm transition-colors",
                isActive
                  ? "bg-surface text-off-white font-medium"
                  : "text-slate hover:text-off-white hover:bg-surface/60"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {link.label}
            </Link>
          );
        })}
      </div>

      {/* Mobile menu trigger — simplified */}
      <MobileMenu pathname={pathname} />
    </nav>
  );
}

function MobileMenu({ pathname }: { pathname: string }) {
  return (
    <div className="md:hidden">
      <details className="relative">
        <summary
          className="list-none cursor-pointer p-2 text-slate hover:text-off-white"
          aria-label="Menu openen"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </summary>
        <div className="absolute right-0 top-full mt-1 w-52 bg-surface border border-border rounded-card shadow-card py-1">
          {NAV_LINKS.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "block px-4 py-2 text-sm",
                  isActive ? "text-off-white font-medium" : "text-slate hover:text-off-white"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </details>
    </div>
  );
}
