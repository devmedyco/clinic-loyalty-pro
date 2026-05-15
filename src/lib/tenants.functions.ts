import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase-ext/auth-middleware";

export const listMyTenants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("tenants")
      .select("id, slug, name, brand_color, plan, status, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { tenants: data ?? [] };
  });

const createTenantSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Apenas letras minúsculas, números e hífen"),
  brand_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  plan: z.enum(["starter", "professional", "enterprise"]).optional(),
});

export const createTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createTenantSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: tenant, error } = await supabase
      .from("tenants")
      .insert({
        name: data.name,
        slug: data.slug,
        brand_color: data.brand_color ?? "#0ea5e9",
        plan: data.plan ?? "starter",
        owner_id: userId,
      })
      .select("id, slug, name, brand_color, plan, status")
      .single();
    if (error) throw new Error(error.message);
    return { tenant };
  });

export const getTenantBySlug = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ slug: z.string().min(1).max(60) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: tenant, error } = await supabase
      .from("tenants")
      .select("id, slug, name, brand_color, plan, status, owner_id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!tenant) throw new Error("Clínica não encontrada ou sem acesso");
    return { tenant };
  });
