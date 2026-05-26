import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { Card, PageHeader, StatCard } from "@/components/portal/Shell";
import { useRequireSession } from "@/hooks/use-auth-session";
import { getPatientPortal } from "@/lib/patient-portal.functions";

export const Route = createFileRoute("/patient/subscription")({
  component: PatientSubscriptionPage,
});

function PatientSubscriptionPage() {
  const fetchPortal = useServerFn(getPatientPortal);
  const session = useRequireSession();
  const { data, isLoading, error } = useQuery({
    queryKey: ["patient-subscription", session.userId],
    queryFn: () => fetchPortal(),
    enabled: session.isAuthenticated && Boolean(session.userId),
  });

  const hasPaidPayment = (data?.payments ?? []).some((payment) => payment.status === "paid");
  const active =
    Boolean(data?.card?.active) &&
    (!data?.card?.expires_at || new Date(data.card.expires_at).getTime() > Date.now()) &&
    data?.subscription?.status === "active" &&
    hasPaidPayment;

  return (
    <>
      <PageHeader title="Assinatura" subtitle="Status do seu acesso ao programa de benefícios." />
      {isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground">Carregando assinatura...</Card>
      ) : error ? (
        <Card className="p-6 text-sm text-destructive">{(error as Error).message}</Card>
      ) : !data?.patient ? (
        <Card className="p-8 text-sm text-muted-foreground">
          Seu cadastro de paciente ainda não foi vinculado a uma clínica.
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-3">
          <StatCard
            label="Status"
            value={active ? "Ativa" : "Pendente"}
            delta={subscriptionLabel(data.subscription?.status ?? data.patient.status)}
            tone={active ? "success" : "muted"}
          />
          <StatCard label="Clínica" value={data.tenant?.name ?? "Medyco"} delta="programa atual" />
          <StatCard
            label="Pago"
            value={formatCurrency(data.totals.paid)}
            delta="histórico de pagamentos"
            tone="success"
          />
          <Card className="p-6 md:col-span-3">
            <h2 className="font-display text-xl text-foreground">Cobrança recorrente</h2>
            <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
              <Info label="Plano" value={data.subscription?.plan ?? "benefits"} />
              <Info
                label="Próximo vencimento"
                value={
                  data.subscription?.next_due_date
                    ? formatDate(data.subscription.next_due_date)
                    : "Sem vencimento"
                }
              />
              <Info label="Status do cartão" value={active ? "Liberado" : "Aguardando pagamento"} />
            </div>
          </Card>
          <Card className="overflow-hidden md:col-span-3">
            <div className="border-b border-border px-5 py-4">
              <h2 className="font-display text-xl text-foreground">Pagamentos</h2>
            </div>
            {(data.payments ?? []).length === 0 ? (
              <div className="px-5 py-10 text-sm text-muted-foreground">
                Nenhum pagamento registrado ainda.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {data.payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between gap-4 px-5 py-4"
                  >
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        {formatCurrency(payment.amount)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {payment.payment_method} •{" "}
                        {formatDate(payment.paid_at ?? payment.due_date ?? payment.created_at)}
                      </div>
                      {payment.status !== "paid" && payment.asaas_invoice_url && (
                        <a
                          href={payment.asaas_invoice_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                        >
                          Abrir cobrança
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    <span className="rounded-md bg-brand-soft px-2 py-0.5 text-xs text-brand">
                      {paymentLabel(payment.status)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium text-foreground">{value}</div>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(value));
}

function subscriptionLabel(status: string) {
  const labels: Record<string, string> = {
    trial: "trial",
    active: "ativa",
    past_due: "inadimplente",
    canceled: "cancelada",
    paused: "pausada",
  };
  return labels[status] ?? status;
}

function paymentLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "Pendente",
    paid: "Pago",
    failed: "Falhou",
    refunded: "Estornado",
    canceled: "Cancelado",
  };
  return labels[status] ?? status;
}
