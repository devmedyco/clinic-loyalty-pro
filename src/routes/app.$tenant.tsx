import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Icons, PortalShell } from "@/components/portal/Shell";

export const Route = createFileRoute("/app/$tenant")({
  component: ClinicLayout,
});

function ClinicLayout() {
  const { tenant } = Route.useParams();
  const params = { tenant };

  return (
    <PortalShell
      brand={{ name: tenant, subtitle: "Clínica" }}
      user={{ name: "Camila Andrade", role: "Tenant Admin" }}
      items={[
        { to: "/app/$tenant", params, label: "Visão geral", icon: Icons.home },
        { to: "/app/$tenant/patients", params, label: "Pacientes", icon: Icons.users },
        { to: "/app/$tenant/validate", params, label: "Validar QR", icon: Icons.qr },
        { to: "/app/$tenant/executions", params, label: "Atendimentos", icon: Icons.list },
        { to: "/app/$tenant/services", params, label: "Serviços", icon: Icons.tag },
        { to: "/app/$tenant/staff", params, label: "Funcionários", icon: Icons.staff },
        { to: "/app/$tenant/finance", params, label: "Financeiro", icon: Icons.cash },
        { to: "/app/$tenant/settings", params, label: "Configurações", icon: Icons.cog },
      ]}
    >
      <Outlet />
    </PortalShell>
  );
}
