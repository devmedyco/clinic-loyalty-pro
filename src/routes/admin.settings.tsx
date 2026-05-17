import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, PageHeader } from "@/components/portal/Shell";
import {
  DEFAULT_MONTHLY_FEE,
  DEFAULT_PATIENT_SUBSCRIPTION,
  DEFAULT_SPLIT_FIXED_FEE,
  DEFAULT_SPLIT_PERCENTAGE,
  calculateClinicNetRecurring,
} from "@/lib/commercial-model";
import { getAdminSettingsStatus } from "@/lib/admin-reports.functions";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  const fetchStatus = useServerFn(getAdminSettingsStatus);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-settings-status"],
    queryFn: () => fetchStatus(),
  });
  const example = calculateClinicNetRecurring({ patients: 100 });

  return (
    <>
      <PageHeader
        title="Configurações"
        subtitle="Status das configurações operacionais da plataforma mãe."
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-display text-xl text-foreground">E-mails transacionais</h2>
          <div className="mt-5 space-y-3 text-sm">
            <SettingRow
              label="Resend"
              value={
                isLoading ? "verificando" : data?.resendConfigured ? "configurado" : "pendente"
              }
              active={Boolean(data?.resendConfigured)}
            />
            <SettingRow
              label="Remetente"
              value={data?.emailFrom ?? "Medyco <no-reply@medyco.com.br>"}
              active
            />
            <SettingRow
              label="E-mail comercial"
              value={data?.salesEmail ?? "contato@medyco.com.br"}
              active
            />
            <SettingRow
              label="URL base"
              value={data?.appBaseUrl ?? "https://medyco.com.br"}
              active
            />
          </div>
        </Card>
        <Card className="p-6">
          <h2 className="font-display text-xl text-foreground">Asaas marketplace</h2>
          <div className="mt-5 space-y-3 text-sm">
            <SettingRow
              label="API key Asaas"
              value={isLoading ? "verificando" : data?.asaasConfigured ? "configurada" : "pendente"}
              active={Boolean(data?.asaasConfigured)}
            />
            <SettingRow
              label="Ambiente"
              value={data?.asaasEnvironment === "production" ? "produção" : "sandbox"}
              active={Boolean(data?.asaasConfigured)}
            />
            <SettingRow
              label="Webhook"
              value={
                isLoading
                  ? "verificando"
                  : data?.asaasWebhookConfigured
                    ? "configurado"
                    : "pendente"
              }
              active={Boolean(data?.asaasWebhookConfigured)}
            />
            <SettingRow
              label="Wallet Medyco"
              value={
                isLoading
                  ? "verificando"
                  : data?.asaasMedycoWalletConfigured
                    ? "configurada"
                    : "pendente"
              }
              active={Boolean(data?.asaasMedycoWalletConfigured)}
            />
            <SettingRow
              label="Split automático"
              value={
                isLoading
                  ? "verificando"
                  : data?.asaasMarketplaceReady
                    ? "pronto para subcontas"
                    : "aguardando configuração"
              }
              active={Boolean(data?.asaasMarketplaceReady)}
            />
          </div>
        </Card>
        <Card className="p-6">
          <h2 className="font-display text-xl text-foreground">Modelo comercial padrão</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Usado em novas clínicas e nas cobranças de pacientes quando o split Asaas estiver ativo.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <MiniMetric label="Mensalidade clínica" value={formatCurrency(DEFAULT_MONTHLY_FEE)} />
            <MiniMetric
              label="Paciente pago"
              value={`${formatCurrency(DEFAULT_SPLIT_FIXED_FEE)} + ${formatPercent(
                DEFAULT_SPLIT_PERCENTAGE,
              )}%`}
            />
            <MiniMetric
              label="Assinatura sugerida"
              value={formatCurrency(DEFAULT_PATIENT_SUBSCRIPTION)}
            />
            <MiniMetric
              label="Exemplo 100 pacientes"
              value={formatCurrency(example.platformCost)}
            />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            No exemplo de 100 pacientes, a clínica gera {formatCurrency(example.grossRecurring)} de
            recorrência e fica com cerca de {formatCurrency(example.clinicEstimatedBalance)} antes
            dos próprios custos e impostos.
          </p>
        </Card>
        <Card className="p-6 lg:col-span-2">
          <h2 className="font-display text-xl text-foreground">Checklist Asaas sandbox</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Comece pelo sandbox. Depois que cobrança, webhook e split estiverem validados, repetimos
            os mesmos passos em produção.
          </p>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <SetupStep
              step="1"
              title="Conta Medyco"
              items={[
                "Gerar API key sandbox da conta principal",
                "Salvar ASAAS_API_KEY no Lovable",
                "Salvar ASAAS_ENVIRONMENT=sandbox",
              ]}
            />
            <SetupStep
              step="2"
              title="Wallet e webhook"
              items={[
                "Pegar walletId sandbox da Medyco",
                "Salvar ASAAS_MEDYCO_WALLET_ID",
                "Apontar webhook para /api/asaas/webhook",
              ]}
            />
            <SetupStep
              step="3"
              title="Clínica teste"
              items={[
                "Criar subconta sandbox da clínica",
                "Salvar API key da clínica em secret próprio",
                "Preencher conta, wallet e status na clínica",
              ]}
            />
          </div>
          <div className="mt-5 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
            Não precisa criar produto manual no Asaas. A Medyco cria cobranças por API e envia o
            split de {formatCurrency(DEFAULT_SPLIT_FIXED_FEE)} +{" "}
            {formatPercent(DEFAULT_SPLIT_PERCENTAGE)}% para a carteira da Medyco.
          </div>
        </Card>
        <Card className="p-6">
          <h2 className="font-display text-xl text-foreground">Próximas conexões</h2>
          <div className="mt-5 space-y-3 text-sm">
            <SettingRow label="Backup" value="configurar rotina Supabase" />
            <SettingRow label="Monitoramento" value="Sentry pendente" />
          </div>
        </Card>
      </div>
    </>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl text-foreground">{value}</div>
    </div>
  );
}

function SetupStep({ step, title, items }: { step: string; title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-xs font-medium text-brand">
          {step}
        </span>
        <div className="font-medium text-foreground">{title}</div>
      </div>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm text-muted-foreground">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SettingRow({
  label,
  value,
  active = false,
}: {
  label: string;
  value: string;
  active?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface px-4 py-3">
      <span className="text-foreground">{label}</span>
      <span className={active ? "text-success" : "text-muted-foreground"}>{value}</span>
    </div>
  );
}

function formatCurrency(value?: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value ?? 0));
}

function formatPercent(value?: number) {
  return Number(value ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}
