import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, PageHeader, StatCard } from "@/components/portal/Shell";
import { getAdminDashboard } from "@/lib/dashboard.functions";

export const Route = createFileRoute("/admin/")({
  component: AdminOverview,
});

type RecentTenant = {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
};

function AdminOverview() {
  const fetchDashboard = useServerFn(getAdminDashboard);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => fetchDashboard(),
  });

  const totals = data?.totals;
  const recentTenants = (data?.recentTenants ?? []) as RecentTenant[];

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

      {error && <div className="mb-4 text-sm text-destructive">{(error as Error).message}</div>}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Tenants"
          value={formatNumber(totals?.tenants)}
          delta={`${formatNumber(totals?.activeTenants)} ativos`}
        />
        <StatCard
          label="Receita 30d"
          value={formatCurrency(totals?.revenue30d)}
          delta="atendimentos executados"
        />
        <StatCard label="Pacientes" value={formatNumber(totals?.patients)} delta="base total" />
        <StatCard
          label="Validações 30d"
          value={formatNumber(totals?.validations30d)}
          delta="QR e cartão"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">Atividade operacional</div>
              <div className="text-xs text-muted-foreground">Métricas reais do Supabase</div>
            </div>
            <div className="rounded-md bg-brand-soft px-2 py-1 text-xs text-brand">
              {isLoading ? "carregando" : "ao vivo"}
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <MiniMetric label="Tenants ativos" value={formatNumber(totals?.activeTenants)} />
            <MiniMetric label="Pacientes" value={formatNumber(totals?.patients)} />
            <MiniMetric label="Receita 30d" value={formatCurrency(totals?.revenue30d)} />
          </div>
        </Card>
        <Card className="p-6">
          <div className="text-sm font-medium text-foreground">Últimos tenants</div>
          {recentTenants.length === 0 ? (
            <div className="mt-4 text-sm text-muted-foreground">Nenhuma clínica criada ainda.</div>
          ) : (
            <ul className="mt-4 space-y-3">
              {recentTenants.map((tenant) => (
                <li
                  key={tenant.id}
                  className="flex items-center justify-between border-b border-border/60 pb-3 last:border-0"
                >
                  <div>
                    <div className="text-sm text-foreground">{tenant.name}</div>
                    <div className="text-xs text-muted-foreground">/{tenant.slug}</div>
                  </div>
                  <span className="rounded-md bg-success/15 px-2 py-0.5 text-xs text-success">
                    {tenant.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl text-foreground">{value}</div>
    </div>
  );
}

function formatNumber(value?: number) {
  return new Intl.NumberFormat("pt-BR").format(value ?? 0);
}

function formatCurrency(value?: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value ?? 0);
}
