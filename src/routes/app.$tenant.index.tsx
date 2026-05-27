import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
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
  const onboardingChecks = [
    {
      label: "Dados da clínica",
      detail: "CNPJ, responsável e e-mail preenchidos",
      ready: Boolean(data?.tenant?.cnpj && data.tenant.email && data.tenant.responsible_name),
      to: "/app/$tenant/settings",
    },
    {
      label: "Cobrança Asaas",
      detail: "Subconta, wallet e secret configurados",
      ready: Boolean(
        data?.tenant?.asaas_onboarding_status === "active" &&
        data.tenant.asaas_api_key_ref &&
        data.tenant.asaas_wallet_id,
      ),
      to: "/app/$tenant/settings",
    },
    {
      label: "Serviços ativos",
      detail: "Serviços e descontos cadastrados",
      ready: Number(totals?.activeServices ?? 0) > 0,
      to: "/app/$tenant/services",
    },
    {
      label: "Rede credenciada",
      detail: "Locais/profissionais visíveis para o paciente",
      ready: Number(totals?.activeProviders ?? 0) > 0,
      to: "/app/$tenant/providers",
    },
    {
      label: "Paciente com acesso",
      detail: "Convite aceito e portal vinculado",
      ready: Number(totals?.linkedPatients ?? 0) > 0,
      to: "/app/$tenant/patients",
    },
    {
      label: "Teste de validação",
      detail: "Primeiro QR validado na recepção",
      ready: Number(totals?.validations30d ?? 0) > 0,
      to: "/app/$tenant/validate",
    },
  ] as const;
  const completedChecks = onboardingChecks.filter((check) => check.ready).length;

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
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-foreground">Ativação da clínica</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {completedChecks}/{onboardingChecks.length} passos concluídos
              </div>
            </div>
            <div className="rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
              checklist
            </div>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            {onboardingChecks.map((check) => (
              <Link
                key={check.label}
                to={check.to as never}
                params={{ tenant } as never}
                className="flex items-start gap-3 rounded-lg border border-border px-3 py-2 text-foreground transition hover:bg-surface"
              >
                <CheckCircle2
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    check.ready ? "text-success" : "text-muted-foreground"
                  }`}
                />
                <span className="min-w-0">
                  <span className="block font-medium">{check.label}</span>
                  <span className="block text-xs text-muted-foreground">{check.detail}</span>
                </span>
              </Link>
            ))}
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
