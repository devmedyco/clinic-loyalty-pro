import { createFileRoute } from "@tanstack/react-router";
import { Mail, MessageCircle } from "lucide-react";
import { PublicPage } from "@/components/public/PublicPage";

export const Route = createFileRoute("/contato")({
  component: ContactPage,
});

function ContactPage() {
  return (
    <PublicPage
      eyebrow="Contato"
      title="Fale com a Medyco"
      subtitle="Para clínicas que querem operar recorrência, benefícios e cartão digital com uma estrutura moderna."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <a
          href="mailto:contato@medyco.com.br"
          className="rounded-2xl border border-border bg-card p-6 transition hover:border-brand/40 hover:shadow-elevated"
        >
          <Mail className="h-6 w-6 text-brand" />
          <h2 className="mt-4 font-display text-2xl text-foreground">E-mail</h2>
          <p className="mt-2 text-sm text-muted-foreground">contato@medyco.com.br</p>
        </a>
        <a
          href="/signup"
          className="rounded-2xl border border-border bg-card p-6 transition hover:border-brand/40 hover:shadow-elevated"
        >
          <MessageCircle className="h-6 w-6 text-brand" />
          <h2 className="mt-4 font-display text-2xl text-foreground">Criar acesso</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Comece criando sua primeira clínica na plataforma.
          </p>
        </a>
      </div>
    </PublicPage>
  );
}
