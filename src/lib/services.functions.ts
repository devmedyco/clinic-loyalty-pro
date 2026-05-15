import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase-ext/auth-middleware";

const tenantSlugSchema = z.object({
  tenant: z.string().min(1).max(60),
});

const optionalText = (max = 400) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional(),
  );

const servicePayloadSchema = tenantSlugSchema.extend({
  name: z.string().trim().min(2).max(140),
  description: optionalText(),
  original_price: z.coerce.number().min(0).max(999999),
  discount_percentage: z.coerce.number().min(0).max(100),
  active: z.boolean().default(true),
});

const updateServiceSchema = servicePayloadSchema.extend({
  id: z.string().uuid(),
});

const serviceIdSchema = tenantSlugSchema.extend({
  id: z.string().uuid(),
});

export const listServices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => tenantSlugSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tenant = await resolveTenant(supabase, data.tenant);

    const { data: services, error } = await supabase
      .from("services")
      .select(
        "id, tenant_id, name, description, original_price, discount_percentage, final_price, active, created_at, updated_at",
      )
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return { tenant, services: services ?? [] };
  });

export const createService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => servicePayloadSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tenant = await resolveTenant(supabase, data.tenant);
    const finalPrice = calculateFinalPrice(data.original_price, data.discount_percentage);

    const { data: service, error } = await supabase
      .from("services")
      .insert({
        tenant_id: tenant.id,
        name: data.name,
        description: data.description,
        original_price: data.original_price,
        discount_percentage: data.discount_percentage,
        final_price: finalPrice,
        active: data.active,
      })
      .select(
        "id, tenant_id, name, description, original_price, discount_percentage, final_price, active, created_at, updated_at",
      )
      .single();

    if (error) throw new Error(error.message);
    return { tenant, service };
  });

export const updateService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateServiceSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tenant = await resolveTenant(supabase, data.tenant);
    const finalPrice = calculateFinalPrice(data.original_price, data.discount_percentage);

    const { data: service, error } = await supabase
      .from("services")
      .update({
        name: data.name,
        description: data.description,
        original_price: data.original_price,
        discount_percentage: data.discount_percentage,
        final_price: finalPrice,
        active: data.active,
      })
      .eq("tenant_id", tenant.id)
      .eq("id", data.id)
      .select(
        "id, tenant_id, name, description, original_price, discount_percentage, final_price, active, created_at, updated_at",
      )
      .single();

    if (error) throw new Error(error.message);
    return { tenant, service };
  });

export const deleteService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => serviceIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tenant = await resolveTenant(supabase, data.tenant);

    const { error } = await supabase
      .from("services")
      .delete()
      .eq("tenant_id", tenant.id)
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    return { tenant, deleted: true };
  });

async function resolveTenant(supabase: SupabaseClient, slug: string) {
  const { data, error } = await supabase
    .from("tenants")
    .select("id, slug, name, brand_color, plan, status")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Clínica não encontrada ou sem acesso");
  return data;
}

function calculateFinalPrice(originalPrice: number, discountPercentage: number) {
  const discount = originalPrice * (discountPercentage / 100);
  return Math.max(0, Math.round((originalPrice - discount) * 100) / 100);
}
