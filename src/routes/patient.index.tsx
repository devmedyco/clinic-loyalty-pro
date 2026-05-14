import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHeader, StatCard } from "@/components/portal/Shell";

export const Route = createFileRoute("/patient/")({
  component: PatientCard,
});

function PatientCard() {
  return (
    <>
      <PageHeader title="Seu cartão" subtitle="Apresente este QR Code na recepção da clínica." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="relative aspect-[1.6/1] max-w-md overflow-hidden rounded-3xl gradient-brand p-7 text-white shadow-elevated">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-widest opacity-80">Clínica Santa Vida</div>
                <div className="mt-1 font-display text-2xl">Cartão Benefícios</div>
              </div>
              <div className="rounded-md bg-white/15 px-2 py-1 text-[10px] uppercase tracking-wider">Ativo</div>
            </div>
            <div className="mt-12">
              <div className="text-[10px] uppercase tracking-widest opacity-80">Titular</div>
              <div className="mt-0.5 text-lg font-medium">Maria Eduarda Costa</div>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-widest opacity-80">Plano</div>
                <div className="font-medium">Professional · mensal</div>
              </div>
              <div className="grid h-20 w-20 grid-cols-7 grid-rows-7 gap-px rounded-md bg-white p-1.5">
                {Array.from({ length: 49 }).map((_, i) => (
                  <span key={i} className={`${[0,2,3,5,7,8,11,13,16,17,19,20,22,24,28,30,32,35,37,40,42,44,46,48].includes(i) ? "bg-primary" : "bg-transparent"}`} />
                ))}
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90">Compartilhar</button>
            <button className="rounded-lg border border-input bg-surface-elevated px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-accent">Adicionar ao Wallet</button>
          </div>
        </div>

        <div className="space-y-4">
          <StatCard label="Economia gerada" value="R$ 1.842" delta="desde a adesão" tone="success" />
          <StatCard label="Atendimentos" value="14" delta="nos últimos 12 meses" />
          <Card className="p-5">
            <div className="text-sm font-medium text-foreground">Próximo vencimento</div>
            <div className="mt-2 font-display text-2xl text-foreground">12 jun</div>
            <div className="text-xs text-muted-foreground">R$ 89,00 · cartão final 4242</div>
          </Card>
        </div>
      </div>
    </>
  );
}
