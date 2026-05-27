import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Building2, Mail, MapPin, Phone, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Card, PageHeader } from "@/components/portal/Shell";
import { useRequireSession } from "@/hooks/use-auth-session";
import { getPatientNetwork } from "@/lib/patient-portal.functions";

export const Route = createFileRoute("/patient/network")({
  component: PatientNetworkPage,
});

function PatientNetworkPage() {
  const fetchNetwork = useServerFn(getPatientNetwork);
  const session = useRequireSession();
  const [search, setSearch] = useState("");
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["patient-network", session.userId],
    queryFn: () => fetchNetwork(),
    enabled: session.isAuthenticated && Boolean(session.userId),
    refetchOnMount: "always",
  });
  const providers = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = data?.providers ?? [];
    if (!term) return rows;
    return rows.filter((provider) =>
      [
        provider.name,
        provider.specialty,
        provider.city,
        provider.state,
        provider.address,
        providerServices(provider)
          .map((service) => service.name)
          .join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [data?.providers, search]);

  return (
    <>
      <PageHeader
        title="Rede credenciada"
        subtitle={
          data?.tenant
            ? `Credenciados e serviços publicados por ${data.tenant.name}.`
            : "Serviços disponíveis no seu programa."
        }
      />
      {isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground">Carregando rede...</Card>
      ) : error ? (
        <Card className="p-6 text-sm text-destructive">{(error as Error).message}</Card>
      ) : !data?.tenant ? (
        <Card className="p-8">
          <div className="max-w-2xl">
            <h2 className="text-sm font-medium text-foreground">Cadastro ainda sem vínculo</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Não encontramos uma clínica vinculada ao seu acesso
              {data?.currentUserEmail ? ` (${data.currentUserEmail})` : ""}. Se você acabou de criar
              a senha pelo convite, tente atualizar. Se continuar assim, confirme se entrou com o
              mesmo e-mail que recebeu da clínica.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-5 inline-flex items-center gap-2 rounded-lg border border-input px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              {isFetching ? "Atualizando..." : "Tentar atualizar vínculo"}
            </button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <Card className="p-6">
            <h2 className="font-display text-xl text-foreground">{data.tenant.name}</h2>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <div>{data.tenant.email || "E-mail não informado"}</div>
              <div>{data.tenant.phone || "Telefone não informado"}</div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <MiniStat label="Credenciados" value={String(data.providers?.length ?? 0)} />
              <MiniStat label="Serviços" value={String(data.services?.length ?? 0)} />
            </div>
            <div className="mt-6 rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">
              A rede abaixo mostra somente credenciados ativos vinculados ao seu programa atual.
              Caso tenha sido atendido por outra clínica, confirme se entrou com o e-mail correto do
              convite.
            </div>
          </Card>
          <Card className="overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <label className="flex items-center gap-2 rounded-xl border border-input bg-surface-elevated px-3 py-2 text-sm">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nome, especialidade, cidade ou serviço..."
                  className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
                />
              </label>
            </div>
            {(data.providers ?? []).length === 0 ? (
              <div className="px-5 py-10 text-sm text-muted-foreground">
                {data.tenant.name} ainda não publicou credenciados ativos para pacientes. Assim que
                a clínica cadastrar e deixar a rede ativa, ela aparece aqui automaticamente.
              </div>
            ) : providers.length === 0 ? (
              <div className="px-5 py-10 text-sm text-muted-foreground">
                Nenhum credenciado encontrado para a busca atual.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {providers.map((provider) => (
                  <div key={provider.id} className="px-5 py-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                          <Building2 className="h-4 w-4" />
                        </span>
                        <div>
                          <div className="font-medium text-foreground">{provider.name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {provider.specialty || "Especialidade não informada"}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground sm:text-right">
                        <ContactLine icon={MapPin}>
                          {[provider.city, provider.state].filter(Boolean).join(" · ") ||
                            "Local não informado"}
                        </ContactLine>
                        <ContactLine icon={Phone}>
                          {provider.phone || "Telefone pela clínica"}
                        </ContactLine>
                        <ContactLine icon={Mail}>
                          {provider.email || "E-mail pela clínica"}
                        </ContactLine>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground">
                      {provider.address || provider.notes || "Endereço sob consulta"}
                    </div>
                    <div className="mt-4 grid gap-2">
                      {providerServices(provider).length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          Serviços vinculados sob consulta.
                        </span>
                      ) : (
                        providerServices(provider).map((service) => (
                          <div
                            key={service.id}
                            className="rounded-lg border border-border bg-surface px-3 py-2"
                          >
                            <div className="text-sm font-medium text-foreground">
                              {service.name}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs">
                              <span className="rounded-md bg-muted px-2 py-0.5 text-muted-foreground line-through">
                                {formatCurrency(service.original_price)}
                              </span>
                              <span className="rounded-md bg-brand-soft px-2 py-0.5 text-brand">
                                {formatCurrency(service.final_price)}
                              </span>
                              <span className="rounded-md bg-success/15 px-2 py-0.5 text-success">
                                {formatPercent(service.discount_percentage)} off
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl text-foreground">{value}</div>
    </div>
  );
}

function ContactLine({ icon: Icon, children }: { icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 sm:justify-end">
      <Icon className="h-3.5 w-3.5" />
      <span>{children}</span>
    </div>
  );
}

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function formatPercent(value: number | string) {
  return `${Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

function providerServices(provider: {
  provider_services?: Array<{
    services?:
      | {
          id: string;
          name: string;
          original_price: number | string;
          discount_percentage: number | string;
          final_price: number | string;
        }
      | Array<{
          id: string;
          name: string;
          original_price: number | string;
          discount_percentage: number | string;
          final_price: number | string;
        }>
      | null;
  }>;
}) {
  return (provider.provider_services ?? [])
    .map((item) => (Array.isArray(item.services) ? item.services[0] : item.services))
    .filter(Boolean) as Array<{
    id: string;
    name: string;
    original_price: number | string;
    discount_percentage: number | string;
    final_price: number | string;
  }>;
}
