import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";

export function PublicPage({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Logo />
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link to="/planos" className="hover:text-foreground">
              Planos
            </Link>
            <Link to="/contato" className="hover:text-foreground">
              Contato
            </Link>
            <Link to="/login" className="font-medium text-foreground hover:text-brand">
              Entrar
            </Link>
          </nav>
        </div>
      </header>
      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">{eyebrow}</div>
        <h1 className="mt-4 font-display text-4xl tracking-tight text-foreground md:text-5xl">
          {title}
        </h1>
        {subtitle && <p className="mt-4 max-w-2xl text-base text-muted-foreground">{subtitle}</p>}
        <div className="mt-10">{children}</div>
      </section>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border py-7 first:border-t-0 first:pt-0">
      <h2 className="font-display text-2xl text-foreground">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground">{children}</div>
    </section>
  );
}
