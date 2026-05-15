import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
});

function AuthLayout() {
  const context = getAuthContext();

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
            <Link to="/" className="hover:text-foreground transition">
              ← Voltar ao site
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function getAuthContext() {
  if (typeof window === "undefined") return contexts.clinic;

  const params = new URLSearchParams(window.location.search);
  const portal = params.get("portal");
  const redirect = params.get("redirect") ?? "";

  if (portal === "patient" || redirect.startsWith("/patient")) return contexts.patient;
  if (portal === "admin" || redirect.startsWith("/admin")) return contexts.admin;
  return contexts.clinic;
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
