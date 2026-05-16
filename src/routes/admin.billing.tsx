import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, PageHeader, StatCard } from "@/components/portal/Shell";
import { getAdminBilling } from "@/lib/admin-reports.functions";

export const Route = createFileRoute("/admin/billing")({
  component: AdminBillingPage,
});

function AdminBillingPage() {
  const fetchBilling = useServerFn(getAdminBilling);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-billing"],
    queryFn: () => fetchBilling(),
  });

  return (
    <>
      <PageHeader
        title="Billing SaaS"
        subtitle="Mensalidade fixa das clínicas e participação Medyco por paciente pagante."
      />
      {error && <Card className="p-6 text-sm text-destructive">{(error as Error).message}</Card>}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Clínicas"
          value={isLoading ? "..." : formatNumber(data?.totals.tenants)}
          delta={
            isLoading ? "carregando" : `${formatNumber(data?.totals.activeTenants)} operacionais`
          }
        />
        <StatCard
          label="MRR previsto"
          value={isLoading ? "..." : formatCurrency(data?.totals.expectedMrr)}
          delta="mensalidades das clínicas"
        />
        <StatCard
          label="Split médio"
          value={isLoading ? "..." : `${formatPercent(data?.totals.averageSplit)}%`}
          delta="sobre pacientes pagos"
        />
      </div>
      <Card className="mt-6 overflow-hidden">
        {isLoading ? (
          <div className="px-5 py-10 text-sm text-muted-foreground">Carregando billing...</div>
        ) : (data?.tenants ?? []).length === 0 ? (
          <div className="px-5 py-10 text-sm text-muted-foreground">
            Nenhuma clínica cadastrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Clínica</th>
                  <th className="px-5 py-3">Mensalidade</th>
                  <th className="px-5 py-3">Split</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Modelo</th>
                </tr>
              </thead>
              <tbody>
                {data?.tenants.map((tenant) => (
                  <tr key={tenant.id} className="border-t border-border">
                    <td className="px-5 py-4">
                      <div className="font-medium text-foreground">{tenant.name}</div>
                      <div className="text-xs text-muted-foreground">/{tenant.slug}</div>
                    </td>
                    <td className="px-5 py-4 font-medium text-foreground">
                      {formatCurrency(tenant.expected_amount)}
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {formatPercent(tenant.split_percentage)}%
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">{tenant.billing_status}</td>
                    <td className="px-5 py-4 text-muted-foreground">Base + split</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
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

function formatPercent(value?: number) {
  return Number(value ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}
