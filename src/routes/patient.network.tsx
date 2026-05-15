import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, PageHeader } from "@/components/portal/Shell";
import { getPatientNetwork } from "@/lib/patient-portal.functions";

export const Route = createFileRoute("/patient/network")({
  component: PatientNetworkPage,
});

function PatientNetworkPage() {
  const fetchNetwork = useServerFn(getPatientNetwork);
  const { data, isLoading, error } = useQuery({
    queryKey: ["patient-network"],
    queryFn: () => fetchNetwork(),
  });

  return (
    <>
      <PageHeader title="Rede credenciada" subtitle="Serviços disponíveis no seu programa." />
      {isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground">Carregando rede...</Card>
      ) : error ? (
        <Card className="p-6 text-sm text-destructive">{(error as Error).message}</Card>
      ) : !data?.tenant ? (
        <Card className="p-8 text-sm text-muted-foreground">
          Seu cadastro de paciente ainda não foi vinculado a uma clínica.
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <Card className="p-6">
            <h2 className="font-display text-xl text-foreground">{data.tenant.name}</h2>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <div>{data.tenant.email || "E-mail não informado"}</div>
              <div>{data.tenant.phone || "Telefone não informado"}</div>
            </div>
          </Card>
          <Card className="overflow-hidden">
            {(data.services ?? []).length === 0 ? (
              <div className="px-5 py-10 text-sm text-muted-foreground">
                Nenhum serviço ativo publicado pela clínica ainda.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {data.services.map((service) => (
                  <div key={service.id} className="px-5 py-4">
                    <div className="font-medium text-foreground">{service.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {service.description || "Serviço com benefício disponível"}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
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
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </>
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
