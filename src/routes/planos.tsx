import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { PublicPage } from "@/components/public/PublicPage";

export const Route = createFileRoute("/planos")({
  component: PlansPage,
});

const plans = [
  {
    name: "Starter",
    price: "R$ 297/mês",
    items: ["Até 200 pacientes", "Cartão digital", "Validação QR", "Painel da clínica"],
  },
  {
    name: "Professional",
    price: "R$ 697/mês",
    items: ["Até 2.000 pacientes", "Contratos por clínica", "Cobrança Asaas", "Relatórios CSV"],
  },
  {
    name: "Enterprise",
    price: "Sob consulta",
    items: ["Rede multiunidade", "White-label avançado", "Domínio customizado", "Suporte dedicado"],
  },
];

function PlansPage() {
  return (
    <PublicPage
      eyebrow="Planos"
      title="Planos para clínicas criarem seu próprio cartão de benefícios"
      subtitle="Valores comerciais de referência. Ajuste final depende de volume, operação e integrações."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <div key={plan.name} className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display text-2xl text-foreground">{plan.name}</h2>
            <div className="mt-3 text-2xl font-semibold text-foreground">{plan.price}</div>
            <div className="mt-5 space-y-3">
              {plan.items.map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to="/signup"
          className="rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Criar plataforma
        </Link>
        <Link
          to="/contato"
          className="rounded-lg border border-input px-5 py-3 text-sm font-medium text-foreground transition hover:bg-accent"
        >
          Falar com a Medyco
        </Link>
      </div>
    </PublicPage>
  );
}
