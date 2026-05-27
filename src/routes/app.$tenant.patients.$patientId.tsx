import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CreditCard,
  FileCheck2,
  Send,
  ShieldCheck,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Card, PageHeader, StatCard } from "@/components/portal/Shell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  createPatientDependent,
  deletePatientDependent,
  getPatientDetail,
  invitePatientToPortal,
} from "@/lib/patients.functions";

export const Route = createFileRoute("/app/$tenant/patients/$patientId")({
  component: PatientDetailPage,
});

type PatientDetail = {
  id: string;
  user_id: string | null;
  full_name: string;
  cpf: string | null;
  birth_date: string | null;
  email: string | null;
  phone: string | null;
  zip_code: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  asaas_customer_id?: string | null;
  benefit_cards?: Array<{
    id: string;
    card_number: string;
    qr_token: string;
    active: boolean;
    expires_at: string | null;
    created_at: string;
  }>;
};

type Subscription = {
  id: string;
  plan: string;
  status: string;
  next_due_date: string | null;
  asaas_subscription_id: string | null;
  created_at: string;
};

type Payment = {
  id: string;
  amount: number | string;
  payment_method: string;
  status: string;
  paid_at: string | null;
  due_date?: string | null;
  asaas_invoice_url?: string | null;
  notes?: string | null;
  created_at: string;
};

type Execution = {
  id: string;
  original_amount: number | string;
  discount_amount: number | string;
  final_amount: number | string;
  notes: string | null;
  created_at: string;
  services?: { name: string } | Array<{ name: string }> | null;
};

type Validation = {
  id: string;
  validated_at: string;
  outcome: string;
  reason: string | null;
  notes: string | null;
  benefit_cards?: { card_number: string } | Array<{ card_number: string }> | null;
};

type Acceptance = {
  id: string;
  accepted_at: string;
  legal_documents?:
    | { title: string; version: string; type: string }
    | Array<{
        title: string;
        version: string;
        type: string;
      }>
    | null;
};

