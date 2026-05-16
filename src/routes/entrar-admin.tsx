import { createFileRoute } from "@tanstack/react-router";
import { PublicPage } from "@/components/public/PublicPage";

export const Route = createFileRoute("/entrar-admin")({
  component: AdminAccessPage,
});

function AdminAccessPage() {
  return (
    <PublicPage
      eyebrow="Admin Medyco"
      title="Acesso interno da plataforma mãe"
      subtitle="Área reservada para administração global, tenants, métricas, billing, notificações e auditoria."
    >
      <a
        href="/login?portal=admin&redirect=/admin"
        className="inline-flex rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90"
      >
        Entrar no admin
      </a>
    </PublicPage>
  );
}
