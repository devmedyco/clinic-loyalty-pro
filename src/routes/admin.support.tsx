import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ClipboardList,
  ExternalLink,
  FilePenLine,
  Search,
  Stethoscope,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, PageHeader, StatCard } from "@/components/portal/Shell";
import { getAdminSupportDesk, recordSupportNote } from "@/lib/admin-support.functions";

export const Route = createFileRoute("/admin/support")({
  component: AdminSupportPage,
});

type TenantResult = {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  cnpj: string | null;
  status: string;
  asaas_onboarding_status: string | null;
  asaas_api_key_ref: string | null;
  asaas_wallet_id: string | null;
  saas_billing_status: string | null;
  saas_invoice_url: string | null;
};

type PatientResult = {
  id: string;
  tenant_id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  status: string;
  tenants?: { name: string; slug: string } | null;
  benefit_cards?: Array<{ card_number: string; active: boolean }> | null;
  subscriptions?: Array<{ status: string; next_due_date: string | null }> | null;
  payments?: Array<{
    id: string;
    status: string;
    amount: number | string;
    due_date: string | null;
    asaas_invoice_url: string | null;
  }> | null;
  patient_invitations?: Array<{
    status: string;
    email_sent_at: string | null;
    expires_at: string | null;
    created_at: string;
  }> | null;
};

type PaymentResult = {
  id: string;
  tenant_id: string;
  patient_id: string;
  status: string;
  amount: number | string;
  due_date: string | null;
  asaas_invoice_url: string | null;
  tenants?: { name: string; slug: string } | null;
  patients?: { full_name: string; email: string | null } | null;
};

type OperationalEvent = {
  id: string;
  level: "info" | "warning" | "error" | string;
  scope: string | null;
  title: string;
  detail: string | null;
  tenant_id: string | null;
  created_at: string;
  tenants?: { name: string; slug: string } | null;
};

