import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase-ext/auth-middleware";

const tenantSlugSchema = z.object({
  tenant: z.string().min(1).max(60),
});

const optionalText = (max = 180) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional(),
  );

const providerSchema = tenantSlugSchema.extend({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(180),
  specialty: optionalText(120),
  document: optionalText(40),
  email: optionalText(160).pipe(z.string().email("E-mail inválido").optional()),
  phone: optionalText(40),
  address: optionalText(240),
  city: optionalText(120),
  state: optionalText(2),
  notes: optionalText(500),
  active: z.boolean().default(true),
  service_ids: z.array(z.string().uuid()).default([]),
});

const deleteProviderSchema = tenantSlugSchema.extend({
  id: z.string().uuid(),
});

export const listProviders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => tenantSlugSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tenant = await resolveTenant(supabase, data.tenant);
    const [providersResult, servicesResult] = await Promise.all([
      supabase
        .from("providers")
        .select(
          "id, name, specialty, document, email, phone, address, city, state, notes, active, created_at, provider_services(service_id, services(id, name))",
        )
        .eq("tenant_id", tenant.id)
        .order("name", { ascending: true }),
      supabase
        .from("services")
        .select("id, name, active")
        .eq("tenant_id", tenant.id)
        .eq("active", true)
        .order("name", { ascending: true }),
    ]);

    if (providersResult.error) throw new Error(providersResult.error.message);
    if (servicesResult.error) throw new Error(servicesResult.error.message);

    return { tenant, providers: providersResult.data ?? [], services: servicesResult.data ?? [] };
  });

export const saveProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => providerSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tenant = await resolveTenant(supabase, data.tenant);

    const payload = {
      tenant_id: tenant.id,
      name: data.name,
      specialty: data.specialty,
      document: data.document,
      email: data.email,
      phone: data.phone,
      address: data.address,
      city: data.city,
      state: data.state?.toUpperCase(),
      notes: data.notes,
      active: data.active,
    };

    const { data: provider, error } = data.id
      ? await supabase
          .from("providers")
          .update(payload)
          .eq("tenant_id", tenant.id)
          .eq("id", data.id)
          .select("id")
          .single()
      : await supabase.from("providers").insert(payload).select("id").single();
    if (error) throw new Error(error.message);

    const { error: deleteError } = await supabase
      .from("provider_services")
      .delete()
      .eq("tenant_id", tenant.id)
      .eq("provider_id", provider.id);
    if (deleteError) throw new Error(deleteError.message);

    if (data.service_ids.length > 0) {
      const { error: serviceError } = await supabase.from("provider_services").insert(
        data.service_ids.map((serviceId) => ({
          tenant_id: tenant.id,
          provider_id: provider.id,
          service_id: serviceId,
        })),
      );
      if (serviceError) throw new Error(serviceError.message);
    }

    return { tenant, provider };
  });

export const deleteProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => deleteProviderSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tenant = await resolveTenant(supabase, data.tenant);
    const { error } = await supabase
      .from("providers")
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
