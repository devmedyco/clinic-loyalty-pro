import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";
import { getPortalFromAuthSearch } from "@/lib/auth-portal";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
});

function AuthLayout() {
  const search = useRouterState({ select: (state) => state.location.search });
  const context = contexts[getPortalFromAuthSearch(search)];

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div
        className={`relative hidden overflow-hidden border-r border-border p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between ${context.panelClass}`}
      >
        <div className="absolute inset-0 opacity-25 surface-grid" aria-hidden />
        <div className="relative">
          <Logo />
        </div>
        <div className="relative">
          <div className="mb-4 text-xs uppercase tracking-[0.24em] opacity-70">
            {context.kicker}
          </div>
          <p className="font-display text-3xl leading-tight">{context.headline}</p>
          <div className="mt-4 max-w-md text-sm leading-6 opacity-80">{context.copy}</div>
        </div>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <Outlet />
          <div className="mt-10 text-center text-xs text-muted-foreground">
            <a href="/" className="hover:text-foreground transition">
              ← Voltar ao site
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

const contexts = {
  clinic: {
    panelClass: "bg-primary",
    kicker: "Portal Clínica",
    headline: "Operação de benefícios, validações e recorrência em um só lugar.",
    copy: "Acesse a área da clínica para gerenciar pacientes, cartões, serviços, equipe e atendimentos.",
  },
  patient: {
    panelClass: "bg-[linear-gradient(135deg,#0f766e,#0ea5e9)]",
    kicker: "Portal Paciente",
    headline: "Seu cartão de benefícios sempre à mão.",
    copy: "Entre para consultar seu cartão digital, acompanhar pagamentos, histórico de uso e serviços disponíveis.",
  },
  admin: {
    panelClass: "bg-[linear-gradient(135deg,#111827,#2563eb)]",
    kicker: "Admin Medyco",
    headline: "Gestão da plataforma mãe, tenants e operação SaaS.",
    copy: "Área interna da Medyco para acompanhar clínicas, métricas, auditoria, billing e configurações globais.",
  },
};
