import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, CircleDollarSign, Percent, UsersRound, type LucideIcon } from "lucide-react";
import { PublicPage } from "@/components/public/PublicPage";

export const Route = createFileRoute("/planos")({
  component: PlansPage,
});

const included = [
  "Portal da clínica com pacientes, equipe, serviços e atendimentos",
  "Portal do paciente com cartão digital, histórico e assinatura",
  "Validação QR operacional para recepção",
  "Contratos, aceite digital e política de cancelamento",
  "Relatórios de pacientes, pagamentos e atendimentos",
  "Cadastro inteligente com CNPJ e CEP",
  "Base preparada para Asaas, split, inadimplência e renovação",
];

function PlansPage() {
  return (
    <PublicPage
      eyebrow="Modelo comercial"
      title="Uma mensalidade simples e uma taxa por paciente ativo"
      subtitle="A clínica paga R$ 197/mês para usar a plataforma e a Medyco participa apenas quando o paciente paga a assinatura do cartão de benefícios."
    >
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-2xl border border-brand bg-card p-6 shadow-elevated">
          <div className="inline-flex rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
            Modelo padrão
          </div>
          <div className="mt-6 flex items-end gap-2">
            <span className="font-display text-5xl text-foreground">R$ 197</span>
            <span className="pb-2 text-sm text-muted-foreground">/mês por clínica</span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Metric icon={CircleDollarSign} label="Mensalidade" value="R$ 197" />
            <Metric icon={Percent} label="Paciente pago" value="R$ 2,90 + 7,9%" />
          </div>
          <div className="mt-5 rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <UsersRound className="h-4 w-4 text-brand" />
              Paciente sugerido a R$ 39,90/mês
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Esse valor pode variar conforme a estratégia comercial da clínica. A taxa da Medyco só
              entra sobre pacientes com pagamento recebido.
            </p>
          </div>
          <Link
            to="/signup"
            className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Criar plataforma
          </Link>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display text-2xl text-foreground">O que está incluso</h2>
          <div className="mt-5 grid gap-3">
            {included.map((item) => (
              <div key={item} className="flex items-start gap-3 text-sm text-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-surface p-6">
        <h2 className="font-display text-2xl text-foreground">Exemplo rápido</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Com 100 pacientes pagando R$ 39,90/mês, a clínica cria R$ 3.990/mês de recorrência bruta.
          Depois da mensalidade, da taxa fixa por paciente e da participação percentual, mantém
          cerca de R$ 3.188/mês antes dos próprios custos e impostos.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Example label="Receita recorrente" value="R$ 3.990" />
          <Example label="Custo plataforma" value="R$ 802" />
          <Example label="Saldo clínica" value="R$ 3.188/mês" />
        </div>
      </section>

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

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <Icon className="h-4 w-4 text-brand" />
      <div className="mt-3 text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-3xl text-foreground">{value}</div>
    </div>
  );
}

function Example({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl text-foreground">{value}</div>
    </div>
  );
}
