import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, PageHeader, StatCard } from "@/components/portal/Shell";
import { getTenantFinance } from "@/lib/finance.functions";

export const Route = createFileRoute("/app/$tenant/finance")({
  component: FinancePage,
});

type RecentExecution = {
  final_amount: number | string;
  discount_amount: number | string;
  original_amount: number | string;
  created_at: string;
  patients?: { full_name: string } | null;
  services?: { name: string } | null;
};

function FinancePage() {
  const { tenant } = Route.useParams();
  const fetchFinance = useServerFn(getTenantFinance);
  const { data, isLoading, error } = useQuery({
    queryKey: ["tenant-finance", tenant],
    queryFn: () => fetchFinance({ data: { tenant } }),
  });

  const totals = data?.totals;
  const recentExecutions = (data?.recentExecutions ?? []) as unknown as RecentExecution[];

  return (
    <>
      <PageHeader
        title="Financeiro"
        subtitle="Acompanhe receita gerada, descontos aplicados e volume operacional."
      />

      {error && <div className="mb-4 text-sm text-destructive">{(error as Error).message}</div>}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Receita 30d"
          value={formatCurrency(totals?.revenue30d)}
          delta="valor final"
        />
        <StatCard
          label="Economia 30d"
          value={formatCurrency(totals?.savings30d)}
          delta="descontos aplicados"
        />
        <StatCard
          label="Atendimentos 30d"
          value={formatNumber(totals?.executions30d)}
          delta="serviços executados"
        />
        <StatCard
          label="Receita total"
          value={formatCurrency(totals?.revenueAll)}
          delta="histórico"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">
                Últimos atendimentos faturados
              </div>
              <div className="text-xs text-muted-foreground">Com base em service_executions</div>
            </div>
            <div className="rounded-md bg-brand-soft px-2 py-1 text-xs text-brand">
              {isLoading ? "carregando" : "30 dias"}
            </div>
          </div>
          {recentExecutions.length === 0 ? (
            <div className="mt-6 text-sm text-muted-foreground">
              Nenhum atendimento faturado nos últimos 30 dias.
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4">Paciente</th>
                    <th className="py-2 pr-4">Serviço</th>
                    <th className="py-2 pr-4">Final</th>
                    <th className="py-2 pr-4">Desconto</th>
                    <th className="py-2">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {recentExecutions.map((execution, index) => (
                    <tr key={`${execution.created_at}-${index}`} className="border-t border-border">
                      <td className="py-3 pr-4 text-foreground">
                        {execution.patients?.full_name ?? "Paciente"}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {execution.services?.name ?? "Serviço"}
                      </td>
                      <td className="py-3 pr-4 font-medium text-foreground">
                        {formatCurrency(execution.final_amount)}
                      </td>
                      <td className="py-3 pr-4 text-success">
                        {formatCurrency(execution.discount_amount)}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {formatDate(execution.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="text-sm font-medium text-foreground">Base operacional</div>
          <div className="mt-4 space-y-3">
            <MiniMetric label="Pacientes cadastrados" value={formatNumber(totals?.patients)} />
            <MiniMetric label="Serviços cadastrados" value={formatNumber(totals?.services)} />
            <MiniMetric label="Valor original 30d" value={formatCurrency(totals?.original30d)} />
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

function formatCurrency(value?: number | string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value ?? 0));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(value));
}
