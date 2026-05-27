import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  CheckCircle2,
  Copy,
  CreditCard,
  ExternalLink,
  ShieldCheck,
  Users,
} from "lucide-react";
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
    refetchOnMount: "always",
  });

  const hasPaidPayment = (data?.payments ?? []).some((payment) => payment.status === "paid");
  const active =
    Boolean(data?.card?.active) &&
    (!data?.card?.expires_at || new Date(data.card.expires_at).getTime() > Date.now()) &&
    data?.subscription?.status === "active" &&
    hasPaidPayment;
  const pendingPayments = (data?.payments ?? []).filter((payment) => payment.status === "pending");
  const nextPayment = pendingPayments[0];
  const invoiceUrl = nextPayment?.asaas_invoice_url || nextPayment?.asaas_bank_slip_url;

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
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="font-display text-xl text-foreground">Cobrança recorrente</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  A liberação do cartão acontece automaticamente depois da confirmação do pagamento.
                </p>
              </div>
              {invoiceUrl && (
                <div className="flex flex-wrap gap-2">
                  <a
                    href={invoiceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                  >
                    <CreditCard className="h-4 w-4" />
                    Pagar agora
                  </a>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(invoiceUrl)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-input px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-accent"
                  >
                    <Copy className="h-4 w-4" />
                    Copiar link
                  </button>
                </div>
              )}
            </div>
            {!active && (
              <div className="mt-5 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground">
                {invoiceUrl
                  ? "Existe uma cobrança pendente. Após o pagamento, o cartão é liberado pelo webhook do Asaas."
                  : "A cobrança ainda não tem link de pagamento. Fale com a clínica para gerar a cobrança."}
              </div>
            )}
            <div className="mt-5 grid gap-3 text-sm md:grid-cols-4">
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
              <Info label="Dependentes" value={String(data.totals.dependents ?? 0)} />
            </div>
          </Card>
          <Card className="p-6 md:col-span-3">
            <h2 className="font-display text-xl text-foreground">Próximo passo</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <Step
                done={Boolean(data.legal?.accepted)}
                title="Termo de uso"
                text={
                  data.legal?.accepted
                    ? "Aceite registrado."
                    : "Aceite o termo para liberar a análise do cartão."
                }
              />
              <Step
                done={hasPaidPayment}
                title="Primeiro pagamento"
                text={
                  hasPaidPayment
                    ? "Pagamento confirmado."
                    : "Pague a cobrança pendente ou fale com a clínica."
                }
              />
              <Step
                done={active}
                title="Cartão liberado"
                text={
                  active
                    ? "Seu QR Code já pode ser validado."
                    : "A liberação acontece após termo aceito e pagamento confirmado."
                }
              />
            </div>
          </Card>
          <Card className="p-6 md:col-span-3">
            <h2 className="font-display text-xl text-foreground">Seu benefício inclui</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <Benefit
                icon={CreditCard}
                title="Cartão digital"
                text="QR Code e número do cartão."
              />
              <Benefit
                icon={ShieldCheck}
                title="Validação segura"
                text="Autorização na recepção."
              />
              <Benefit icon={CalendarClock} title="Histórico" text="Pagamentos e atendimentos." />
              <Benefit icon={Users} title="Dependentes" text="Quando a clínica habilitar." />
            </div>
          </Card>
          <Card className="overflow-hidden md:col-span-3">
            <div className="border-b border-border px-5 py-4">
              <h2 className="font-display text-xl text-foreground">Titular e dependentes</h2>
            </div>
            <div className="divide-y divide-border">
              <PersonRow
                name={data.patient.full_name}
                detail={data.patient.email ?? data.patient.phone ?? "Titular do cartão"}
                status="Titular"
              />
              {(data.dependents ?? []).length === 0 ? (
                <div className="px-5 py-6 text-sm text-muted-foreground">
                  Nenhum dependente vinculado ao seu cartão.
                </div>
              ) : (
                data.dependents.map((dependent) => (
                  <PersonRow
                    key={dependent.id}
                    name={dependent.full_name}
                    detail={dependent.relationship ?? "Dependente"}
                    status={dependent.status === "active" ? "Ativo" : "Inativo"}
                  />
                ))
              )}
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
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs ${
                        payment.status === "paid"
                          ? "bg-success/15 text-success"
                          : payment.status === "pending"
                            ? "bg-warning/15 text-warning"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
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

function Step({ done, title, text }: { done: boolean; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full ${
            done ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
        </span>
        <div className="text-sm font-medium text-foreground">{title}</div>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{text}</p>
    </div>
  );
}

function PersonRow({ name, detail, status }: { name: string; detail: string; status: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4 text-sm">
      <div>
        <div className="font-medium text-foreground">{name}</div>
        <div className="text-xs text-muted-foreground">{detail}</div>
      </div>
      <span className="rounded-md bg-brand-soft px-2 py-0.5 text-xs text-brand">{status}</span>
    </div>
  );
}

function Benefit({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof CheckCircle2;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <Icon className="h-5 w-5 text-brand" />
      <div className="mt-3 text-sm font-medium text-foreground">{title}</div>
      <div className="mt-1 text-xs leading-5 text-muted-foreground">{text}</div>
    </div>
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

function formatCurrency(value: number | string) {
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
