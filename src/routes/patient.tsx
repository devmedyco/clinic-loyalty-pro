import { Outlet, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Icons, PortalShell } from "@/components/portal/Shell";
import { useRequireSession } from "@/hooks/use-auth-session";
import { getMyAccess } from "@/lib/auth.functions";

export const Route = createFileRoute("/patient")({
  component: PatientLayout,
});

function PatientLayout() {
  const session = useRequireSession();
  const fetchAccess = useServerFn(getMyAccess);
  const { data } = useQuery({
    queryKey: ["my-access"],
    queryFn: () => fetchAccess(),
    enabled: session.isAuthenticated,
  });

  if (session.isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Verificando sessão...</div>;
  }

  return (
    <PortalShell
      brand={{ name: "Clínica Santa Vida", subtitle: "Seu programa" }}
      user={{ name: data?.user.name ?? "Paciente", role: "Titular" }}
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
