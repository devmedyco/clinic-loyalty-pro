import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, PageHeader, StatCard } from "@/components/portal/Shell";
import { getAdminReadiness } from "@/lib/admin-reports.functions";

export const Route = createFileRoute("/admin/readiness")({
  component: AdminReadinessPage,
});

function AdminReadinessPage() {
  const fetchReadiness = useServerFn(getAdminReadiness);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-readiness"],
    queryFn: () => fetchReadiness(),
  });

  const checks = [
    ["Resend", data?.environment.resend, "E-mails transacionais"],
    ["URL base", data?.environment.appBaseUrl, "Links públicos e convites"],
    ["Asaas API", data?.environment.asaasApi, "Cobranças"],
    ["Wallet Medyco", data?.environment.asaasWallet, "Split automático"],
    ["Webhook Asaas", data?.environment.asaasWebhook, "Baixa automática"],
    ["Termo paciente", data?.legal.patientTerms, "Uso do cartão"],
    ["Privacidade", data?.legal.privacyPolicy, "LGPD"],
    ["Termos plataforma", data?.legal.platformTerms, "Uso SaaS"],
    ["Contrato clínica", data?.legal.clinicAgreement, "Comercial B2B"],
    ["Política cobrança", data?.legal.billingPolicy, "Cancelamento e inadimplência"],
  ] as const;
  const done = checks.filter(([, ready]) => ready).length;

  return (
    <>
      <PageHeader
        title="Prontidão"
        subtitle="Checklist operacional para saber o que falta antes de colocar a Medyco na rua."
      />
      {error && (
        <Card className="mb-5 p-6 text-sm text-destructive">{(error as Error).message}</Card>
      )}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Checklist"
          value={isLoading ? "..." : `${done}/${checks.length}`}
          delta="itens prontos"
          tone={done === checks.length ? "success" : "muted"}
        />
        <StatCard
          label="Clínicas"
          value={isLoading ? "..." : formatNumber(data?.totals.tenants)}
          delta={`${formatNumber(data?.totals.activeTenants)} ativas/trial`}
        />
        <StatCard
          label="Pacientes"
          value={isLoading ? "..." : formatNumber(data?.totals.patients)}
          delta={`${formatNumber(data?.totals.linkedPatients)} com acesso`}
        />
        <StatCard
          label="Pagamentos"
          value={isLoading ? "..." : formatNumber(data?.totals.payments)}
          delta={`${formatNumber(data?.totals.asaasPayments)} via Asaas`}
        />
        <StatCard
          label="Webhook"
          value={isLoading ? "..." : formatNumber(data?.totals.webhookEvents)}
          delta={`${formatNumber(data?.totals.failedWebhooks)} falha(s) recentes`}
          tone={data?.totals.failedWebhooks ? "warning" : "success"}
        />
        <StatCard
          label="Alertas"
          value={isLoading ? "..." : formatNumber(data?.totals.operationalWarnings)}
          delta={`${formatNumber(data?.totals.operationalErrors)} erro(s) operacionais`}
          tone={data?.totals.operationalErrors ? "warning" : "muted"}
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-6">
          <h2 className="font-display text-xl text-foreground">Checklist principal</h2>
          <div className="mt-5 space-y-3">
            {checks.map(([label, ready, detail]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface px-4 py-3 text-sm"
              >
                <div>
                  <div className="font-medium text-foreground">{label}</div>
                  <div className="text-xs text-muted-foreground">{detail}</div>
                </div>
                <span
                  className={`rounded-md px-2 py-0.5 text-xs ${
                    ready ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                  }`}
                >
                  {ready ? "pronto" : "pendente"}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-display text-xl text-foreground">Clínicas com pendências</h2>
          </div>
          {isLoading ? (
            <div className="px-5 py-10 text-sm text-muted-foreground">Carregando...</div>
          ) : (data?.tenantGaps ?? []).length === 0 ? (
            <div className="px-5 py-10 text-sm text-muted-foreground">
              Nenhuma pendência crítica encontrada nas clínicas.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {data?.tenantGaps.map((tenant) => (
                <div key={tenant.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-foreground">{tenant.name}</div>
                      <div className="text-xs text-muted-foreground">/{tenant.slug}</div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {tenant.gaps.map((gap) => (
                          <span
                            key={gap}
                            className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                          >
                            {gap}
                          </span>
                        ))}
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
      </div>

      <Card className="mt-5 overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-display text-xl text-foreground">Monitor do webhook Asaas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanha se os eventos de pagamento estão chegando e sendo processados.
          </p>
        </div>
        {isLoading ? (
          <div className="px-5 py-10 text-sm text-muted-foreground">Carregando monitor...</div>
        ) : (
          <div className="grid gap-4 p-5 md:grid-cols-3">
            <MonitorBox
              label="Último evento"
              value={
                data?.webhook.lastEventAt ? formatDate(data.webhook.lastEventAt) : "Sem evento"
              }
              detail={data?.webhook.lastResult ?? "Nenhum webhook recebido ainda"}
            />
            <MonitorBox
              label="Status recente"
              value={webhookStatusLabel(data?.webhook.lastStatus)}
              detail={`${formatNumber(data?.totals.ignoredWebhooks)} evento(s) ignorado(s) recentemente`}
            />
            <MonitorBox
              label="Falhas"
              value={formatNumber(data?.totals.failedWebhooks)}
              detail={
                data?.totals.failedWebhooks
                  ? "Abrir Auditoria para ver o motivo"
                  : "Sem falhas recentes"
              }
            />
          </div>
        )}
      </Card>

      <Card className="mt-5 overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-display text-xl text-foreground">Monitor operacional</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Registra ações críticas, falhas financeiras e eventos de suporte em um só lugar.
          </p>
        </div>
        {isLoading ? (
          <div className="px-5 py-10 text-sm text-muted-foreground">Carregando eventos...</div>
        ) : (data?.monitoring.recentEvents ?? []).length === 0 ? (
          <div className="px-5 py-10 text-sm text-muted-foreground">
            Nenhum evento operacional registrado ainda.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {data?.monitoring.recentEvents.map((event) => (
              <div
                key={event.id}
                className="flex flex-col gap-3 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-medium text-foreground">{event.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {[event.tenant, event.detail, formatDate(event.created_at)]
                      .filter(Boolean)
                      .join(" • ")}
                  </div>
                </div>
                <span
                  className={`w-fit rounded-md px-2 py-0.5 text-xs ${
                    event.level === "error"
                      ? "bg-destructive/15 text-destructive"
                      : event.level === "warning"
                        ? "bg-warning/15 text-warning"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {event.scope}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mt-5 overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-display text-xl text-foreground">QA dos fluxos críticos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Visão simples do que já foi testado com dados reais dentro da plataforma.
          </p>
        </div>
        {isLoading ? (
          <div className="px-5 py-10 text-sm text-muted-foreground">Carregando QA...</div>
        ) : (
          <div className="grid gap-3 p-5 md:grid-cols-2">
            {(data?.qaChecks ?? []).map((check) => (
              <div
                key={check.label}
                className="flex items-start justify-between gap-4 rounded-xl border border-border bg-surface px-4 py-3"
              >
                <div>
                  <div className="font-medium text-foreground">{check.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{check.detail}</div>
                </div>
                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-xs ${
                    check.ready ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                  }`}
                >
                  {check.ready ? "ok" : "testar"}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

function formatNumber(value?: number) {
  return new Intl.NumberFormat("pt-BR").format(value ?? 0);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function webhookStatusLabel(value?: string | null) {
  const labels: Record<string, string> = {
    processed: "processado",
    ignored: "ignorado",
    failed: "falhou",
    received: "recebido",
  };
  return labels[value ?? ""] ?? "sem evento";
}

function MonitorBox({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium text-foreground">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}
