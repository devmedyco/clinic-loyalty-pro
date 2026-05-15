import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase-ext/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase-ext/client.server";
import { patientInviteEmail } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email.server";

const patientStatusSchema = z.enum(["active", "inactive", "delinquent"]);

const optionalText = (max = 160) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional(),
  );

const cpfSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const digits = onlyDigits(value);
  return digits || undefined;
}, z.string().length(11, "CPF deve ter 11 dígitos").refine(isValidCpf, "CPF inválido").optional());

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

const invitePatientSchema = getPatientSchema;

const acceptPatientInvitationSchema = z.object({
  token: z.string().min(16).max(200),
});

const importPatientsSchema = tenantSlugSchema.extend({
  patients: z
    .array(
      z.object({
        full_name: z.string().trim().min(2).max(160),
        cpf: cpfSchema,
        email: optionalText(160).pipe(z.string().email("E-mail inválido").optional()),
        phone: optionalText(40),
        status: patientStatusSchema.default("active"),
      }),
    )
    .min(1)
    .max(500),
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
        "id, tenant_id, user_id, full_name, email, phone, cpf, status, created_at, updated_at, benefit_cards(id, card_number, qr_token, active, expires_at, created_at), patient_invitations(id, email, status, expires_at, created_at)",
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

export const getPatientDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => getPatientSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tenant = await resolveTenant(supabase, data.tenant);

    const { data: patient, error } = await supabase
      .from("patients")
      .select(
        "id, tenant_id, user_id, full_name, email, phone, cpf, status, created_at, updated_at, asaas_customer_id, benefit_cards(id, card_number, qr_token, active, expires_at, created_at)",
      )
      .eq("tenant_id", tenant.id)
      .eq("id", data.id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!patient) throw new Error("Paciente não encontrado");

    const cardIds = (patient.benefit_cards ?? []).map((card) => card.id);
    const [
      subscriptionsResult,
      paymentsResult,
      executionsResult,
      acceptancesResult,
      invitationsResult,
      validationsResult,
    ] = await Promise.all([
      supabase
        .from("subscriptions")
        .select("id, plan, status, next_due_date, asaas_subscription_id, created_at, updated_at")
        .eq("tenant_id", tenant.id)
        .eq("patient_id", patient.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("payments")
        .select(
          "id, subscription_id, amount, payment_method, status, paid_at, due_date, confirmed_at, asaas_invoice_url, notes, created_at",
        )
        .eq("tenant_id", tenant.id)
        .eq("patient_id", patient.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("service_executions")
        .select(
          "id, service_id, original_amount, discount_amount, final_amount, notes, created_at, services(name)",
        )
        .eq("tenant_id", tenant.id)
        .eq("patient_id", patient.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("legal_acceptances")
        .select("id, accepted_at, ip_address, user_agent, legal_documents(title, version, type)")
        .eq("tenant_id", tenant.id)
        .eq("patient_id", patient.id)
        .order("accepted_at", { ascending: false }),
      supabase
        .from("patient_invitations")
        .select("id, email, status, expires_at, accepted_at, created_at")
        .eq("tenant_id", tenant.id)
        .eq("patient_id", patient.id)
        .order("created_at", { ascending: false }),
      cardIds.length
        ? supabase
            .from("card_validations")
            .select(
              "id, card_id, validated_at, outcome, reason, qr_token_snapshot, notes, benefit_cards(card_number)",
            )
            .eq("tenant_id", tenant.id)
            .in("card_id", cardIds)
            .order("validated_at", { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (subscriptionsResult.error) throw new Error(subscriptionsResult.error.message);
    if (paymentsResult.error) throw new Error(paymentsResult.error.message);
    if (executionsResult.error) throw new Error(executionsResult.error.message);
    if (acceptancesResult.error) throw new Error(acceptancesResult.error.message);
    if (invitationsResult.error) throw new Error(invitationsResult.error.message);
    if (validationsResult.error) throw new Error(validationsResult.error.message);

    return {
      tenant,
      patient,
      subscriptions: subscriptionsResult.data ?? [],
      payments: paymentsResult.data ?? [],
      executions: executionsResult.data ?? [],
      acceptances: acceptancesResult.data ?? [],
      invitations: invitationsResult.data ?? [],
      validations: validationsResult.data ?? [],
      totals: {
        paid: sumPaid(paymentsResult.data ?? []),
        pending: (paymentsResult.data ?? []).filter((payment) => payment.status === "pending")
          .length,
        savings: sumNumeric(executionsResult.data ?? [], "discount_amount"),
        executions: executionsResult.data?.length ?? 0,
        validations: validationsResult.data?.length ?? 0,
      },
    };
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

export const invitePatientToPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => invitePatientSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenant = await resolveTenant(supabase, data.tenant);

    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("id, tenant_id, full_name, email, user_id")
      .eq("tenant_id", tenant.id)
      .eq("id", data.id)
      .maybeSingle();
    if (patientError) throw new Error(patientError.message);
    if (!patient) throw new Error("Paciente não encontrado.");
    if (!patient.email) throw new Error("Informe o e-mail do paciente antes de enviar convite.");
    if (patient.user_id) throw new Error("Este paciente já possui acesso ao portal.");

    await expireOldPatientInvitation(supabase, tenant.id, patient.id);

    const { data: invitation, error } = await supabaseAdmin
      .from("patient_invitations")
      .insert({
        tenant_id: tenant.id,
        patient_id: patient.id,
        email: patient.email.toLowerCase(),
        invited_by: userId,
      })
      .select("id, token, email, status, expires_at")
      .single();
    if (error) throw new Error(error.message);

    const inviteUrl = buildPatientInviteUrl(invitation.token);
    const template = patientInviteEmail({
      tenantName: tenant.name,
      patientName: patient.full_name,
      inviteUrl,
      expiresAt: invitation.expires_at,
    });
    const emailResult = await sendEmail({ to: invitation.email, ...template });

    return { tenant, invitation, inviteUrl, emailResult };
  });

export const acceptPatientInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => acceptPatientInvitationSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, user, userId } = context as {
      supabase: SupabaseClient;
      user: User;
      userId: string;
    };

    const { data: invitation, error } = await supabase
      .from("patient_invitations")
      .select("id, tenant_id, patient_id, email, status, expires_at, tenants(id, slug, name)")
      .eq("token", data.token)
      .eq("status", "pending")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!invitation) throw new Error("Convite não encontrado ou já utilizado.");
    if (new Date(invitation.expires_at).getTime() < Date.now()) {
      throw new Error("Este convite expirou.");
    }
    if ((user.email ?? "").toLowerCase() !== invitation.email.toLowerCase()) {
      throw new Error("Entre com o mesmo e-mail que recebeu o convite.");
    }

    const { error: patientError } = await supabaseAdmin
      .from("patients")
      .update({ user_id: userId })
      .eq("tenant_id", invitation.tenant_id)
      .eq("id", invitation.patient_id);
    if (patientError) throw new Error(patientError.message);

    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      tenant_id: invitation.tenant_id,
      role: "patient",
    });
    if (roleError && !roleError.message.includes("duplicate key")) {
      throw new Error(roleError.message);
    }

    const { error: updateError } = await supabaseAdmin
      .from("patient_invitations")
      .update({
        status: "accepted",
        accepted_by: userId,
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);
    if (updateError) throw new Error(updateError.message);

    const tenantRelation = Array.isArray(invitation.tenants)
      ? invitation.tenants[0]
      : invitation.tenants;
    return { accepted: true, tenant: tenantRelation };
  });

export const importPatients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => importPatientsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tenant = await resolveTenant(supabase, data.tenant);
    const created: Array<{ id: string; full_name: string; email?: string | null }> = [];
    const skipped: Array<{ full_name: string; reason: string }> = [];

    for (const input of data.patients) {
      try {
        const { data: existing, error: existingError } = input.cpf
          ? await supabase
              .from("patients")
              .select("id")
              .eq("tenant_id", tenant.id)
              .eq("cpf", input.cpf)
              .maybeSingle()
          : { data: null, error: null };
        if (existingError) throw new Error(existingError.message);
        if (existing) {
          skipped.push({ full_name: input.full_name, reason: "CPF já cadastrado" });
          continue;
        }

        const { data: patient, error: patientError } = await supabase
          .from("patients")
          .insert({
            tenant_id: tenant.id,
            full_name: input.full_name,
            cpf: input.cpf,
            email: input.email,
            phone: input.phone,
            status: input.status,
          })
          .select("id, full_name, email")
          .single();
        if (patientError) throw new Error(patientError.message);

        const [cardResult, subscriptionResult] = await Promise.all([
          supabase.from("benefit_cards").insert({
            tenant_id: tenant.id,
            patient_id: patient.id,
            card_number: createCardNumber(),
            qr_token: createQrToken(),
            active: true,
          }),
          supabase.from("subscriptions").insert({
            tenant_id: tenant.id,
            patient_id: patient.id,
            plan: "benefits",
            status: input.status === "delinquent" ? "past_due" : "active",
            next_due_date: nextDueDate(),
          }),
        ]);
        if (cardResult.error) throw new Error(cardResult.error.message);
        if (subscriptionResult.error) throw new Error(subscriptionResult.error.message);

        created.push(patient);
      } catch (err) {
        skipped.push({
          full_name: input.full_name,
          reason: err instanceof Error ? err.message : "Erro ao importar",
        });
      }
    }

    return { tenant, created, skipped };
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

async function expireOldPatientInvitation(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string,
) {
  const { error } = await supabase
    .from("patient_invitations")
    .update({ status: "expired" })
    .eq("tenant_id", tenantId)
    .eq("patient_id", patientId)
    .eq("status", "pending");
  if (error) throw new Error(error.message);
}

function buildPatientInviteUrl(token: string) {
  const request = getRequest();
  const requestOrigin = request ? new URL(request.url).origin : undefined;
  const baseUrl = process.env.APP_BASE_URL || requestOrigin || "https://medyco.com.br";
  return `${baseUrl.replace(/\/$/, "")}/patient-invite/${token}`;
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

function sumPaid(rows: Array<{ amount: number | string; status: string }>) {
  return rows
    .filter((row) => row.status === "paid")
    .reduce((total, row) => total + Number(row.amount ?? 0), 0);
}

function sumNumeric<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
}

function nextDueDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
}
