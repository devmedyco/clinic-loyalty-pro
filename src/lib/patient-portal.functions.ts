import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase-ext/auth-middleware";
import { getRequiredLegalStatus } from "@/lib/legal.functions";

const updatePatientProfileSchema = z.object({
  full_name: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email().max(160).optional(),
  avatar_url: z.string().url().max(500).optional(),
});

export const getPatientPortal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select(
        "id, tenant_id, full_name, cpf, email, phone, status, created_at, tenants(id, name, slug, logo_url, brand_color), benefit_cards(id, card_number, qr_token, active, expires_at, created_at), subscriptions(id, plan, status, next_due_date)",
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
        subscription: null,
        payments: [],
        executions: [],
        totals: { savings: 0, paid: 0, executions: 0 },
      };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .eq("id", userId)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);

    const card = Array.isArray(patient.benefit_cards)
      ? patient.benefit_cards[0]
      : patient.benefit_cards;
    const tenant = Array.isArray(patient.tenants) ? patient.tenants[0] : patient.tenants;
    const subscription = Array.isArray(patient.subscriptions)
      ? patient.subscriptions[0]
      : patient.subscriptions;
    const legal = await getRequiredLegalStatus(supabase, patient.id, userId, patient.tenant_id);

    const [{ data: executions, error: executionsError }, { data: payments, error: paymentsError }] =
      await Promise.all([
        supabase
          .from("service_executions")
          .select("id, original_amount, discount_amount, final_amount, created_at, services(name)")
          .eq("patient_id", patient.id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("payments")
          .select(
            "id, amount, payment_method, status, paid_at, due_date, asaas_invoice_url, asaas_bank_slip_url, created_at",
          )
          .eq("patient_id", patient.id)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

    if (executionsError) throw new Error(executionsError.message);
    if (paymentsError) throw new Error(paymentsError.message);

    return {
      patient,
      profile,
      tenant,
      card,
      subscription,
      legal,
      payments: payments ?? [],
      executions: executions ?? [],
      totals: {
        savings: (executions ?? []).reduce(
          (total, execution) => total + Number(execution.discount_amount || 0),
          0,
        ),
        paid: (payments ?? []).reduce(
          (total, payment) =>
            payment.status === "paid" ? total + Number(payment.amount || 0) : total,
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
    if (!patient) return { tenant: null, services: [], providers: [] };

    const tenant = Array.isArray(patient.tenants) ? patient.tenants[0] : patient.tenants;
    const { data: services, error: servicesError } = await supabase
      .from("services")
      .select("id, name, description, original_price, discount_percentage, final_price")
      .eq("tenant_id", patient.tenant_id)
      .eq("active", true)
      .order("name", { ascending: true });

    const { data: providers, error: providersError } = await supabase
      .from("providers")
      .select(
        "id, name, specialty, email, phone, address, city, state, notes, provider_services(service_id, services(id, name, description, original_price, discount_percentage, final_price))",
      )
      .eq("tenant_id", patient.tenant_id)
      .eq("active", true)
      .order("name", { ascending: true });

    if (servicesError) throw new Error(servicesError.message);
    if (providersError) throw new Error(providersError.message);
    return { tenant, services: services ?? [], providers: providers ?? [] };
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

    if (data.avatar_url) {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ avatar_url: data.avatar_url, full_name: data.full_name, email: data.email })
        .eq("id", userId);
      if (profileError) throw new Error(profileError.message);
    }

    return { patient };
  });
