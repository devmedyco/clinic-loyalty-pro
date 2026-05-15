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
  brand_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  plan: z.enum(["starter", "professional", "enterprise"]).optional(),
});

const updateTenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(120),
  logo_url: z
    .preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().url("URL inválida").max(500).optional(),
    )
    .optional(),
  brand_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  email: z
    .preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().email("E-mail inválido").max(160).optional(),
    )
    .optional(),
  phone: z
    .preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().trim().max(40).optional(),
    )
    .optional(),
  cnpj: z
    .preprocess(
      (value) => (typeof value === "string" ? value.replace(/\D/g, "") : value),
      z.string().length(14, "CNPJ deve ter 14 dígitos").optional(),
    )
    .optional(),
  status: z.enum(["trial", "active", "paused", "canceled"]),
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
      .select(
        "id, slug, name, logo_url, brand_color, email, phone, cnpj, settings, plan, status, owner_id",
      )
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!tenant) throw new Error("Clínica não encontrada ou sem acesso");
    return { tenant };
  });

export const updateTenantSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateTenantSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: tenant, error } = await supabase
      .from("tenants")
      .update({
        name: data.name,
        logo_url: data.logo_url,
        brand_color: data.brand_color,
        email: data.email,
        phone: data.phone,
        cnpj: data.cnpj,
        status: data.status,
      })
      .eq("id", data.id)
      .select(
        "id, slug, name, logo_url, brand_color, email, phone, cnpj, settings, plan, status, owner_id",
      )
      .single();

    if (error) throw new Error(error.message);
    return { tenant };
  });
