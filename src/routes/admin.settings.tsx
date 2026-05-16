import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, PageHeader } from "@/components/portal/Shell";
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
