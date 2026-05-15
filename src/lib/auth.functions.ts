import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase-ext/auth-middleware";

export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, user, userId } = context;

    const [{ data: profile, error: profileError }, { data: roles, error: rolesError }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, email, full_name, avatar_url")
          .eq("id", userId)
          .maybeSingle(),
        supabase.from("user_roles").select("role, tenant_id").eq("user_id", userId),
      ]);

    if (profileError) throw new Error(profileError.message);
    if (rolesError) throw new Error(rolesError.message);

    const { data: tenants, error: tenantsError } = await supabase
      .from("tenants")
      .select("id, slug, name, brand_color, plan, status")
      .order("created_at", { ascending: false });

    if (tenantsError) throw new Error(tenantsError.message);

    return {
      user: {
        id: userId,
        email: user.email ?? profile?.email ?? "",
        name: profile?.full_name || user.email || "Usuário",
        avatar_url: profile?.avatar_url ?? null,
      },
      roles: roles ?? [],
      tenants: tenants ?? [],
      isSuperAdmin: Boolean(roles?.some((role) => role.role === "super_admin")),
    };
  });

export type MyAccess = Awaited<ReturnType<typeof getMyAccess>>;
