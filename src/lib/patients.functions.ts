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
  birth_date: optionalText(10),
  email: optionalText(160).pipe(z.string().email("E-mail inválido").optional()),
  phone: optionalText(40),
  zip_code: optionalText(12),
  street: optionalText(180),
  number: optionalText(40),
  complement: optionalText(120),
  neighborhood: optionalText(120),
  city: optionalText(120),
  state: optionalText(2),
  status: patientStatusSchema.default("active"),
});

const updatePatientSchema = createPatientSchema.extend({
  id: z.string().uuid(),
});

const getPatientSchema = tenantSlugSchema.extend({
  id: z.string().uuid(),
});

const invitePatientSchema = getPatientSchema;

const patientDependentSchema = getPatientSchema.extend({
  full_name: z.string().trim().min(2).max(160),
  cpf: cpfSchema,
  birth_date: optionalText(10),
  relationship: optionalText(80),
  status: z.enum(["active", "inactive"]).default("active"),
});

const deletePatientDependentSchema = tenantSlugSchema.extend({
  patient_id: z.string().uuid(),
  dependent_id: z.string().uuid(),
});

const acceptPatientInvitationSchema = z.object({
  token: z.string().min(16).max(200),
});

const completePatientInvitationSchema = acceptPatientInvitationSchema.extend({
  password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres").max(120),
});

const importPatientsSchema = tenantSlugSchema.extend({
  patients: z
    .array(
      z.object({
        full_name: z.string().trim().min(2).max(160),
        cpf: cpfSchema,
        birth_date: optionalText(10),
        email: optionalText(160).pipe(z.string().email("E-mail inválido").optional()),
        phone: optionalText(40),
        zip_code: optionalText(12),
        street: optionalText(180),
        number: optionalText(40),
        complement: optionalText(120),
        neighborhood: optionalText(120),
        city: optionalText(120),
        state: optionalText(2),
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
        "id, tenant_id, user_id, full_name, email, phone, cpf, birth_date, zip_code, street, number, complement, neighborhood, city, state, status, created_at, updated_at, benefit_cards(id, card_number, qr_token, active, expires_at, created_at), patient_invitations(id, email, status, expires_at, created_at, email_status, email_error, email_provider_id, email_sent_at, email_last_attempt_at)",
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
        "id, tenant_id, user_id, full_name, email, phone, cpf, birth_date, zip_code, street, number, complement, neighborhood, city, state, status, created_at, updated_at, benefit_cards(id, card_number, qr_token, active, expires_at, created_at)",
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
        "id, tenant_id, user_id, full_name, email, phone, cpf, birth_date, zip_code, street, number, complement, neighborhood, city, state, status, created_at, updated_at, asaas_customer_id, benefit_cards(id, card_number, qr_token, active, expires_at, created_at)",
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
      dependentsResult,
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
        .select(
          "id, email, status, expires_at, accepted_at, created_at, email_status, email_error, email_provider_id, email_sent_at, email_last_attempt_at",
        )
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
      supabase
        .from("patient_dependents")
        .select("id, full_name, cpf, birth_date, relationship, status, created_at, updated_at")
        .eq("tenant_id", tenant.id)
        .eq("patient_id", patient.id)
        .order("created_at", { ascending: false }),
    ]);

    if (subscriptionsResult.error) throw new Error(subscriptionsResult.error.message);
    if (paymentsResult.error) throw new Error(paymentsResult.error.message);
    if (executionsResult.error) throw new Error(executionsResult.error.message);
    if (acceptancesResult.error) throw new Error(acceptancesResult.error.message);
    if (invitationsResult.error) throw new Error(invitationsResult.error.message);
    if (validationsResult.error) throw new Error(validationsResult.error.message);
    if (dependentsResult.error) throw new Error(dependentsResult.error.message);

    return {
      tenant,
      patient,
      subscriptions: subscriptionsResult.data ?? [],
      payments: paymentsResult.data ?? [],
      executions: executionsResult.data ?? [],
      acceptances: acceptancesResult.data ?? [],
      invitations: invitationsResult.data ?? [],
      validations: validationsResult.data ?? [],
      dependents: dependentsResult.data ?? [],
      totals: {
        paid: sumPaid(paymentsResult.data ?? []),
        pending: (paymentsResult.data ?? []).filter((payment) => payment.status === "pending")
          .length,
        savings: sumNumeric(executionsResult.data ?? [], "discount_amount"),
        executions: executionsResult.data?.length ?? 0,
        validations: validationsResult.data?.length ?? 0,
        dependents: dependentsResult.data?.length ?? 0,
      },
    };
  });

export const createPatientDependent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => patientDependentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tenant = await resolveTenant(supabase, data.tenant);

    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("id", data.id)
      .maybeSingle();
    if (patientError) throw new Error(patientError.message);
    if (!patient) throw new Error("Titular não encontrado.");

    const { data: dependent, error } = await supabase
      .from("patient_dependents")
      .insert({
        tenant_id: tenant.id,
        patient_id: patient.id,
        full_name: data.full_name,
        cpf: data.cpf,
        birth_date: data.birth_date,
        relationship: data.relationship,
        status: data.status,
      })
      .select("id, full_name, cpf, birth_date, relationship, status, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);

    await syncPendingPatientPaymentAmount(supabase, tenant, patient.id);

    return { tenant, dependent };
  });

