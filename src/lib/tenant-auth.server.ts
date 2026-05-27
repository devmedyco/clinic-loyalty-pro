import type { SupabaseClient } from "@supabase/supabase-js";

export type TenantScopedRole = "tenant_admin" | "tenant_staff";

export async function assertTenantAccess(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string,
  allowedRoles: TenantScopedRole[] = ["tenant_admin", "tenant_staff"],
) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .or(`tenant_id.eq.${tenantId},tenant_id.is.null`);

  if (error) throw new Error(error.message);

  const roles = new Set((data ?? []).map((item) => item.role));
  if (roles.has("super_admin")) return;
  if (allowedRoles.some((role) => roles.has(role))) return;

  throw new Error("Você não tem permissão para executar esta ação nesta clínica.");
}

export async function assertTenantAdmin(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string,
) {
  await assertTenantAccess(supabase, userId, tenantId, ["tenant_admin"]);
}
