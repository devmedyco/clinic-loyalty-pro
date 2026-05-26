import { Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Icons, PortalShell } from "@/components/portal/Shell";
import { useRequireSession } from "@/hooks/use-auth-session";
import { getPostLoginRoute } from "@/lib/access-routing";
import { getMyAccess } from "@/lib/auth.functions";
import { getPatientPortal } from "@/lib/patient-portal.functions";

export const Route = createFileRoute("/patient")({
  component: PatientLayout,
});

function PatientLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const session = useRequireSession();
  const fetchAccess = useServerFn(getMyAccess);
  const fetchPortal = useServerFn(getPatientPortal);
  const { data } = useQuery({
    queryKey: ["my-access", session.userId, "patient"],
    queryFn: () => fetchAccess(),
    enabled: session.isAuthenticated && Boolean(session.userId),
  });
  const { data: portal, isLoading: portalLoading } = useQuery({
    queryKey: ["patient-portal-shell", session.userId],
    queryFn: () => fetchPortal(),
    enabled: session.isAuthenticated && Boolean(session.userId),
  });

  useEffect(() => {
    if (!data || portal?.patient) return;
    const route = getPostLoginRoute(data);
    if (route !== "/patient") navigate({ to: route as never });
  }, [data, navigate, portal?.patient]);

  useEffect(() => {
    if (!portal?.patient || !portal.legal || portal.legal.accepted) return;
    if (pathname !== "/patient/terms") navigate({ to: "/patient/terms" });
  }, [navigate, pathname, portal?.legal, portal?.patient]);

  if (session.isLoading || portalLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Verificando sessão...</div>;
  }

  if (data && !portal?.patient && getPostLoginRoute(data) !== "/patient") {
    return <div className="p-8 text-sm text-muted-foreground">Redirecionando...</div>;
  }

  if (portal?.patient && portal.legal && !portal.legal.accepted && pathname !== "/patient/terms") {
    return <div className="p-8 text-sm text-muted-foreground">Abrindo termos de uso...</div>;
  }

  return (
    <PortalShell
      brand={{ name: portal?.tenant?.name ?? "Medyco", subtitle: "Seu programa" }}
      user={{ name: portal?.patient?.full_name ?? data?.user.name ?? "Paciente", role: "Titular" }}
      items={[
        { to: "/patient", label: "Meu cartão", icon: Icons.card },
        { to: "/patient/subscription", label: "Assinatura", icon: Icons.cash },
        { to: "/patient/history", label: "Histórico", icon: Icons.history },
        { to: "/patient/network", label: "Rede credenciada", icon: Icons.building },
        { to: "/patient/terms", label: "Termos", icon: Icons.shield },
        { to: "/patient/profile", label: "Perfil", icon: Icons.cog },
      ]}
    >
      <Outlet />
    </PortalShell>
  );
}