export const deletePatientDependent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => deletePatientDependentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tenant = await resolveTenant(supabase, data.tenant);
    const { error } = await supabase
      .from("patient_dependents")
      .delete()
      .eq("tenant_id", tenant.id)
      .eq("patient_id", data.patient_id)
      .eq("id", data.dependent_id);
    if (error) throw new Error(error.message);

    await syncPendingPatientPaymentAmount(supabase, tenant, data.patient_id);

    return { tenant, deleted: true };
  });

export const createPatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createPatientSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenant = await resolveTenant(supabase, data.tenant);

    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .insert({
        tenant_id: tenant.id,
        full_name: data.full_name,
        cpf: data.cpf,
        birth_date: data.birth_date,
        email: data.email,
        phone: data.phone,
        zip_code: data.zip_code?.replace(/\D/g, ""),
        street: data.street,
        number: data.number,
        complement: data.complement,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state?.toUpperCase(),
        status: data.status,
      })
      .select(
        "id, tenant_id, user_id, full_name, email, phone, cpf, birth_date, zip_code, street, number, complement, neighborhood, city, state, status, created_at, updated_at",
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
      status: "past_due",
      next_due_date: today(),
    });

    if (subscriptionError) {
      await supabase.from("patients").delete().eq("id", patient.id).eq("tenant_id", tenant.id);
      throw new Error(subscriptionError.message);
    }

    await createInitialPendingPayment(supabase, tenant, patient.id);

    const invitation = patient.email
      ? await createPatientInvitation({
          supabase,
          tenant,
          patient: {
            id: patient.id,
            email: patient.email,
            full_name: patient.full_name,
          },
          invitedBy: userId,
        })
      : null;

    return { tenant, patient: { ...patient, benefit_cards: [card] }, invitation };
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
        birth_date: data.birth_date,
        email: data.email,
        phone: data.phone,
        zip_code: data.zip_code?.replace(/\D/g, ""),
        street: data.street,
        number: data.number,
        complement: data.complement,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state?.toUpperCase(),
        status: data.status,
      })
      .eq("tenant_id", tenant.id)
      .eq("id", data.id)
      .select(
        "id, tenant_id, user_id, full_name, email, phone, cpf, birth_date, zip_code, street, number, complement, neighborhood, city, state, status, created_at, updated_at, benefit_cards(id, card_number, qr_token, active, expires_at, created_at)",
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

    const invitation = await createPatientInvitation({
      supabase,
      tenant,
      patient,
      invitedBy: userId,
    });

    return { tenant, ...invitation };
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

export const completePatientInvitation = createServerFn({ method: "POST" })
  .inputValidator((input) => completePatientInvitationSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: invitation, error } = await supabaseAdmin
      .from("patient_invitations")
      .select(
        "id, tenant_id, patient_id, email, status, expires_at, patients(full_name), tenants(id, slug, name)",
      )
      .eq("token", data.token)
      .eq("status", "pending")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!invitation) throw new Error("Convite não encontrado ou já utilizado.");
    if (new Date(invitation.expires_at).getTime() < Date.now()) {
      throw new Error("Este convite expirou. Solicite um novo convite à clínica.");
    }

    const patient = singleRelation(invitation.patients);
    const tenant = singleRelation(invitation.tenants);
    const patientName = patient?.full_name ?? invitation.email;

    const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: invitation.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: patientName },
    });

    if (createError) {
      const message = createError.message.toLowerCase();
      if (message.includes("already") || message.includes("registered")) {
        throw new Error(
          "Este e-mail já possui acesso. Entre com sua senha para liberar o cartão deste convite.",
        );
      }
      throw new Error(createError.message);
    }

    const userId = createdUser.user?.id;
    if (!userId) throw new Error("Não foi possível criar o acesso do paciente.");

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: userId,
      email: invitation.email,
      full_name: patientName,
    });
    if (profileError) throw new Error(profileError.message);

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

    return {
      accepted: true,
      email: invitation.email,
      tenant,
      patient: { full_name: patientName },
    };
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
            birth_date: input.birth_date,
            email: input.email,
            phone: input.phone,
            zip_code: input.zip_code?.replace(/\D/g, ""),
            street: input.street,
            number: input.number,
            complement: input.complement,
            neighborhood: input.neighborhood,
            city: input.city,
            state: input.state?.toUpperCase(),
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
            status: "past_due",
            next_due_date: today(),
          }),
        ]);
        if (cardResult.error) throw new Error(cardResult.error.message);
        if (subscriptionResult.error) throw new Error(subscriptionResult.error.message);

        await createInitialPendingPayment(supabase, tenant, patient.id);

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
    .select(
      "id, slug, name, brand_color, plan, status, patient_subscription_suggestion, dependent_extra_amount",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Clínica não encontrada ou sem acesso");
  return data;
}

