import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card, PageHeader, StatCard } from "@/components/portal/Shell";
import { useRequireSession } from "@/hooks/use-auth-session";
import { formatDateOnly } from "@/lib/date-format";
import { getPatientPortal } from "@/lib/patient-portal.functions";

export const Route = createFileRoute("/patient/")({
  component: PatientCard,
});

function PatientCard() {
  const fetchPortal = useServerFn(getPatientPortal);
  const session = useRequireSession();
  const { data, isLoading, error } = useQuery({
    queryKey: ["patient-portal", session.userId],
    queryFn: () => fetchPortal(),
    enabled: session.isAuthenticated && Boolean(session.userId),
    refetchOnMount: "always",
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

  const card = data.card;
  const hasPaidPayment = (data.payments ?? []).some((payment) => payment.status === "paid");
  const subscriptionPaid = data.subscription?.status === "active" && hasPaidPayment;
  const active =
    card.active &&
    (!card.expires_at || new Date(card.expires_at).getTime() > Date.now()) &&
    data.legal?.accepted &&
    subscriptionPaid;

  return (
    <>
      <PageHeader title="Seu cartão" subtitle="Apresente o QR Code ou o número do cartão." />
      {!data.legal?.accepted && (
        <Card className="mb-6 border-warning/30 bg-warning/10 p-5">
          <div className="text-sm font-medium text-foreground">Assinatura pendente</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Para liberar o uso do cartão, aceite o termo de uso do benefício.
          </p>
          <Link
            to="/patient/terms"
            className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Assinar termo
          </Link>
        </Card>
      )}
      {data.legal?.accepted && !subscriptionPaid && (
        <Card className="mb-6 border-warning/30 bg-warning/10 p-5">
          <div className="text-sm font-medium text-foreground">Pagamento pendente</div>
          <p className="mt-1 text-sm text-muted-foreground">
            O cartão será liberado automaticamente quando a primeira mensalidade for confirmada.
          </p>
          <Link
            to="/patient/subscription"
            className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Ver cobrança
          </Link>
        </Card>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DigitalBenefitCard
            patientName={data.patient.full_name}
            cardNumber={card.card_number}
            qrToken={card.qr_token}
            tenantName={data.tenant?.name}
            tenantLogoUrl={data.tenant?.logo_url}
            tenantBrandColor={data.tenant?.brand_color}
            active={Boolean(active)}
          />
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => navigator.clipboard?.writeText(card.qr_token)}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              Copiar token
            </button>
            <button
              onClick={() => navigator.clipboard?.writeText(card.card_number)}
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
              {card.expires_at
                ? `expira em ${formatDateOnly(card.expires_at, {
                    day: "2-digit",
                    month: "short",
                  })}`
                : "sem expiração definida"}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function DigitalBenefitCard({
  patientName,
  cardNumber,
  qrToken,
  tenantName,
  tenantLogoUrl,
  tenantBrandColor,
  active,
}: {
  patientName: string;
  cardNumber: string;
  qrToken: string;
  tenantName?: string | null;
  tenantLogoUrl?: string | null;
  tenantBrandColor?: string | null;
  active: boolean;
}) {
  const [qrCodeUrl, setQrCodeUrl] = useState("");

  useEffect(() => {
    let mounted = true;
    import("qrcode")
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(qrToken, {
          margin: 1,
          width: 220,
          color: { dark: "#0f172a", light: "#ffffff" },
        }),
      )
      .then((url) => {
        if (mounted) setQrCodeUrl(url);
      })
      .catch(() => {
        if (mounted) setQrCodeUrl("");
      });
    return () => {
      mounted = false;
    };
  }, [qrToken]);

  return (
    <div
      className="relative aspect-[1.6/1] max-w-md overflow-hidden rounded-3xl p-7 text-white shadow-elevated"
      style={{ background: cardBackground(tenantBrandColor) }}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          {tenantLogoUrl ? (
            <img
              src={tenantLogoUrl}
              alt={tenantName ?? "Clínica"}
              className="mb-3 max-h-10 max-w-32 rounded-md bg-white/90 object-contain p-1.5"
            />
          ) : null}
          <div className="text-[10px] uppercase tracking-widest opacity-80">
            {tenantName ?? "Medyco"}
          </div>
          <div className="mt-1 font-display text-2xl">Cartão Benefícios</div>
        </div>
        <div className="rounded-md bg-white/15 px-2 py-1 text-[10px] uppercase tracking-wider">
          {active ? "Ativo" : "Inativo"}
        </div>
      </div>
      <div className="mt-12">
        <div className="text-[10px] uppercase tracking-widest opacity-80">Titular</div>
        <div className="mt-0.5 text-lg font-medium">{patientName}</div>
      </div>
      <div className="mt-3 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest opacity-80">Número do cartão</div>
          <div className="font-display text-2xl tracking-wide">{cardNumber}</div>
          <div className="mt-1 text-xs opacity-80">QR Code seguro para validação</div>
        </div>
        {qrCodeUrl ? (
          <img
            src={qrCodeUrl}
            alt="QR Code do cartão"
            className="h-24 w-24 shrink-0 rounded-lg bg-white p-1.5"
          />
        ) : (
          <QrMark />
        )}
      </div>
    </div>
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

function cardBackground(brandColor?: string | null) {
  const color = brandColor?.trim() || "#0ea5e9";
  return `linear-gradient(135deg, #0f172a 0%, ${color} 55%, #14b8a6 100%)`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}
