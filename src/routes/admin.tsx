import { Outlet, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Icons, PortalShell } from "@/components/portal/Shell";
import { useRequireSession } from "@/hooks/use-auth-session";
import { getMyAccess } from "@/lib/auth.functions";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
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

  const user = data?.user;

  return (
    <PortalShell
      brand={{ name: "Medyco", subtitle: "Admin Global" }}
      user={{
        name: user?.name ?? "Equipe Medyco",
        role: data?.isSuperAdmin ? "Super Admin" : "Operador",
      }}
      items={[
        { to: "/admin", label: "Visão geral", icon: Icons.home },
        { to: "/admin/tenants", label: "Tenants", icon: Icons.building },
        { to: "/admin/billing", label: "Billing SaaS", icon: Icons.cash },
        { to: "/admin/metrics", label: "Métricas", icon: Icons.chart },
        { to: "/admin/audit", label: "Auditoria", icon: Icons.shield },
        { to: "/admin/settings", label: "Configurações", icon: Icons.cog },
      ]}
    >
      <Outlet />
    </PortalShell>
  );
}
