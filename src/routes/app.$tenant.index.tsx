import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHeader, StatCard } from "@/components/portal/Shell";

export const Route = createFileRoute("/app/$tenant/")({
  component: ClinicOverview,
});

function ClinicOverview() {
  return (
    <>
      <PageHeader
        title="Bom dia, Camila."
        subtitle="Aqui está o resumo da operação de hoje."
        action={
          <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90">
            Validar atendimento
          </button>
        }
      />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Receita MRR" value="R$ 48.290" delta="+12,4% mês" tone="success" />
        <StatCard label="Pacientes ativos" value="1.847" delta="+86" tone="success" />
        <StatCard label="Validações hoje" value="34" delta="08 pendentes" />
        <StatCard label="Inadimplência" value="2,1%" delta="-0,4 p.p." tone="success" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-foreground">Atendimentos · 30 dias</div>
            <div className="text-xs text-muted-foreground">2.184 totais</div>
          </div>
          <div className="mt-6 flex h-40 items-end gap-1.5">
            {Array.from({ length: 30 }).map((_, i) => {
              const h = 25 + ((i * 37) % 60);
              return <div key={i} className="flex-1 rounded-t gradient-brand" style={{ height: `${h}%` }} />;
            })}
          </div>
        </Card>
        <Card className="p-6">
          <div className="text-sm font-medium text-foreground">Próximos vencimentos</div>
          <ul className="mt-4 space-y-3 text-sm">
            {[
              ["Maria Eduarda Costa", "amanhã", "R$ 89"],
              ["João Pedro Almeida", "em 2 dias", "R$ 149"],
              ["Roberta Lima", "em 4 dias", "R$ 89"],
              ["Clara Mendes", "em 6 dias", "R$ 89"],
            ].map((r) => (
              <li key={r[0]} className="flex items-center justify-between border-b border-border/60 pb-2 last:border-0">
                <div>
                  <div className="text-foreground">{r[0]}</div>
                  <div className="text-xs text-muted-foreground">vence {r[1]}</div>
                </div>
                <div className="text-foreground">{r[2]}</div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
