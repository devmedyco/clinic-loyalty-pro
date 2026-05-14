import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Icons, PortalShell } from "@/components/portal/Shell";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <PortalShell
      brand={{ name: "Medyco", subtitle: "Admin Global" }}
      user={{ name: "Equipe Medyco", role: "Super Admin" }}
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
