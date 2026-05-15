import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, PageHeader, StatCard } from "@/components/portal/Shell";
import { getPatientPortal } from "@/lib/patient-portal.functions";

export const Route = createFileRoute("/patient/")({
  component: PatientCard,
});

function PatientCard() {
  const fetchPortal = useServerFn(getPatientPortal);
  const { data, isLoading, error } = useQuery({
    queryKey: ["patient-portal"],
    queryFn: () => fetchPortal(),
  });

  if (isLoading) {
    return <Card className="p-6 text-sm text-muted-foreground">Carregando cartão...</Card>;
  }

  if (error) {
    return <Card className="p-6 text-sm text-destructive">{(error as Error).message}</Card>;
  }

  if (!data?.patient || !data.card) {
    return (
      <>
        <PageHeader title="Seu cartão" subtitle="Seu acesso de paciente ainda não foi vinculado." />
        <Card className="p-8 text-sm text-muted-foreground">
          Quando uma clínica vincular seu usuário a um paciente, o cartão digital aparecerá aqui.
        </Card>
      </>
    );
  }

  const active =
    data.card.active &&
    (!data.card.expires_at || new Date(data.card.expires_at).getTime() > Date.now());

  return (
    <>
      <PageHeader title="Seu cartão" subtitle="Apresente este token na recepção da clínica." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div
            className="relative aspect-[1.6/1] max-w-md overflow-hidden rounded-3xl p-7 text-white shadow-elevated"
            style={{
              background: data.tenant?.brand_color ?? "linear-gradient(135deg, #0f172a, #0ea5e9)",
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-widest opacity-80">
                  {data.tenant?.name ?? "Medyco"}
                </div>
                <div className="mt-1 font-display text-2xl">Cartão Benefícios</div>
              </div>
              <div className="rounded-md bg-white/15 px-2 py-1 text-[10px] uppercase tracking-wider">
                {active ? "Ativo" : "Inativo"}
              </div>
            </div>
            <div className="mt-12">
              <div className="text-[10px] uppercase tracking-widest opacity-80">Titular</div>
              <div className="mt-0.5 text-lg font-medium">{data.patient.full_name}</div>
            </div>
            <div className="mt-3 flex items-end justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-widest opacity-80">Cartão</div>
                <div className="truncate font-medium">{data.card.card_number}</div>
                <div className="mt-1 truncate text-xs opacity-80">{data.card.qr_token}</div>
              </div>
              <QrMark />
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => navigator.clipboard?.writeText(data.card.qr_token)}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              Copiar token
            </button>
            <button
              onClick={() => navigator.clipboard?.writeText(data.card.card_number)}
              className="rounded-lg border border-input bg-surface-elevated px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-accent"
            >
              Copiar número
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <StatCard
            label="Economia gerada"
            value={formatCurrency(data.totals.savings)}
            delta="histórico"
            tone="success"
          />
          <StatCard
            label="Atendimentos"
            value={String(data.totals.executions)}
            delta="registrados"
          />
          <Card className="p-5">
            <div className="text-sm font-medium text-foreground">Status do cartão</div>
            <div className="mt-2 font-display text-2xl text-foreground">
              {active ? "Ativo" : "Inativo"}
            </div>
            <div className="text-xs text-muted-foreground">
              {data.card.expires_at
                ? `expira em ${formatDate(data.card.expires_at)}`
                : "sem expiração definida"}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function QrMark() {
  const filled = [
    0, 2, 3, 5, 7, 8, 11, 13, 16, 17, 19, 20, 22, 24, 28, 30, 32, 35, 37, 40, 42, 44, 46, 48,
  ];
  return (
    <div className="grid h-20 w-20 shrink-0 grid-cols-7 grid-rows-7 gap-px rounded-md bg-white p-1.5">
      {Array.from({ length: 49 }).map((_, index) => (
        <span key={index} className={filled.includes(index) ? "bg-primary" : "bg-transparent"} />
      ))}
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}
