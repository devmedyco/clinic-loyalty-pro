import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, PageHeader } from "@/components/portal/Shell";
import { getPatientPortal } from "@/lib/patient-portal.functions";

export const Route = createFileRoute("/patient/history")({
  component: HistoryPage,
});

type Execution = {
  id: string;
  original_amount: number | string;
  discount_amount: number | string;
  final_amount: number | string;
  created_at: string;
  services?: { name: string } | null;
};

function HistoryPage() {
  const fetchPortal = useServerFn(getPatientPortal);
  const { data, isLoading, error } = useQuery({
    queryKey: ["patient-portal-history"],
    queryFn: () => fetchPortal(),
  });
  const executions = (data?.executions ?? []) as Execution[];

  return (
    <>
      <PageHeader
        title="Histórico de atendimentos"
        subtitle="Tudo que você economizou usando seu cartão."
      />
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="px-5 py-10 text-sm text-muted-foreground">Carregando histórico...</div>
        ) : error ? (
          <div className="px-5 py-10 text-sm text-destructive">{(error as Error).message}</div>
        ) : executions.length === 0 ? (
          <div className="px-5 py-14 text-center text-sm text-muted-foreground">
            Nenhum atendimento registrado ainda.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Data</th>
                <th className="px-5 py-3">Serviço</th>
                <th className="px-5 py-3">Valor original</th>
                <th className="px-5 py-3">Você pagou</th>
                <th className="px-5 py-3">Economia</th>
              </tr>
            </thead>
            <tbody>
              {executions.map((execution) => (
                <tr key={execution.id} className="border-t border-border">
                  <td className="px-5 py-4 text-muted-foreground">
                    {formatDate(execution.created_at)}
                  </td>
                  <td className="px-5 py-4 font-medium text-foreground">
                    {execution.services?.name ?? "Serviço"}
                  </td>
                  <td className="px-5 py-4 text-muted-foreground line-through">
                    {formatCurrency(execution.original_amount)}
                  </td>
                  <td className="px-5 py-4 text-foreground">
                    {formatCurrency(execution.final_amount)}
                  </td>
                  <td className="px-5 py-4">
                    <span className="rounded-md bg-brand-soft px-2 py-0.5 text-xs text-brand">
                      {formatCurrency(execution.discount_amount)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  }).format(new Date(value));
}
