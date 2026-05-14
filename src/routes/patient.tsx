import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Icons, PortalShell } from "@/components/portal/Shell";

export const Route = createFileRoute("/patient")({
  component: PatientLayout,
});

function PatientLayout() {
  return (
    <PortalShell
      brand={{ name: "Clínica Santa Vida", subtitle: "Seu programa" }}
      user={{ name: "Maria Eduarda Costa", role: "Titular" }}
      items={[
        { to: "/patient", label: "Meu cartão", icon: Icons.card },
        { to: "/patient/subscription", label: "Assinatura", icon: Icons.cash },
        { to: "/patient/history", label: "Histórico", icon: Icons.history },
        { to: "/patient/network", label: "Rede credenciada", icon: Icons.building },
        { to: "/patient/profile", label: "Perfil", icon: Icons.cog },
      ]}
    >
      <Outlet />
    </PortalShell>
  );
}
