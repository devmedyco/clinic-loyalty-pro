import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Card, PageHeader, StatCard } from "@/components/portal/Shell";
import {
  createManualPayment,
  getTenantBilling,
  updateSubscriptionStatus,
} from "@/lib/billing.functions";

export const Route = createFileRoute("/app/$tenant/billing")({
  component: BillingPage,
});

type SubscriptionStatus = "trial" | "active" | "past_due" | "canceled" | "paused";

type Subscription = {
  id: string;
  patient_id: string;
  plan: string;
  status: SubscriptionStatus;
  next_due_date: string | null;
  patients?: {
    full_name: string;
    email: string | null;
    phone: string | null;
    status: string;
  } | null;
};

type Payment = {
  id: string;
  amount: number | string;
  payment_method: string;
  status: string;
  paid_at: string | null;
  created_at: string;
  patients?: { full_name: string } | null;
};

function BillingPage() {
  const { tenant } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchBilling = useServerFn(getTenantBilling);
  const createPayment = useServerFn(createManualPayment);
  const updateSubscription = useServerFn(updateSubscriptionStatus);
  const [paymentFor, setPaymentFor] = useState<Subscription | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["tenant-billing", tenant],
    queryFn: () => fetchBilling({ data: { tenant } }),
  });

  const paymentMutation = useMutation({
    mutationFn: (input: {
      patient_id: string;
      amount: number;
      payment_method: string;
      status: string;
      notes?: string;
    }) => createPayment({ data: { tenant, ...input } }),
    onSuccess: async () => {
      toast.success("Pagamento registrado");
      setPaymentFor(null);
      await queryClient.invalidateQueries({ queryKey: ["tenant-billing", tenant] });
      await queryClient.invalidateQueries({ queryKey: ["patients", tenant] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const statusMutation = useMutation({
    mutationFn: (input: {
      subscription_id: string;
      status: SubscriptionStatus;
      next_due_date?: string;
    }) => updateSubscription({ data: { tenant, ...input } }),
    onSuccess: async () => {
      toast.success("Assinatura atualizada");
      await queryClient.invalidateQueries({ queryKey: ["tenant-billing", tenant] });
      await queryClient.invalidateQueries({ queryKey: ["patients", tenant] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const subscriptions = (data?.subscriptions ?? []) as Subscription[];
  const payments = (data?.payments ?? []) as Payment[];

  return (
    <>
      <PageHeader
        title="Assinaturas"
        subtitle="Controle recorrência, inadimplência e pagamentos dos pacientes."
        action={
          <button
            disabled={!subscriptions[0]}
            onClick={() => setPaymentFor(subscriptions[0])}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            Registrar pagamento
          </button>
        }
      />

      {paymentFor && (
        <PaymentModal
          subscription={paymentFor}
          loading={paymentMutation.isPending}
          onClose={() => setPaymentFor(null)}
          onSubmit={(input) => paymentMutation.mutate(input)}
        />
      )}

      {error && (
        <Card className="mb-5 p-6 text-sm text-destructive">{(error as Error).message}</Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Assinaturas"
          value={formatNumber(data?.totals.subscriptions)}
          delta={`${formatNumber(data?.totals.active)} ativas/trial`}
        />
        <StatCard
          label="Inadimplentes"
          value={formatNumber(data?.totals.pastDue)}
          delta="status past_due"
        />
        <StatCard
          label="Recebido"
          value={formatCurrency(data?.totals.paidRevenue)}
          delta="pagamentos listados"
          tone="success"
        />
        <StatCard
          label="Pendentes"
          value={formatNumber(data?.totals.pendingPayments)}
          delta="pagamentos"
        />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-display text-xl text-foreground">Pacientes assinantes</h2>
          </div>
          {isLoading ? (
            <div className="px-5 py-10 text-sm text-muted-foreground">
              Carregando assinaturas...
            </div>
          ) : subscriptions.length === 0 ? (
            <div className="px-5 py-10 text-sm text-muted-foreground">
              Nenhum paciente cadastrado para assinatura.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3">Paciente</th>
                    <th className="px-5 py-3">Plano</th>
                    <th className="px-5 py-3">Vencimento</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map((subscription) => (
                    <tr key={subscription.id} className="border-t border-border">
                      <td className="px-5 py-4">
                        <div className="font-medium text-foreground">
                          {subscription.patients?.full_name ?? "Paciente"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {subscription.patients?.email ||
                            subscription.patients?.phone ||
                            "Sem contato"}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">{subscription.plan}</td>
                      <td className="px-5 py-4 text-muted-foreground">
                        {subscription.next_due_date
                          ? formatDate(subscription.next_due_date)
                          : "Sem vencimento"}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={subscription.status} />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setPaymentFor(subscription)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            Pagar
                          </button>
                          <select
                            value={subscription.status}
                            onChange={(event) =>
                              statusMutation.mutate({
                                subscription_id: subscription.id,
                                status: event.target.value as SubscriptionStatus,
                                next_due_date: subscription.next_due_date ?? undefined,
                              })
                            }
                            className="rounded-lg border border-input bg-surface-elevated px-2 py-1.5 text-xs"
                          >
                            <option value="trial">Trial</option>
                            <option value="active">Ativa</option>
                            <option value="past_due">Inadimplente</option>
                            <option value="paused">Pausada</option>
                            <option value="canceled">Cancelada</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-display text-xl text-foreground">Pagamentos recentes</h2>
          </div>
          {payments.length === 0 ? (
            <div className="px-5 py-10 text-sm text-muted-foreground">
              Nenhum pagamento registrado.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {payments.map((payment) => (
                <div key={payment.id} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-foreground">
                        {payment.patients?.full_name ?? "Paciente"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {payment.payment_method} •{" "}
                        {formatDate(payment.paid_at ?? payment.created_at)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-foreground">
                        {formatCurrency(payment.amount)}
                      </div>
                      <StatusBadge status={payment.status} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function PaymentModal({
  subscription,
  loading,
  onClose,
  onSubmit,
}: {
  subscription: Subscription;
  loading: boolean;
  onClose: () => void;
  onSubmit: (input: {
    patient_id: string;
    amount: number;
    payment_method: string;
    status: string;
    notes?: string;
  }) => void;
}) {
  const [amount, setAmount] = useState("99");
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [status, setStatus] = useState("paid");
  const [notes, setNotes] = useState("");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-border bg-surface-elevated p-6 shadow-elegant"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="font-display text-xl text-foreground">Registrar pagamento</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {subscription.patients?.full_name ?? "Paciente"}
        </p>
        <form
          className="mt-5 grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit({
              patient_id: subscription.patient_id,
              amount: Number(amount),
              payment_method: paymentMethod,
              status,
              notes,
            });
          }}
        >
          <Field
            label="Valor"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
          <label className="block">
            <span className="text-xs font-medium text-foreground">Método</span>
            <select
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
              className="mt-1.5 block w-full rounded-lg border border-input bg-surface-elevated px-3 py-2.5 text-sm text-foreground"
            >
              <option value="pix">PIX</option>
              <option value="credit_card">Cartão</option>
              <option value="boleto">Boleto</option>
              <option value="cash">Dinheiro</option>
              <option value="manual">Manual</option>
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-foreground">Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="mt-1.5 block w-full rounded-lg border border-input bg-surface-elevated px-3 py-2.5 text-sm text-foreground"
            >
              <option value="paid">Pago</option>
              <option value="pending">Pendente</option>
              <option value="failed">Falhou</option>
              <option value="canceled">Cancelado</option>
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-foreground">Observações</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              className="mt-1.5 block w-full resize-none rounded-lg border border-input bg-surface-elevated px-3 py-2.5 text-sm text-foreground"
            />
          </label>
          <div className="flex gap-2 pt-2 sm:col-span-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface"
            >
              Cancelar
            </button>
            <button
              disabled={loading}
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Registrando..." : "Registrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  className = "",
  ...props
}: { label: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-medium text-foreground">{label}</span>
      <input
        {...props}
        className="mt-1.5 block w-full rounded-lg border border-input bg-surface-elevated px-3 py-2.5 text-sm text-foreground shadow-soft outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
    </label>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    {
      trial: "bg-brand-soft text-brand",
      active: "bg-success/15 text-success",
      paid: "bg-success/15 text-success",
      past_due: "bg-destructive/15 text-destructive",
      failed: "bg-destructive/15 text-destructive",
      canceled: "bg-muted text-muted-foreground",
      paused: "bg-muted text-muted-foreground",
      pending: "bg-warning/15 text-warning",
    }[status] ?? "bg-muted text-muted-foreground";

  const labels: Record<string, string> = {
    trial: "Trial",
    active: "Ativa",
    paid: "Pago",
    past_due: "Inadimplente",
    failed: "Falhou",
    canceled: "Cancelado",
    paused: "Pausada",
    pending: "Pendente",
  };

  return (
    <span className={`rounded-md px-2 py-0.5 text-xs ${styles}`}>{labels[status] ?? status}</span>
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
