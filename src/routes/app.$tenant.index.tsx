import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, PageHeader, StatCard } from "@/components/portal/Shell";
import { getClinicDashboard } from "@/lib/dashboard.functions";

export const Route = createFileRoute("/app/$tenant/")({
  component: ClinicOverview,
});

function ClinicOverview() {
  const { tenant } = Route.useParams();
  const fetchDashboard = useServerFn(getClinicDashboard);
  const { data, isLoading, error } = useQuery({
    queryKey: ["clinic-dashboard", tenant],
    queryFn: () => fetchDashboard({ data: { tenant } }),
  });

  const totals = data?.totals;

  return (
    <>
      <PageHeader
        title={`Bom dia${data?.tenant?.name ? `, ${data.tenant.name}.` : "."}`}
        subtitle="Aqui está o resumo real da operação."
        action={
          <Link
            to="/app/$tenant/validate"
            params={{ tenant }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Validar atendimento
          </Link>
        }
      />

      {error && <div className="mb-4 text-sm text-destructive">{(error as Error).message}</div>}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Receita 30d"
          value={formatCurrency(totals?.revenue30d)}
          delta="serviços executados"
        />
        <StatCard
          label="Pacientes ativos"
          value={formatNumber(totals?.activePatients)}
          delta={`${formatNumber(totals?.patients)} totais`}
        />
        <StatCard
          label="Validações hoje"
          value={formatNumber(totals?.validationsToday)}
          delta={`${formatNumber(totals?.validations30d)} em 30d`}
        />
        <StatCard
          label="Inadimplentes"
          value={formatNumber(totals?.delinquentPatients)}
          delta="pacientes marcados"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-foreground">Atendimentos · 30 dias</div>
            <div className="text-xs text-muted-foreground">
              {isLoading ? "carregando" : `${formatNumber(totals?.executions30d)} totais`}
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <MiniMetric label="Receita final" value={formatCurrency(totals?.revenue30d)} />
            <MiniMetric label="Economia gerada" value={formatCurrency(totals?.savings30d)} />
            <MiniMetric label="Validações" value={formatNumber(totals?.validations30d)} />
          </div>
        </Card>
        <Card className="p-6">
          <div className="text-sm font-medium text-foreground">Próximas ações</div>
          <div className="mt-4 space-y-2 text-sm">
            <Link
              to="/app/$tenant/patients"
              params={{ tenant }}
              className="block rounded-lg border border-border px-3 py-2 text-foreground transition hover:bg-surface"
            >
              Cadastrar paciente
            </Link>
            <Link
              to="/app/$tenant/services"
              params={{ tenant }}
              className="block rounded-lg border border-border px-3 py-2 text-foreground transition hover:bg-surface"
            >
              Configurar serviços
            </Link>
            <Link
              to="/app/$tenant/executions"
              params={{ tenant }}
              className="block rounded-lg border border-border px-3 py-2 text-foreground transition hover:bg-surface"
            >
              Registrar atendimento
            </Link>
          </div>
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
