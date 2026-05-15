import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, PageHeader, StatCard } from "@/components/portal/Shell";
import { getPatientPortal } from "@/lib/patient-portal.functions";

export const Route = createFileRoute("/patient/subscription")({
  component: PatientSubscriptionPage,
});

function PatientSubscriptionPage() {
  const fetchPortal = useServerFn(getPatientPortal);
  const { data, isLoading, error } = useQuery({
    queryKey: ["patient-subscription"],
    queryFn: () => fetchPortal(),
  });

  const active =
    Boolean(data?.card?.active) &&
    (!data?.card?.expires_at || new Date(data.card.expires_at).getTime() > Date.now()) &&
    data?.patient?.status === "active";

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
            delta={data.patient.status}
            tone={active ? "success" : "muted"}
          />
          <StatCard label="Clínica" value={data.tenant?.name ?? "Medyco"} delta="programa atual" />
          <StatCard
            label="Economia"
            value={formatCurrency(data.totals.savings)}
            delta="histórico"
            tone="success"
          />
          <Card className="p-6 md:col-span-3">
            <h2 className="font-display text-xl text-foreground">Cobrança recorrente</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              A gestão de cobrança do paciente será conectada ao gateway brasileiro no próximo bloco
              de pagamentos. Enquanto isso, esta tela usa o status real do cadastro e do cartão.
            </p>
          </Card>
        </div>
      )}
    </>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}
