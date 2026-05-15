import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, PageHeader, StatCard } from "@/components/portal/Shell";
import { getAdminMetrics } from "@/lib/admin-reports.functions";

export const Route = createFileRoute("/admin/metrics")({
  component: AdminMetricsPage,
});

function AdminMetricsPage() {
  const fetchMetrics = useServerFn(getAdminMetrics);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-metrics"],
    queryFn: () => fetchMetrics(),
  });
  const totals = data?.totals;

  return (
    <>
      <PageHeader title="Métricas" subtitle="Indicadores consolidados da plataforma Medyco." />
      {error && <Card className="p-6 text-sm text-destructive">{(error as Error).message}</Card>}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Clínicas"
          value={formatNumber(totals?.tenants)}
          delta={`${formatNumber(totals?.activeTenants)} ativas/trial`}
        />
        <StatCard
          label="Pacientes"
          value={formatNumber(totals?.patients)}
          delta={`${formatNumber(totals?.activePatients)} ativos`}
        />
        <StatCard
          label="Validações 30d"
          value={formatNumber(totals?.validations30d)}
          delta={`${formatNumber(totals?.deniedValidations30d)} negadas`}
        />
        <StatCard
          label="Receita executada"
          value={formatCurrency(totals?.revenue)}
          delta="atendimentos registrados"
        />
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <BreakdownCard title="Planos" data={data?.planMix} loading={isLoading} />
        <BreakdownCard title="Status das clínicas" data={data?.tenantStatus} loading={isLoading} />
        <BreakdownCard
          title="Status dos pacientes"
          data={data?.patientStatus}
          loading={isLoading}
        />
      </div>
      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-display text-xl text-foreground">Clínicas recentes</h2>
        </div>
        {isLoading ? (
          <div className="px-5 py-10 text-sm text-muted-foreground">Carregando métricas...</div>
        ) : (data?.recentTenants ?? []).length === 0 ? (
          <div className="px-5 py-10 text-sm text-muted-foreground">Nenhuma clínica criada.</div>
        ) : (
          <div className="divide-y divide-border">
            {data?.recentTenants.map((tenant) => (
              <div key={tenant.id} className="flex items-center justify-between px-5 py-4 text-sm">
                <div>
                  <div className="font-medium text-foreground">{tenant.name}</div>
                  <div className="text-xs text-muted-foreground">/{tenant.slug}</div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>{tenant.plan}</div>
                  <div>{tenant.status}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

function BreakdownCard({
  title,
  data,
  loading,
}: {
  title: string;
  data?: Record<string, number>;
  loading: boolean;
}) {
  const entries = Object.entries(data ?? {});
  return (
    <Card className="p-5">
      <h2 className="font-display text-xl text-foreground">{title}</h2>
      {loading ? (
        <div className="mt-4 text-sm text-muted-foreground">Carregando...</div>
      ) : entries.length === 0 ? (
        <div className="mt-4 text-sm text-muted-foreground">Sem dados ainda.</div>
      ) : (
        <div className="mt-4 space-y-3">
          {entries.map(([label, value]) => (
            <div key={label}>
              <div className="flex justify-between text-sm">
                <span className="capitalize text-foreground">{label}</span>
                <span className="text-muted-foreground">{value}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(100, value * 18)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
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
