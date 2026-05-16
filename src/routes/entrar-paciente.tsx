import { createFileRoute } from "@tanstack/react-router";
import { PublicPage } from "@/components/public/PublicPage";

export const Route = createFileRoute("/entrar-paciente")({
  component: PatientAccessPage,
});

function PatientAccessPage() {
  return (
    <PublicPage
      eyebrow="Portal Paciente"
      title="Acesse seu cartão de benefícios"
      subtitle="Entre para consultar seu cartão digital, assinatura, pagamentos, histórico e rede credenciada."
    >
      <div className="flex flex-wrap gap-3">
        <a
          href="/login?portal=patient&redirect=/patient"
          className="rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Entrar como paciente
        </a>
        <a
          href="/reset-password?portal=patient"
          className="rounded-lg border border-input px-5 py-3 text-sm font-medium text-foreground transition hover:bg-accent"
        >
          Recuperar senha
        </a>
      </div>
    </PublicPage>
  );
}
