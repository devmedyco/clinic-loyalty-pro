import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHeader } from "@/components/portal/Shell";

export const Route = createFileRoute("/app/$tenant/validate")({
  component: ValidatePage,
});

function ValidatePage() {
  return (
    <>
      <PageHeader
        title="Validação de cartão"
        subtitle="Escaneie o QR Code do paciente para autorizar o atendimento."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-hidden">
          <div className="relative flex aspect-video items-center justify-center bg-primary text-primary-foreground">
            <div className="absolute inset-0 surface-grid opacity-20" aria-hidden />
            <div className="relative text-center">
              <div className="mx-auto inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v3M14 21h3M17 17v4"/></svg>
              </div>
              <div className="mt-5 font-display text-2xl">Aponte para o QR Code</div>
              <p className="mt-1 text-sm opacity-80">A leitura é feita automaticamente em segundos.</p>
              <button className="mt-6 rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition hover:opacity-90">
                Ativar câmera
              </button>
            </div>
          </div>
          <div className="border-t border-border p-4">
            <div className="text-xs text-muted-foreground">Inserir manualmente</div>
            <div className="mt-2 flex gap-2">
              <input
                placeholder="Token do cartão · ex.: SVD-8421-AC"
                className="flex-1 rounded-lg border border-input bg-surface-elevated px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <button className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">Validar</button>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="text-sm font-medium text-foreground">Últimas validações</div>
          <ul className="mt-4 space-y-3 text-sm">
            {[
              ["Maria Eduarda Costa", "Consulta clínica", "autorizado"],
              ["Pedro Soares", "Limpeza dental", "autorizado"],
              ["Ana Paula Reis", "Cartão expirado", "negado"],
              ["Carlos Mendes", "Ultrassom", "autorizado"],
            ].map((r, i) => (
              <li key={i} className="flex items-start justify-between border-b border-border/60 pb-3 last:border-0">
                <div>
                  <div className="text-foreground">{r[0]}</div>
                  <div className="text-xs text-muted-foreground">{r[1]}</div>
                </div>
                <span className={`rounded-md px-2 py-0.5 text-xs ${r[2] === "autorizado" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>{r[2]}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
