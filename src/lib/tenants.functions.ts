import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase-ext/auth-middleware";

export const listMyTenants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("tenants")
      .select(
        "id, slug, name, brand_color, plan, status, monthly_fee, split_percentage, commercial_model, created_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { tenants: data ?? [] };
  });

const optionalText = (max = 180) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional(),
  );

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
  monthly_fee: z.coerce.number().min(0).optional(),
  split_percentage: z.coerce.number().min(0).max(100).optional(),
  patient_subscription_suggestion: z.coerce.number().min(0).optional(),
  legal_name: optionalText(180),
  cnpj: optionalText(20),
  email: optionalText(160).pipe(z.string().email("E-mail inválido").optional()),
  phone: optionalText(40),
  zip_code: optionalText(12),
  street: optionalText(180),
  number: optionalText(40),
  complement: optionalText(120),
  neighborhood: optionalText(120),
  city: optionalText(120),
  state: optionalText(2),
});

const updateTenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(120),
  legal_name: optionalText(180),
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
  monthly_fee: z.coerce.number().min(0).optional(),
  split_percentage: z.coerce.number().min(0).max(100).optional(),
  patient_subscription_suggestion: z.coerce.number().min(0).optional(),
  asaas_account_id: optionalText(120),
  asaas_wallet_id: optionalText(120),
  asaas_api_key_ref: optionalText(120),
  asaas_onboarding_status: z
    .enum(["not_started", "pending_documents", "under_review", "active", "rejected", "disabled"])
    .default("not_started"),
  asaas_split_enabled: z.boolean().default(true),
  zip_code: optionalText(12),
  street: optionalText(180),
  number: optionalText(40),
  complement: optionalText(120),
  neighborhood: optionalText(120),
  city: optionalText(120),
  state: optionalText(2),
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
        legal_name: data.legal_name,
        cnpj: data.cnpj?.replace(/\D/g, ""),
        email: data.email,
        phone: data.phone,
        zip_code: data.zip_code?.replace(/\D/g, ""),
        street: data.street,
        number: data.number,
        complement: data.complement,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state?.toUpperCase(),
        brand_color: data.brand_color ?? "#0ea5e9",
        plan: data.plan ?? "starter",
        monthly_fee: data.monthly_fee ?? 197,
        split_percentage: data.split_percentage ?? 10,
        patient_subscription_suggestion: data.patient_subscription_suggestion ?? 39.9,
        commercial_model: "base_plus_split",
        owner_id: userId,
      })
      .select(
        "id, slug, name, brand_color, plan, status, monthly_fee, split_percentage, commercial_model",
      )
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
        "id, slug, name, legal_name, logo_url, brand_color, email, phone, cnpj, zip_code, street, number, complement, neighborhood, city, state, settings, plan, status, monthly_fee, split_percentage, patient_subscription_suggestion, commercial_model, asaas_account_id, asaas_wallet_id, asaas_api_key_ref, asaas_onboarding_status, asaas_split_enabled, owner_id",
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
        legal_name: data.legal_name,
        logo_url: data.logo_url,
        brand_color: data.brand_color,
        email: data.email,
        phone: data.phone,
        cnpj: data.cnpj,
        zip_code: data.zip_code,
        street: data.street,
        number: data.number,
        complement: data.complement,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state?.toUpperCase(),
        status: data.status,
        monthly_fee: data.monthly_fee ?? 197,
        split_percentage: data.split_percentage ?? 10,
        patient_subscription_suggestion: data.patient_subscription_suggestion ?? 39.9,
        commercial_model: "base_plus_split",
        asaas_account_id: data.asaas_account_id,
        asaas_wallet_id: data.asaas_wallet_id,
        asaas_api_key_ref: data.asaas_api_key_ref,
        asaas_onboarding_status: data.asaas_onboarding_status,
        asaas_split_enabled: data.asaas_split_enabled,
      })
      .eq("id", data.id)
      .select(
        "id, slug, name, legal_name, logo_url, brand_color, email, phone, cnpj, zip_code, street, number, complement, neighborhood, city, state, settings, plan, status, monthly_fee, split_percentage, patient_subscription_suggestion, commercial_model, asaas_account_id, asaas_wallet_id, asaas_api_key_ref, asaas_onboarding_status, asaas_split_enabled, owner_id",
      )
      .single();

    if (error) throw new Error(error.message);
    return { tenant };
  });