async function createInitialPendingPayment(
  supabase: SupabaseClient,
  tenant: {
    id: string;
    patient_subscription_suggestion?: number | string | null;
    dependent_extra_amount?: number | string | null;
  },
  patientId: string,
) {
  const amount = await calculatePatientSubscriptionAmount(supabase, tenant, patientId);
  if (!Number.isFinite(amount) || amount <= 0) return;

  const { data: subscription, error: subscriptionError } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("patient_id", patientId)
    .maybeSingle();
  if (subscriptionError) throw new Error(subscriptionError.message);
  if (!subscription) return;

  const { data: existing, error: existingError } = await supabase
    .from("payments")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("patient_id", patientId)
    .eq("subscription_id", subscription.id)
    .eq("status", "pending")
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return;

  const { error } = await supabase.from("payments").insert({
    tenant_id: tenant.id,
    patient_id: patientId,
    subscription_id: subscription.id,
    amount,
    payment_method: "manual",
    status: "pending",
    due_date: today(),
    notes: "Primeira cobrança gerada automaticamente no cadastro do paciente.",
  });
  if (error) throw new Error(error.message);
}

async function syncPendingPatientPaymentAmount(
  supabase: SupabaseClient,
  tenant: {
    id: string;
    patient_subscription_suggestion?: number | string | null;
    dependent_extra_amount?: number | string | null;
  },
  patientId: string,
) {
  const amount = await calculatePatientSubscriptionAmount(supabase, tenant, patientId);
  const { data: subscription, error: subscriptionError } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("patient_id", patientId)
    .maybeSingle();
  if (subscriptionError) throw new Error(subscriptionError.message);
  if (!subscription) return;

  const { error } = await supabase
    .from("payments")
    .update({
      amount,
      notes: "Cobrança pendente recalculada com dependentes do titular.",
    })
    .eq("tenant_id", tenant.id)
    .eq("patient_id", patientId)
    .eq("subscription_id", subscription.id)
    .eq("status", "pending")
    .is("asaas_payment_id", null);
  if (error) throw new Error(error.message);
}

async function calculatePatientSubscriptionAmount(
  supabase: SupabaseClient,
  tenant: {
    id: string;
    patient_subscription_suggestion?: number | string | null;
    dependent_extra_amount?: number | string | null;
  },
  patientId: string,
) {
  const baseAmount = Number(tenant.patient_subscription_suggestion ?? 39.9);
  const dependentAmount = Number(tenant.dependent_extra_amount ?? 0);
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) return 0;
  if (!Number.isFinite(dependentAmount) || dependentAmount <= 0) return baseAmount;

  const { count, error } = await supabase
    .from("patient_dependents")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenant.id)
    .eq("patient_id", patientId)
    .eq("status", "active");
  if (error) throw new Error(error.message);

  return baseAmount + Number(count ?? 0) * dependentAmount;
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

async function createPatientInvitation({
  supabase,
  tenant,
  patient,
  invitedBy,
}: {
  supabase: SupabaseClient;
  tenant: { id: string; name: string };
  patient: { id: string; full_name: string; email: string | null };
  invitedBy: string;
}) {
  if (!patient.email) throw new Error("Informe o e-mail do paciente antes de enviar convite.");

  await expireOldPatientInvitation(supabase, tenant.id, patient.id);

  const { data: invitation, error } = await supabaseAdmin
    .from("patient_invitations")
    .insert({
      tenant_id: tenant.id,
      patient_id: patient.id,
      email: patient.email.toLowerCase(),
      invited_by: invitedBy,
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
  const emailDelivery = emailDeliveryFields(emailResult);

  const { error: deliveryError } = await supabaseAdmin
    .from("patient_invitations")
    .update(emailDelivery)
    .eq("id", invitation.id);
  if (deliveryError) throw new Error(deliveryError.message);

  return { invitation: { ...invitation, ...emailDelivery }, inviteUrl, emailResult };
}

function emailDeliveryFields(emailResult: Awaited<ReturnType<typeof sendEmail>>) {
  const attemptedAt = new Date().toISOString();
  if (emailResult.sent) {
    return {
      email_status: "sent",
      email_provider_id: emailResult.providerId ?? null,
      email_error: null,
      email_sent_at: attemptedAt,
      email_last_attempt_at: attemptedAt,
    };
  }

  return {
    email_status: "failed",
    email_provider_id: null,
    email_error: emailFailureMessage(emailResult),
    email_sent_at: null,
    email_last_attempt_at: attemptedAt,
  };
}

function emailFailureMessage(emailResult: Awaited<ReturnType<typeof sendEmail>>) {
  if (emailResult.sent) return null;
  if (emailResult.reason === "missing_resend_api_key") {
    return "RESEND_API_KEY não está disponível no ambiente publicado.";
  }
  return emailResult.error || "Resend recusou o envio sem detalhar o motivo.";
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
  return `MED-${randomNumeric(6)}`;
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

function randomNumeric(length: number) {
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  return Array.from(values)
    .map((value) => String(value % 10))
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

function today() {
  return new Date().toISOString().slice(0, 10);
}

function singleRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
