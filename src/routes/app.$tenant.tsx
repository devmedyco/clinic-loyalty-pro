import { Outlet, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Icons, PortalShell } from "@/components/portal/Shell";
import { getTenantBySlug } from "@/lib/tenants.functions";

export const Route = createFileRoute("/app/$tenant")({
  component: ClinicLayout,
});

function ClinicLayout() {
  const { tenant } = Route.useParams();
  const params = { tenant };
  const fetchTenant = useServerFn(getTenantBySlug);
  const { data, isLoading, error } = useQuery({
    queryKey: ["tenant", tenant],
    queryFn: () => fetchTenant({ data: { slug: tenant } }),
  });

  if (isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando clínica…</div>;
  }
  if (error || !data?.tenant) {
    return (
      <div className="p-8">
        <h1 className="font-display text-2xl text-foreground">Acesso negado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {(error as Error)?.message ?? "Esta clínica não existe ou você não tem acesso."}
        </p>
      </div>
    );
  }

  return (
    <PortalShell
      brand={{ name: data.tenant.name, subtitle: "Clínica" }}
      user={{ name: "Você", role: "Tenant Admin" }}
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
