import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { supabase } from "@/integrations/supabase-ext/client";
import type { ComponentType, SVGProps } from "react";

export type NavItem = {
  to: string;
  params?: Record<string, string>;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

export function PortalShell({
  brand,
  items,
  user,
  tenantSwitcher,
  children,
}: {
  brand?: { name: string; subtitle?: string };
  items: NavItem[];
  user: { name: string; role: string };
  tenantSwitcher?: {
    currentSlug: string;
    tenants: Array<{ slug: string; name: string }>;
  };
  children: React.ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  async function onLogout() {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  return (
    <div className="flex min-h-screen bg-surface">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-16 items-center border-b border-sidebar-border px-5">
          <Logo />
        </div>
        {brand && (
          <div className="border-b border-sidebar-border px-5 py-4">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {brand.subtitle ?? "Tenant"}
            </div>
            <div className="mt-0.5 truncate font-medium text-sidebar-foreground">{brand.name}</div>
            {tenantSwitcher && tenantSwitcher.tenants.length > 1 && (
              <select
                value={tenantSwitcher.currentSlug}
                onChange={(event) => navigate({ to: `/app/${event.target.value}` as never })}
                className="mt-3 w-full rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-2 py-2 text-xs text-sidebar-foreground outline-none transition focus:border-brand"
              >
                {tenantSwitcher.tenants.map((tenant) => (
                  <option key={tenant.slug} value={tenant.slug}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
        <nav className="flex-1 space-y-0.5 p-3">
          {items.map((it) => {
            const href = resolve(it.to, it.params);
            const active = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                to={it.to as never}
                params={it.params as never}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                }`}
              >
                <it.icon className="h-4 w-4 shrink-0" />
                {it.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-brand text-xs font-medium">
              {user.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-sidebar-foreground">{user.name}</div>
              <div className="truncate text-xs text-muted-foreground">{user.role}</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="hidden flex-1 lg:block">
            <input
              placeholder="Buscar..."
              className="w-full max-w-sm rounded-lg border border-input bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-lg border border-input bg-surface-elevated px-3 py-2 text-xs text-muted-foreground transition hover:bg-accent">
              Suporte
            </button>
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-muted-foreground transition hover:bg-accent"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 pb-24 sm:p-6 lg:p-8 lg:pb-8">{children}</main>
        <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-background/95 px-2 py-2 backdrop-blur lg:hidden">
          {items.slice(0, 5).map((it) => {
            const href = resolve(it.to, it.params);
            const active = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                to={it.to as never}
                params={it.params as never}
                className={`flex min-w-0 flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[10px] transition ${
                  active ? "bg-accent text-foreground" : "text-muted-foreground"
                }`}
              >
                <it.icon className="h-4 w-4 shrink-0" />
                <span className="w-full truncate text-center">{it.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function resolve(to: string, params?: Record<string, string>) {
  if (!params) return to;
  let out = to;
  for (const [k, v] of Object.entries(params)) out = out.replace(`$${k}`, v);
  return out;
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl tracking-tight text-foreground md:text-4xl">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  delta,
  tone = "default",
}: {
  label: string;
  value: string;
  delta?: string;
  tone?: "default" | "success" | "muted";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-3xl text-foreground">{value}</div>
      {delta && (
        <div
          className={`mt-1 text-xs ${tone === "success" ? "text-success" : "text-muted-foreground"}`}
        >
          {delta}
        </div>
      )}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`rounded-2xl border border-border bg-card ${className}`}>{children}</div>;
}

// Icons
const I = (path: React.ReactNode) => (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {path}
  </svg>
);

export const Icons = {
  home: I(
    <>
      <path d="M3 11 12 4l9 7" />
      <path d="M5 10v10h14V10" />
    </>,
  ),
  users: I(
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 11a3.5 3.5 0 0 0 0-7" />
      <path d="M22 20a6.5 6.5 0 0 0-5-6.3" />
    </>,
  ),
  qr: I(
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3M21 14v3M14 21h3M17 17v4" />
    </>,
  ),
  list: I(
    <>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="4" cy="12" r="1" />
      <circle cx="4" cy="18" r="1" />
    </>,
  ),
  cash: I(
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
    </>,
  ),
  staff: I(
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>,
  ),
  card: I(
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M2.5 10h19" />
    </>,
  ),
  tag: I(
    <>
      <path d="m20 12-8 8-9-9V3h8z" />
      <circle cx="8" cy="8" r="1.4" />
    </>,
  ),
  cog: I(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>,
  ),
  building: I(
    <>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M9 8h2M13 8h2M9 12h2M13 12h2M9 16h2M13 16h2" />
    </>,
  ),
  chart: I(
    <>
      <path d="M3 3v18h18" />
      <path d="M7 14l4-4 3 3 5-7" />
    </>,
  ),
  shield: I(
    <>
      <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />
    </>,
  ),
  history: I(
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l3 2" />
    </>,
  ),
};
