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
          value={isLoading ? "..." : formatNumber(totals?.tenants)}
          delta={isLoading ? "carregando" : `${formatNumber(totals?.activeTenants)} ativas/trial`}
        />
        <StatCard
          label="Pacientes"
          value={isLoading ? "..." : formatNumber(totals?.patients)}
          delta={isLoading ? "carregando" : `${formatNumber(totals?.activePatients)} ativos`}
        />
        <StatCard
          label="Validações 30d"
          value={isLoading ? "..." : formatNumber(totals?.validations30d)}
          delta={isLoading ? "carregando" : `${formatNumber(totals?.deniedValidations30d)} negadas`}
        />
        <StatCard
          label="Receita executada"
          value={isLoading ? "..." : formatCurrency(totals?.revenue)}
          delta="atendimentos registrados"
        />
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <BreakdownCard title="Modelo comercial" data={data?.commercialModel} loading={isLoading} />
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
                  <div>{commercialModelLabel(tenant.commercial_model)}</div>
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

function commercialModelLabel(value?: string) {
  if (value === "custom") return "Contrato customizado";
  if (value === "base_fixed_plus_split") return "Base + taxa + split";
  return "Base + split";
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
                <span className="text-foreground">{metricLabel(label)}</span>
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

function metricLabel(value: string) {
  const labels: Record<string, string> = {
    base_fixed_plus_split: "Mensalidade + taxa por paciente",
    base_plus_split: "Mensalidade + participação",
    custom: "Contrato customizado",
    trial: "Teste",
    active: "Ativa",
    paused: "Pausada",
    canceled: "Cancelada",
    inactive: "Inativo",
    delinquent: "Inadimplente",
  };
  return labels[value] ?? value;
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
