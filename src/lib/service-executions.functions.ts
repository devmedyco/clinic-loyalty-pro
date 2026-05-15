import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase-ext/auth-middleware";

const tenantSlugSchema = z.object({
  tenant: z.string().min(1).max(60),
});

const createExecutionSchema = tenantSlugSchema.extend({
  patient_id: z.string().uuid(),
  service_id: z.string().uuid(),
  notes: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(500).optional(),
  ),
});

export const listServiceExecutions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => tenantSlugSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tenant = await resolveTenant(supabase, data.tenant);

    const [executionsResult, patientsResult, servicesResult] = await Promise.all([
      supabase
        .from("service_executions")
        .select(
          "id, tenant_id, patient_id, service_id, original_amount, discount_amount, final_amount, notes, created_at, patients(full_name, cpf), services(name)",
        )
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("patients")
        .select("id, full_name, cpf, status")
        .eq("tenant_id", tenant.id)
        .order("full_name", { ascending: true }),
      supabase
        .from("services")
        .select("id, name, original_price, discount_percentage, final_price, active")
        .eq("tenant_id", tenant.id)
        .eq("active", true)
        .order("name", { ascending: true }),
    ]);

    if (executionsResult.error) throw new Error(executionsResult.error.message);
    if (patientsResult.error) throw new Error(patientsResult.error.message);
    if (servicesResult.error) throw new Error(servicesResult.error.message);

    return {
      tenant,
      executions: executionsResult.data ?? [],
      patients: patientsResult.data ?? [],
      services: servicesResult.data ?? [],
    };
  });

export const createServiceExecution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createExecutionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenant = await resolveTenant(supabase, data.tenant);

    const [patientResult, serviceResult] = await Promise.all([
      supabase
        .from("patients")
        .select("id, tenant_id, full_name, status")
        .eq("tenant_id", tenant.id)
        .eq("id", data.patient_id)
        .maybeSingle(),
      supabase
        .from("services")
        .select("id, tenant_id, name, original_price, discount_percentage, final_price, active")
        .eq("tenant_id", tenant.id)
        .eq("id", data.service_id)
        .maybeSingle(),
    ]);

    if (patientResult.error) throw new Error(patientResult.error.message);
    if (serviceResult.error) throw new Error(serviceResult.error.message);
    if (!patientResult.data) throw new Error("Paciente não encontrado");
    if (!serviceResult.data) throw new Error("Serviço não encontrado");
    if (patientResult.data.status !== "active") throw new Error("Paciente não está ativo");
    if (!serviceResult.data.active) throw new Error("Serviço inativo");

    const originalAmount = Number(serviceResult.data.original_price);
    const finalAmount = Number(serviceResult.data.final_price);
    const discountAmount = Math.max(0, Math.round((originalAmount - finalAmount) * 100) / 100);

    const { data: execution, error } = await supabase
      .from("service_executions")
      .insert({
        tenant_id: tenant.id,
        patient_id: data.patient_id,
        service_id: data.service_id,
        original_amount: originalAmount,
        discount_amount: discountAmount,
        final_amount: finalAmount,
        created_by: userId,
        notes: data.notes,
      })
      .select(
        "id, tenant_id, patient_id, service_id, original_amount, discount_amount, final_amount, notes, created_at, patients(full_name, cpf), services(name)",
      )
      .single();

    if (error) throw new Error(error.message);
    return { tenant, execution };
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