function AdminSupportPage() {
  const queryClient = useQueryClient();
  const fetchDesk = useServerFn(getAdminSupportDesk);
  const saveNote = useServerFn(recordSupportNote);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [note, setNote] = useState<{
    tenant_id?: string;
    patient_id?: string;
    title: string;
  } | null>(null);

  const queryKey = useMemo(() => ["admin-support", submittedSearch], [submittedSearch]);
  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => fetchDesk({ data: { search: submittedSearch } }),
  });

  const noteMutation = useMutation({
    mutationFn: (input: {
      tenant_id?: string;
      patient_id?: string;
      title: string;
      detail: string;
    }) => saveNote({ data: { ...input, level: "info" } }),
    onSuccess: async () => {
      toast.success("Nota registrada no monitor operacional");
      setNote(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-support"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-readiness"] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const tenants = (data?.tenants ?? []) as unknown as TenantResult[];
  const patients = (data?.patients ?? []) as unknown as PatientResult[];
  const payments = (data?.payments ?? []) as unknown as PaymentResult[];
  const events = (data?.events ?? []) as unknown as OperationalEvent[];

  return (
    <>
      <PageHeader
        title="Suporte"
        subtitle="Central para localizar clínica, paciente, cobrança e evento sem abrir o banco."
      />

      <Card className="mb-5 p-5">
        <form
          className="flex flex-col gap-3 md:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmittedSearch(search.trim());
          }}
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">Buscar</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por clínica, slug, paciente, e-mail, CPF ou telefone..."
              className="block w-full rounded-lg border border-input bg-surface-elevated px-4 py-3 text-sm text-foreground shadow-soft outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </label>
          <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90">
            <Search className="h-4 w-4" />
            Buscar
          </button>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          Sem busca, a central mostra os casos mais recentes e pendências abertas.
        </p>
      </Card>

      {error && (
        <Card className="mb-5 p-6 text-sm text-destructive">{(error as Error).message}</Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Clínicas" value={isLoading ? "..." : formatNumber(data?.totals.tenants)} />
        <StatCard
          label="Pacientes"
          value={isLoading ? "..." : formatNumber(data?.totals.patients)}
        />
        <StatCard
          label="Cobranças pendentes"
          value={isLoading ? "..." : formatNumber(data?.totals.pendingPayments)}
          tone={data?.totals.pendingPayments ? "warning" : "muted"}
        />
        <StatCard
          label="Alertas"
          value={isLoading ? "..." : formatNumber(data?.totals.alerts)}
          tone={data?.totals.alerts ? "warning" : "success"}
        />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="overflow-hidden">
          <SectionHeader
            icon={Stethoscope}
            title="Pacientes encontrados"
            subtitle="Diagnóstico rápido de vínculo, termo, pagamento e cartão."
          />
          {isLoading ? (
            <EmptyText text="Carregando pacientes..." />
          ) : patients.length === 0 ? (
            <EmptyText text="Nenhum paciente encontrado." />
          ) : (
            <div className="divide-y divide-border">
              {patients.map((patient) => {
                const tenant = singleRelation(patient.tenants);
                const card = patient.benefit_cards?.[0];
                const subscription = patient.subscriptions?.[0];
                const pendingPayment = patient.payments?.find(
                  (payment) => payment.status !== "paid",
                );
                const invite = patient.patient_invitations?.[0];
                return (
                  <div key={patient.id} className="px-5 py-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="font-medium text-foreground">{patient.full_name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {[patient.email, patient.phone, patient.cpf].filter(Boolean).join(" • ")}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge tone={patient.user_id ? "success" : "warning"}>
                            {patient.user_id ? "portal vinculado" : "sem acesso"}
                          </Badge>
                          <Badge tone={card?.active ? "success" : "muted"}>
                            {card?.card_number ?? "sem cartão"}
                          </Badge>
                          <Badge tone={subscription?.status === "active" ? "success" : "warning"}>
                            assinatura {subscription?.status ?? "ausente"}
                          </Badge>
                          {invite && (
                            <Badge tone={invite.status === "accepted" ? "success" : "warning"}>
                              convite {invite.status}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {tenant && (
                          <>
                            <Link
                              to="/app/$tenant/patients/$patientId"
                              params={{ tenant: tenant.slug, patientId: patient.id }}
                              className="rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
                            >
                              Detalhes
                            </Link>
                            <Link
                              to="/app/$tenant/billing"
                              params={{ tenant: tenant.slug }}
                              className="rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
                            >
                              Financeiro
                            </Link>
                          </>
                        )}
                        {pendingPayment?.asaas_invoice_url && (
                          <a
                            href={pendingPayment.asaas_invoice_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
                          >
                            Cobrança
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setNote({
                              tenant_id: patient.tenant_id,
                              patient_id: patient.id,
                              title: `Atendimento suporte: ${patient.full_name}`,
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90"
                        >
                          <FilePenLine className="h-3 w-3" />
                          Nota
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card className="overflow-hidden">
            <SectionHeader
              icon={ClipboardList}
              title="Clínicas"
              subtitle="Atalhos para operação e configuração."
            />
            {isLoading ? (
              <EmptyText text="Carregando clínicas..." />
            ) : tenants.length === 0 ? (
              <EmptyText text="Nenhuma clínica encontrada." />
            ) : (
              <div className="divide-y divide-border">
                {tenants.map((tenant) => (
                  <div key={tenant.id} className="px-5 py-4 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-foreground">{tenant.name}</div>
                        <div className="text-xs text-muted-foreground">
                          /{tenant.slug} • {tenant.email ?? "sem e-mail"}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge tone={tenant.status === "active" ? "success" : "warning"}>
                            {tenant.status}
                          </Badge>
                          <Badge
                            tone={
                              tenant.asaas_onboarding_status === "active" &&
                              tenant.asaas_api_key_ref
                                ? "success"
                                : "warning"
                            }
                          >
                            Asaas {tenant.asaas_onboarding_status ?? "pendente"}
                          </Badge>
                        </div>
                      </div>
                      <Link
                        to="/app/$tenant/settings"
                        params={{ tenant: tenant.slug }}
                        className="rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
                      >
                        Ajustar
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="overflow-hidden">
            <SectionHeader
              icon={AlertTriangle}
              title="Eventos recentes"
              subtitle="Falhas e notas registradas."
            />
            {isLoading ? (
              <EmptyText text="Carregando eventos..." />
            ) : events.length === 0 ? (
              <EmptyText text="Nenhum evento registrado." />
            ) : (
              <div className="divide-y divide-border">
                {events.slice(0, 6).map((event) => {
                  const tenant = singleRelation(event.tenants);
                  return (
                    <div key={event.id} className="px-5 py-4 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-foreground">{event.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {[tenant?.name, event.detail, formatDate(event.created_at)]
                              .filter(Boolean)
                              .join(" • ")}
                          </div>
                        </div>
                        <Badge
                          tone={
                            event.level === "error"
                              ? "danger"
                              : event.level === "warning"
                                ? "warning"
                                : "muted"
                          }
                        >
                          {event.scope ?? "evento"}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      <Card className="mt-5 overflow-hidden">
        <SectionHeader
          icon={AlertTriangle}
          title="Cobranças que pedem atenção"
          subtitle="Pendências financeiras recentes para tratar com a clínica ou paciente."
        />
        {isLoading ? (
          <EmptyText text="Carregando cobranças..." />
        ) : payments.length === 0 ? (
          <EmptyText text="Nenhuma cobrança pendente ou falha encontrada." />
        ) : (
          <div className="divide-y divide-border">
            {payments.map((payment) => {
              const tenant = singleRelation(payment.tenants);
              const patient = singleRelation(payment.patients);
              return (
                <div
                  key={payment.id}
                  className="flex flex-col gap-3 px-5 py-4 text-sm md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="font-medium text-foreground">
                      {formatCurrency(payment.amount)} • {payment.status}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {[
                        tenant?.name,
                        patient?.full_name,
                        payment.due_date && formatDate(payment.due_date),
                      ]
                        .filter(Boolean)
                        .join(" • ")}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tenant && (
                      <Link
                        to="/app/$tenant/billing"
                        params={{ tenant: tenant.slug }}
                        className="rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
                      >
                        Abrir billing
                      </Link>
                    )}
                    {payment.asaas_invoice_url && (
                      <a
                        href={payment.asaas_invoice_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90"
                      >
                        Link Asaas
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {note && (
        <SupportNoteModal
          note={note}
          loading={noteMutation.isPending}
          onClose={() => setNote(null)}
          onSave={(detail) => noteMutation.mutate({ ...note, detail })}
        />
      )}
    </>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Search;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="border-b border-border px-5 py-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-brand" />
        <h2 className="font-display text-xl text-foreground">{title}</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function SupportNoteModal({
  note,
  loading,
  onClose,
  onSave,
}: {
  note: { title: string };
  loading: boolean;
  onClose: () => void;
  onSave: (detail: string) => void;
}) {
  const [detail, setDetail] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface-elevated p-6 shadow-elegant">
        <h2 className="font-display text-xl text-foreground">Registrar nota de suporte</h2>
        <p className="mt-1 text-sm text-muted-foreground">{note.title}</p>
        <textarea
          value={detail}
          onChange={(event) => setDetail(event.target.value)}
          rows={5}
          placeholder="Ex.: Paciente informou que pagou no PIX, aguardando webhook. Conferir novamente em 10 minutos."
          className="mt-5 block w-full resize-y rounded-lg border border-input bg-surface-elevated px-3 py-2.5 text-sm leading-6 text-foreground shadow-soft outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-input px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={loading || detail.trim().length < 4}
            onClick={() => onSave(detail.trim())}
            className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Salvando..." : "Salvar nota"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "success" | "warning" | "danger" | "muted";
  children: React.ReactNode;
}) {
  const className =
    tone === "success"
      ? "bg-success/15 text-success"
      : tone === "warning"
        ? "bg-warning/15 text-warning"
        : tone === "danger"
          ? "bg-destructive/15 text-destructive"
          : "bg-muted text-muted-foreground";
  return <span className={`w-fit rounded-md px-2 py-0.5 text-xs ${className}`}>{children}</span>;
}

function EmptyText({ text }: { text: string }) {
  return <div className="px-5 py-10 text-sm text-muted-foreground">{text}</div>;
}

function singleRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function formatNumber(value?: number) {
  return new Intl.NumberFormat("pt-BR").format(value ?? 0);
}

function formatCurrency(value?: number | string | null) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value ?? 0));
}

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
