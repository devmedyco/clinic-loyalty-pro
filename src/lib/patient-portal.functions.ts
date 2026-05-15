import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase-ext/auth-middleware";

const updatePatientProfileSchema = z.object({
  full_name: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email().max(160).optional(),
});

export const getPatientPortal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select(
        "id, tenant_id, full_name, cpf, email, phone, status, created_at, tenants(id, name, slug, logo_url, brand_color), benefit_cards(id, card_number, qr_token, active, expires_at, created_at)",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (patientError) throw new Error(patientError.message);
    if (!patient) {
      return {
        patient: null,
        tenant: null,
        card: null,
        executions: [],
        totals: { savings: 0, executions: 0 },
      };
    }

    const card = Array.isArray(patient.benefit_cards)
      ? patient.benefit_cards[0]
      : patient.benefit_cards;
    const tenant = Array.isArray(patient.tenants) ? patient.tenants[0] : patient.tenants;

    const { data: executions, error: executionsError } = await supabase
      .from("service_executions")
      .select("id, original_amount, discount_amount, final_amount, created_at, services(name)")
      .eq("patient_id", patient.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (executionsError) throw new Error(executionsError.message);

    return {
      patient,
      tenant,
      card,
      executions: executions ?? [],
      totals: {
        savings: (executions ?? []).reduce(
          (total, execution) => total + Number(execution.discount_amount || 0),
          0,
        ),
        executions: executions?.length ?? 0,
      },
    };
  });

export const getPatientNetwork = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("id, tenant_id, tenants(id, name, slug, email, phone)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (patientError) throw new Error(patientError.message);
    if (!patient) return { tenant: null, services: [] };

    const tenant = Array.isArray(patient.tenants) ? patient.tenants[0] : patient.tenants;
    const { data: services, error: servicesError } = await supabase
      .from("services")
      .select("id, name, description, original_price, discount_percentage, final_price")
      .eq("tenant_id", patient.tenant_id)
      .eq("active", true)
      .order("name", { ascending: true });

    if (servicesError) throw new Error(servicesError.message);
    return { tenant, services: services ?? [] };
  });

export const updatePatientPortalProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updatePatientProfileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: patient, error } = await supabase
      .from("patients")
      .update({
        full_name: data.full_name,
        phone: data.phone,
        email: data.email,
      })
      .eq("user_id", userId)
      .select("id, full_name, email, phone, cpf, status")
      .single();

    if (error) throw new Error(error.message);
    return { patient };
  });