type Invitation = {
  id: string;
  email: string;
  status: string;
  email_status: string | null;
  email_error: string | null;
  email_sent_at: string | null;
  email_last_attempt_at: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

type Dependent = {
  id: string;
  full_name: string;
  cpf: string | null;
  birth_date: string | null;
  relationship: string | null;
  status: "active" | "inactive";
  created_at: string;
};

function PatientDetailPage() {
  const { tenant, patientId } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchDetail = useServerFn(getPatientDetail);
  const invite = useServerFn(invitePatientToPortal);
  const createDependent = useServerFn(createPatientDependent);
  const removeDependent = useServerFn(deletePatientDependent);
  const [dependentForm, setDependentForm] = useState({
    full_name: "",
    cpf: "",
    birth_date: "",
    relationship: "",
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["patient-detail", tenant, patientId],
    queryFn: () => fetchDetail({ data: { tenant, id: patientId } }),
  });

  const inviteMutation = useMutation({
    mutationFn: () => invite({ data: { tenant, id: patientId } }),
    onSuccess: async (result) => {
      if (result.emailResult.sent) {
        toast.success("Convite enviado para o paciente");
      } else {
        toast.warning("Convite criado, mas o e-mail não foi enviado.", {
          description: result.invitation.email_error ?? describeEmailResult(result.emailResult),
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["patient-detail", tenant, patientId] });
      await queryClient.invalidateQueries({ queryKey: ["patients", tenant] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const dependentMutation = useMutation({
    mutationFn: () =>
      createDependent({
        data: {
          tenant,
          id: patientId,
          full_name: dependentForm.full_name,
          cpf: dependentForm.cpf || undefined,
          birth_date: dependentForm.birth_date || undefined,
          relationship: dependentForm.relationship || undefined,
          status: "active",
        },
      }),
    onSuccess: async () => {
      toast.success("Dependente adicionado.");
      setDependentForm({ full_name: "", cpf: "", birth_date: "", relationship: "" });
      await queryClient.invalidateQueries({ queryKey: ["patient-detail", tenant, patientId] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const deleteDependentMutation = useMutation({
    mutationFn: (dependentId: string) =>
      removeDependent({ data: { tenant, patient_id: patientId, dependent_id: dependentId } }),
    onSuccess: async () => {
      toast.success("Dependente removido.");
      await queryClient.invalidateQueries({ queryKey: ["patient-detail", tenant, patientId] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const patient = data?.patient as PatientDetail | undefined;
  const subscriptions = (data?.subscriptions ?? []) as Subscription[];
  const payments = (data?.payments ?? []) as Payment[];
  const executions = (data?.executions ?? []) as Execution[];
  const validations = (data?.validations ?? []) as Validation[];
  const acceptances = (data?.acceptances ?? []) as Acceptance[];
  const invitations = (data?.invitations ?? []) as Invitation[];
  const dependents = (data?.dependents ?? []) as Dependent[];
  const card = patient?.benefit_cards?.[0];
  const subscription = subscriptions[0];

  return (
    <>
      <PageHeader
        title={patient?.full_name ?? "Ficha do paciente"}
        subtitle="Cadastro, cartão, assinatura, atendimentos, pagamentos e histórico de acesso."
        action={
          <div className="flex flex-wrap gap-2">
            {patient && !patient.user_id && (
              <button
                disabled={inviteMutation.isPending || !patient.email}
                onClick={() => inviteMutation.mutate()}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {inviteMutation.isPending ? "Enviando..." : "Convidar paciente"}
              </button>
            )}
            <Link
              to="/app/$tenant/patients"
              params={{ tenant }}
              className="inline-flex items-center gap-2 rounded-lg border border-input px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Link>
          </div>
        }
      />

      {isLoading ? (
        <DetailSkeleton />
      ) : error ? (
        <Card className="p-6 text-sm text-destructive">{(error as Error).message}</Card>
      ) : patient ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Status" value={statusLabel(patient.status)} delta="cadastro" />
            <StatCard
              label="Assinatura"
              value={statusLabel(subscription?.status ?? "sem")}
              delta={
                subscription?.next_due_date
                  ? `vence ${formatDate(subscription.next_due_date)}`
                  : "sem vencimento"
              }
            />
            <StatCard
              label="Pagamentos"
              value={formatCurrency(data?.totals.paid)}
              delta={`${data?.totals.pending ?? 0} pendente(s)`}
              tone="success"
            />
            <StatCard
              label="Economia"
              value={formatCurrency(data?.totals.savings)}
              delta={`${data?.totals.executions ?? 0} atendimento(s)`}
            />
            <StatCard
              label="Dependentes"
              value={String(data?.totals.dependents ?? 0)}
              delta="vinculados ao titular"
            />
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-5">
              <Card className="p-5">
                <SectionTitle icon={ShieldCheck} title="Dados do paciente" />
                <InfoGrid
                  items={[
                    ["Nome", patient.full_name],
                    ["CPF", formatCpf(patient.cpf)],
                    [
                      "Nascimento",
                      patient.birth_date ? formatDate(patient.birth_date) : "Não informado",
                    ],
                    ["E-mail", patient.email ?? "Sem e-mail"],
                    ["Telefone", patient.phone ?? "Sem telefone"],
                    ["Endereço", formatAddress(patient)],
                    ["Acesso ao portal", patient.user_id ? "Criado" : "Pendente"],
                    ["Cliente Asaas", patient.asaas_customer_id ? "Vinculado" : "Não vinculado"],
                    ["Cadastro", formatDateTime(patient.created_at)],
                    ["Última atualização", formatDateTime(patient.updated_at)],
                  ]}
                />
              </Card>

              <Card className="p-5">
                <SectionTitle icon={UserPlus} title="Dependentes" />
                <form
                  className="mt-4 grid gap-3 sm:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    dependentMutation.mutate();
                  }}
                >
                  <input
                    value={dependentForm.full_name}
                    onChange={(event) =>
                      setDependentForm({ ...dependentForm, full_name: event.target.value })
                    }
                    placeholder="Nome completo"
                    className="rounded-lg border border-input bg-surface-elevated px-3 py-2.5 text-sm text-foreground shadow-soft outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                    required
                  />
                  <input
                    value={dependentForm.relationship}
                    onChange={(event) =>
                      setDependentForm({ ...dependentForm, relationship: event.target.value })
                    }
                    placeholder="Parentesco"
                    className="rounded-lg border border-input bg-surface-elevated px-3 py-2.5 text-sm text-foreground shadow-soft outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                  <input
                    value={dependentForm.cpf}
                    onChange={(event) =>
                      setDependentForm({ ...dependentForm, cpf: event.target.value })
                    }
                    placeholder="CPF"
                    className="rounded-lg border border-input bg-surface-elevated px-3 py-2.5 text-sm text-foreground shadow-soft outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                  <input
                    type="date"
                    value={dependentForm.birth_date}
                    onChange={(event) =>
                      setDependentForm({ ...dependentForm, birth_date: event.target.value })
                    }
                    className="rounded-lg border border-input bg-surface-elevated px-3 py-2.5 text-sm text-foreground shadow-soft outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                  <button
                    type="submit"
                    disabled={dependentMutation.isPending}
                    className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60 sm:col-span-2"
                  >
                    {dependentMutation.isPending ? "Adicionando..." : "Adicionar dependente"}
                  </button>
                </form>
                {dependents.length === 0 ? (
                  <EmptyBlock text="Nenhum dependente cadastrado." />
                ) : (
                  <div className="mt-5 divide-y divide-border">
                    {dependents.map((dependent) => (
                      <div
                        key={dependent.id}
                        className="flex flex-col gap-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <div className="font-medium text-foreground">{dependent.full_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {[dependent.relationship, formatCpf(dependent.cpf)]
                              .filter(Boolean)
                              .join(" · ") || "Dados complementares não informados"}
                          </div>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              type="button"
                              disabled={deleteDependentMutation.isPending}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive transition hover:bg-destructive/10 disabled:opacity-60"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Remover
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="border-border bg-surface-elevated">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover dependente?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Isso remove {dependent.full_name} do cartão do titular. O valor da
                                próxima cobrança pendente será recalculado sem esse dependente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteDependentMutation.mutate(dependent.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Remover dependente
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-5">
                <SectionTitle icon={CreditCard} title="Cartão digital" />
                {card ? (
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="rounded-xl border border-border bg-surface p-4">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">
                        Número do cartão
                      </div>
                      <div className="mt-1 font-mono text-lg font-semibold text-foreground">
                        {card.card_number}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <StatusBadge status={card.active ? "active" : "inactive"} />
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {card.expires_at
                            ? `Expira ${formatDate(card.expires_at)}`
                            : "Sem expiração"}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Token QR</div>
                      <div className="mt-1 break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs text-foreground">
                        {card.qr_token}
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyBlock text="Este paciente ainda não possui cartão digital." />
                )}
              </Card>

              <Card className="p-5">
                <SectionTitle icon={FileCheck2} title="Termos e convites" />
                <Timeline
                  emptyText="Nenhum termo aceito ainda."
                  items={acceptances.map((acceptance) => {
                    const document = singleRelation(acceptance.legal_documents);
                    return {
                      id: acceptance.id,
                      title: document?.title ?? "Documento aceito",
                      subtitle: document?.version
                        ? `Versão ${document.version}`
                        : "Aceite jurídico",
                      right: formatDateTime(acceptance.accepted_at),
                    };
                  })}
                />
                <div className="mt-5 border-t border-border pt-5">
                  <Timeline
                    emptyText="Nenhum convite enviado."
                    items={invitations.map((invitation) => ({
                      id: invitation.id,
                      title: invitation.email,
                      subtitle: [
                        statusLabel(invitation.status),
                        emailStatusLabel(invitation.email_status),
                        invitation.email_error,
                      ]
                        .filter(Boolean)
                        .join(" · "),
                      right: invitation.accepted_at
                        ? `Aceito ${formatDateTime(invitation.accepted_at)}`
                        : `Expira ${formatDate(invitation.expires_at)}`,
                    }))}
                  />
                </div>
              </Card>
            </div>

            <div className="space-y-5">
              <Card className="p-5">
                <SectionTitle icon={CreditCard} title="Assinatura e pagamentos" />
                {subscription ? (
                  <div className="mt-4 rounded-xl border border-border bg-surface p-4 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-foreground">
                          {planLabel(subscription.plan)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Próximo vencimento:{" "}
                          {subscription.next_due_date
                            ? formatDate(subscription.next_due_date)
                            : "sem data"}
                        </div>
                      </div>
                      <StatusBadge status={subscription.status} />
                    </div>
                  </div>
                ) : (
                  <EmptyBlock text="Nenhuma assinatura criada para este paciente." />
                )}
                <Timeline
                  className="mt-5"
                  emptyText="Nenhum pagamento registrado."
                  items={payments.map((payment) => ({
                    id: payment.id,
                    title: `${formatCurrency(payment.amount)} · ${payment.payment_method}`,
                    subtitle: payment.notes ?? statusLabel(payment.status),
                    right: payment.paid_at
                      ? `Pago ${formatDateTime(payment.paid_at)}`
                      : payment.due_date
                        ? `Vence ${formatDate(payment.due_date)}`
                        : formatDateTime(payment.created_at),
                    href: payment.asaas_invoice_url,
                  }))}
                />
              </Card>

              <Card className="p-5">
                <SectionTitle icon={ShieldCheck} title="Atendimentos" />
                <Timeline
                  emptyText="Nenhum atendimento registrado."
                  items={executions.map((execution) => {
                    const service = singleRelation(execution.services);
                    return {
                      id: execution.id,
                      title: service?.name ?? "Serviço executado",
                      subtitle: `Final ${formatCurrency(execution.final_amount)} · economia ${formatCurrency(
                        execution.discount_amount,
                      )}`,
                      right: formatDateTime(execution.created_at),
                    };
                  })}
                />
              </Card>

              <Card className="p-5">
                <SectionTitle icon={ShieldCheck} title="Validações do cartão" />
                <Timeline
                  emptyText="Nenhuma validação registrada."
                  items={validations.map((validation) => {
                    const validationCard = singleRelation(validation.benefit_cards);
                    return {
                      id: validation.id,
                      title: validation.outcome === "approved" ? "Autorizado" : "Negado",
                      subtitle:
                        validation.reason ??
                        validation.notes ??
                        validationCard?.card_number ??
                        "Validação registrada",
                      right: formatDateTime(validation.validated_at),
                      tone: validation.outcome === "approved" ? "success" : "danger",
                    };
                  })}
                />
              </Card>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="h-28 animate-pulse bg-muted/60" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="h-80 animate-pulse bg-muted/60" />
        <Card className="h-80 animate-pulse bg-muted/60" />
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: typeof ShieldCheck; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <h2 className="font-display text-xl text-foreground">{title}</h2>
    </div>
  );
}

function InfoGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-xl border border-border bg-surface p-3">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="mt-1 break-words text-sm font-medium text-foreground">{value}</div>
        </div>
      ))}
    </div>
  );
}

function Timeline({
  items,
  emptyText,
  className = "",
}: {
  items: Array<{
    id: string;
    title: string;
    subtitle: string;
    right: string;
    href?: string | null;
    tone?: "success" | "danger";
  }>;
  emptyText: string;
  className?: string;
}) {
  if (items.length === 0) return <EmptyBlock className={className} text={emptyText} />;

  return (
    <div className={`divide-y divide-border ${className}`}>
      {items.map((item) => (
        <div
          key={item.id}
          className="flex flex-col gap-2 py-3 text-sm sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="min-w-0">
            <div
              className={
                item.tone === "danger"
                  ? "font-medium text-destructive"
                  : item.tone === "success"
                    ? "font-medium text-success"
                    : "font-medium text-foreground"
              }
            >
              {item.href ? (
                <a href={item.href} target="_blank" rel="noreferrer" className="hover:underline">
                  {item.title}
                </a>
              ) : (
                item.title
              )}
            </div>
            <div className="mt-0.5 break-words text-xs text-muted-foreground">{item.subtitle}</div>
          </div>
          <div className="shrink-0 text-xs text-muted-foreground sm:text-right">{item.right}</div>
        </div>
      ))}
    </div>
  );
}

function EmptyBlock({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div
      className={`mt-4 rounded-xl border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-muted-foreground ${className}`}
    >
      {text}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    {
      active: "bg-success/15 text-success",
      trial: "bg-success/15 text-success",
      paid: "bg-success/15 text-success",
      accepted: "bg-success/15 text-success",
      past_due: "bg-destructive/15 text-destructive",
      delinquent: "bg-destructive/15 text-destructive",
      pending: "bg-warning/15 text-warning",
      canceled: "bg-muted text-muted-foreground",
      inactive: "bg-muted text-muted-foreground",
      paused: "bg-muted text-muted-foreground",
    }[status] ?? "bg-muted text-muted-foreground";

  return <span className={`rounded-md px-2 py-0.5 text-xs ${styles}`}>{statusLabel(status)}</span>;
}

function singleRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function describeEmailResult(result: { sent: boolean; reason?: string; error?: string }) {
  if (result.sent) return "Resend confirmou o envio.";
  if (result.reason === "missing_resend_api_key") {
    return "RESEND_API_KEY não está disponível no ambiente publicado.";
  }
  return result.error || "Resend recusou o envio sem detalhar o motivo.";
}

function emailStatusLabel(status?: string | null) {
  if (status === "sent") return "E-mail enviado";
  if (status === "failed") return "E-mail falhou";
  if (status === "not_attempted") return "E-mail não tentado";
  return null;
}

function statusLabel(status: string) {
  return (
    {
      active: "Ativo",
      trial: "Teste",
      past_due: "Inadimplente",
      delinquent: "Inadimplente",
      inactive: "Inativo",
      canceled: "Cancelado",
      paused: "Pausado",
      pending: "Pendente",
      paid: "Pago",
      accepted: "Aceito",
      expired: "Expirado",
      revoked: "Revogado",
      sem: "Sem assinatura",
    }[status] ?? status
  );
}

function planLabel(plan?: string | null) {
  const labels: Record<string, string> = {
    benefits: "Cartão de benefícios",
  };
  return labels[plan ?? ""] ?? plan ?? "Cartão de benefícios";
}

function formatCpf(cpf?: string | null) {
  if (!cpf) return "Sem CPF";
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatAddress(patient: PatientDetail) {
  const line = [patient.street, patient.number, patient.complement].filter(Boolean).join(", ");
  const city = [patient.neighborhood, patient.city, patient.state].filter(Boolean).join(" · ");
  const zip = patient.zip_code ? `CEP ${patient.zip_code}` : "";
  return [line, city, zip].filter(Boolean).join(" - ") || "Não informado";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatCurrency(value?: number | string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value ?? 0));
}
