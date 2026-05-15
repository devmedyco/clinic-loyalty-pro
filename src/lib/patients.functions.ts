import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase-ext/auth-middleware";

const patientStatusSchema = z.enum(["active", "inactive", "delinquent"]);

const optionalText = (max = 160) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional(),
  );

const cpfSchema = z.preprocess(
  (value) => (typeof value === "string" ? onlyDigits(value) : value),
  z.string().length(11, "CPF deve ter 11 dígitos").refine(isValidCpf, "CPF inválido").optional(),
);

const tenantSlugSchema = z.object({
  tenant: z.string().min(1).max(60),
});

const listPatientsSchema = tenantSlugSchema.extend({
  search: optionalText(80),
});

const createPatientSchema = tenantSlugSchema.extend({
  full_name: z.string().trim().min(2).max(160),
  cpf: cpfSchema,
  email: optionalText(160).pipe(z.string().email("E-mail inválido").optional()),
  phone: optionalText(40),
  status: patientStatusSchema.default("active"),
});

const updatePatientSchema = createPatientSchema.extend({
  id: z.string().uuid(),
});

const getPatientSchema = tenantSlugSchema.extend({
  id: z.string().uuid(),
});

export const listPatients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => listPatientsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tenant = await resolveTenant(supabase, data.tenant);

    let query = supabase
      .from("patients")
      .select(
        "id, tenant_id, user_id, full_name, email, phone, cpf, status, created_at, updated_at, benefit_cards(id, card_number, qr_token, active, expires_at, created_at)",
      )
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false });

    const search = sanitizeSearch(data.search);
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,cpf.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data: patients, error } = await query;
    if (error) throw new Error(error.message);

    return { tenant, patients: patients ?? [] };
  });

export const getPatient = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => getPatientSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tenant = await resolveTenant(supabase, data.tenant);
    const { data: patient, error } = await supabase
      .from("patients")
      .select(
        "id, tenant_id, user_id, full_name, email, phone, cpf, status, created_at, updated_at, benefit_cards(id, card_number, qr_token, active, expires_at, created_at)",
      )
      .eq("tenant_id", tenant.id)
      .eq("id", data.id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!patient) throw new Error("Paciente não encontrado");

    return { tenant, patient };
  });

export const createPatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createPatientSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tenant = await resolveTenant(supabase, data.tenant);

    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .insert({
        tenant_id: tenant.id,
        full_name: data.full_name,
        cpf: data.cpf,
        email: data.email,
        phone: data.phone,
        status: data.status,
      })
      .select(
        "id, tenant_id, user_id, full_name, email, phone, cpf, status, created_at, updated_at",
      )
      .single();

    if (patientError) throw new Error(patientError.message);

    const { data: card, error: cardError } = await supabase
      .from("benefit_cards")
      .insert({
        tenant_id: tenant.id,
        patient_id: patient.id,
        card_number: createCardNumber(),
        qr_token: createQrToken(),
        active: true,
      })
      .select("id, card_number, qr_token, active, expires_at, created_at")
      .single();

    if (cardError) {
      await supabase.from("patients").delete().eq("id", patient.id).eq("tenant_id", tenant.id);
      throw new Error(cardError.message);
    }

    const { error: subscriptionError } = await supabase.from("subscriptions").insert({
      tenant_id: tenant.id,
      patient_id: patient.id,
      plan: "benefits",
      status: data.status === "delinquent" ? "past_due" : "active",
      next_due_date: nextDueDate(),
    });

    if (subscriptionError) {
      await supabase.from("patients").delete().eq("id", patient.id).eq("tenant_id", tenant.id);
      throw new Error(subscriptionError.message);
    }

    return { tenant, patient: { ...patient, benefit_cards: [card] } };
  });

export const updatePatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updatePatientSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tenant = await resolveTenant(supabase, data.tenant);

    const { data: patient, error } = await supabase
      .from("patients")
      .update({
        full_name: data.full_name,
        cpf: data.cpf,
        email: data.email,
        phone: data.phone,
        status: data.status,
      })
      .eq("tenant_id", tenant.id)
      .eq("id", data.id)
      .select(
        "id, tenant_id, user_id, full_name, email, phone, cpf, status, created_at, updated_at, benefit_cards(id, card_number, qr_token, active, expires_at, created_at)",
      )
      .single();

    if (error) throw new Error(error.message);
    return { tenant, patient };
  });

export const deletePatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => getPatientSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tenant = await resolveTenant(supabase, data.tenant);

    const { error } = await supabase
      .from("patients")
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

function sanitizeSearch(search?: string) {
  return search?.replace(/[%,()]/g, "").trim();
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function isValidCpf(value: string) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const calcDigit = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i += 1) {
      sum += Number(cpf[i]) * (length + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return calcDigit(9) === Number(cpf[9]) && calcDigit(10) === Number(cpf[10]);
}

function createCardNumber() {
  return `MED-${randomHex(4).toUpperCase()}-${randomHex(2).toUpperCase()}`;
}

function createQrToken() {
  return `medyco_${randomHex(24)}`;
}

function randomHex(bytes: number) {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return Array.from(values)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function nextDueDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
}
