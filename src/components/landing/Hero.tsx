import { Link } from "@tanstack/react-router";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <div className="absolute inset-0 surface-grid opacity-60" aria-hidden />
      <div className="relative mx-auto max-w-7xl px-6 pt-20 pb-24 md:pt-28 md:pb-32">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs text-muted-foreground shadow-soft">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            Infraestrutura de benefícios em saúde
          </div>

          <h1 className="mt-6 font-display text-5xl leading-[1.05] tracking-tight text-foreground md:text-7xl">
            Crie seu próprio cartão de
            <br className="hidden md:block" />{" "}
            <span className="italic gradient-text">benefícios em saúde.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Transforme sua clínica em uma operação recorrente com assinatura, cartão digital
            e validação inteligente por QR Code — em uma plataforma white-label feita para
            escalar.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/signup"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 sm:w-auto"
            >
              Criar minha plataforma
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 4 4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Link>
            <a
              href="#contato"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface-elevated px-5 py-3 text-sm font-medium text-foreground shadow-soft transition hover:bg-accent sm:w-auto"
            >
              Agendar demonstração
            </a>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Sem cartão de crédito · Implementação em dias · Multi-tenant white-label
          </p>
        </div>

        {/* Mock dashboard preview */}
        <div className="relative mx-auto mt-20 max-w-5xl">
          <div className="absolute -inset-x-12 -top-12 -bottom-12 -z-10 bg-gradient-to-b from-brand/10 via-transparent to-transparent blur-3xl" aria-hidden />
          <div className="overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-elevated">
            <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-muted" />
              <span className="h-2.5 w-2.5 rounded-full bg-muted" />
              <span className="h-2.5 w-2.5 rounded-full bg-muted" />
              <span className="ml-3 text-xs text-muted-foreground">app.medyco.com.br/santavida</span>
            </div>
            <div className="grid grid-cols-12 gap-0">
              <aside className="col-span-3 border-r border-border bg-surface p-4">
                <div className="space-y-1">
                  {["Visão geral", "Pacientes", "Validar QR", "Atendimentos", "Financeiro", "Configurações"].map((label, i) => (
                    <div key={label} className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-xs ${i === 0 ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
                      {label}
                    </div>
                  ))}
                </div>
              </aside>
              <div className="col-span-9 p-6">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { k: "Receita MRR", v: "R$ 48.290", d: "+12,4%" },
                    { k: "Pacientes ativos", v: "1.847", d: "+86" },
                    { k: "Validações", v: "342", d: "hoje" },
                  ].map((c) => (
                    <div key={c.k} className="rounded-xl border border-border bg-card p-4">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{c.k}</div>
                      <div className="mt-1 font-display text-2xl text-foreground">{c.v}</div>
                      <div className="mt-1 text-xs text-success">{c.d}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-xl border border-border bg-card p-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">Atendimentos · últimos 30 dias</div>
                      <div className="font-display text-xl text-foreground">2.184</div>
                    </div>
                    <div className="flex h-20 items-end gap-1">
                      {[40, 55, 35, 70, 50, 80, 65, 90, 60, 75, 85, 95].map((h, i) => (
                        <span key={i} className="w-2 rounded-sm gradient-brand" style={{ height: `${h}%` }} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
