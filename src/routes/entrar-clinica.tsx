import { createFileRoute } from "@tanstack/react-router";
import { PublicPage } from "@/components/public/PublicPage";

export const Route = createFileRoute("/entrar-clinica")({
  component: ClinicAccessPage,
});

function ClinicAccessPage() {
  return (
    <PublicPage
      eyebrow="Portal Clínica"
      title="Acesse a operação da sua clínica"
      subtitle="Entre para gerenciar pacientes, assinaturas, validação QR, atendimentos, contratos e relatórios."
    >
      <div className="flex flex-wrap gap-3">
        <a
          href="/login?portal=clinic"
          className="rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Entrar como clínica
        </a>
        <a
          href="/signup?portal=clinic"
          className="rounded-lg border border-input px-5 py-3 text-sm font-medium text-foreground transition hover:bg-accent"
        >
          Criar clínica
        </a>
      </div>
    </PublicPage>
  );
}
