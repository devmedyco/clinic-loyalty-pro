import type { SupabaseClient } from "@supabase/supabase-js";

export async function assertSuperAdminAccess(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .limit(1);

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Acesso restrito ao admin global Medyco.");
  }
}
