import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, PageHeader, StatCard } from "@/components/portal/Shell";
import { getAdminBilling, startTenantSaasBilling } from "@/lib/admin-reports.functions";

export const Route = createFileRoute("/admin/billing")({
  component: AdminBillingPage,
});

function AdminBillingPage() {
  const queryClient = useQueryClient();
  const fetchBilling = useServerFn(getAdminBilling);
  const startBilling = useServerFn(startTenantSaasBilling);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-billing"],
    queryFn: () => fetchBilling(),
  });
  const startBillingMutation = useMutation({
    mutationFn: (tenantId: string) =>
      startBilling({ data: { tenant_id: tenantId, billing_type: "PIX" } }),
    onSuccess: async () => {
      toast.success("Mensalidade SaaS criada no Asaas. A primeira cobrança vence hoje.");
      await queryClient.invalidateQueries({ queryKey: ["admin-billing"] });
    },
    onError: (mutationError) => {
      toast.error(
        mutationError instanceof Error
          ? mutationError.message
          : "Não foi possível ativar a mensalidade.",
      );
    },
  });

  return (
    <>
      <PageHeader
        title="Billing SaaS"
        subtitle="Mensalidade fixa das clínicas, taxa operacional e participação por paciente pagante."
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
          label="Asaas SaaS"
          value={isLoading ? "..." : data?.totals.asaasConfigured ? "Configurado" : "Pendente"}
          delta={
            isLoading
              ? "carregando"
              : `${formatNumber(data?.totals.billingActive)} ativas · ${formatNumber(
                  data?.totals.billingPending,
                )} pendentes`
          }
          tone={data?.totals.asaasConfigured ? "success" : "muted"}
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
            <table className="w-full min-w-[1040px] text-sm">
              <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Clínica</th>
                  <th className="px-5 py-3">Mensalidade</th>
                  <th className="px-5 py-3">Taxa por paciente</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Vencimento</th>
                  <th className="px-5 py-3 text-right">Ação</th>
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
                      {formatCurrency(tenant.split_fixed_fee)} +{" "}
                      {formatPercent(tenant.split_percentage)}%
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs ${billingTone(
                          tenant.billing_status,
                        )}`}
                      >
                        {billingStatusLabel(tenant.billing_status)}
                      </span>
                      {tenant.saas_billing_error && (
                        <div className="mt-1 max-w-xs truncate text-xs text-destructive">
                          {tenant.saas_billing_error}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {tenant.saas_next_due_date
                        ? formatDate(tenant.saas_next_due_date)
                        : "Aguardando ativação"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {tenant.asaas_saas_subscription_id ? (
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs text-muted-foreground">
                            Assinatura {tenant.asaas_saas_subscription_id}
                          </span>
                          {tenant.saas_invoice_url && (
                            <a
                              href={tenant.saas_invoice_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-medium text-brand hover:underline"
                            >
                              Abrir cobrança
                            </a>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={
                            !data?.totals.asaasConfigured ||
                            startBillingMutation.isPending ||
                            !tenant.email
                          }
                          onClick={() => startBillingMutation.mutate(tenant.id)}
                          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {startBillingMutation.isPending
                            ? "Ativando..."
                            : !tenant.email
                              ? "Sem e-mail"
                              : "Ativar mensalidade"}
                        </button>
                      )}
                    </td>
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

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value));
}

function billingStatusLabel(value?: string | null) {
  const labels: Record<string, string> = {
    not_started: "Não iniciado",
    pending: "Cobrança pendente",
    active: "Ativo",
    overdue: "Em atraso",
    canceled: "Cancelado",
    failed: "Falhou",
  };
  return labels[value ?? "not_started"] ?? "Não iniciado";
}

function billingTone(value?: string | null) {
  if (value === "active") return "bg-success/15 text-success";
  if (value === "pending") return "bg-brand-soft text-brand";
  if (value === "overdue" || value === "failed") return "bg-destructive/10 text-destructive";
  if (value === "canceled") return "bg-muted text-muted-foreground";
  return "bg-muted text-muted-foreground";
}
