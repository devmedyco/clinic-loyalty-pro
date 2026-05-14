import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHeader, StatCard } from "@/components/portal/Shell";

export const Route = createFileRoute("/admin/")({
  component: AdminOverview,
});

function AdminOverview() {
  return (
    <>
      <PageHeader
        title="Visão geral"
        subtitle="Saúde da operação Medyco em tempo real."
        action={
          <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90">
            Exportar relatório
          </button>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Tenants ativos" value="184" delta="+12 este mês" tone="success" />
        <StatCard label="MRR consolidado" value="R$ 92.4k" delta="+8,2%" tone="success" />
        <StatCard label="Pacientes" value="48.392" delta="+1.247" tone="success" />
        <StatCard label="Validações 30d" value="124k" delta="estável" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">Crescimento de tenants</div>
              <div className="text-xs text-muted-foreground">Últimos 12 meses</div>
            </div>
            <div className="rounded-md bg-brand-soft px-2 py-1 text-xs text-brand">+38% YoY</div>
          </div>
          <div className="mt-6 flex h-44 items-end gap-2">
            {[30, 38, 42, 50, 58, 64, 72, 80, 92, 105, 128, 184].map((v, i) => (
              <div key={i} className="flex-1 rounded-t-md gradient-brand" style={{ height: `${(v / 184) * 100}%` }} />
            ))}
          </div>
        </Card>
        <Card className="p-6">
          <div className="text-sm font-medium text-foreground">Últimos tenants</div>
          <ul className="mt-4 space-y-3">
            {[
              ["Clínica Santa Vida", "santavida"],
              ["Odonto Premium", "odontopremium"],
              ["Centro Médico Sul", "cmsul"],
              ["Estética Aurora", "aurora"],
            ].map(([n, s]) => (
              <li key={s} className="flex items-center justify-between border-b border-border/60 pb-3 last:border-0">
                <div>
                  <div className="text-sm text-foreground">{n}</div>
                  <div className="text-xs text-muted-foreground">/{s}</div>
                </div>
                <span className="rounded-md bg-success/15 px-2 py-0.5 text-xs text-success">ativo</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
