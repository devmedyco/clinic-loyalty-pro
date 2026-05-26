import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase-ext/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase-ext/client.server";
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
    const { supabase, user, userId } = context as {
      supabase: SupabaseClient;
      user: User;
      userId: string;
    };

    const { patient, error: patientError } = await getOrRepairPatientLink(supabase, userId, user);

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
    const { supabase, user, userId } = context as {
      supabase: SupabaseClient;
      user: User;
      userId: string;
    };

    const { patient, error: patientError } = await getOrRepairPatientLink(supabase, userId, user);
    if (patientError) throw new Error(patientError.message);
    if (!patient) {
      return { tenant: null, services: [], providers: [], currentUserEmail: user.email };
    }

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
    return {
      tenant,
      services: services ?? [],
      providers: providers ?? [],
      currentUserEmail: user.email,
    };
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

type PatientPortalRow = {
  id: string;
  tenant_id: string;
  full_name: string;
  cpf: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  created_at: string;
  tenants:
    | {
        id: string;
        name: string;
        slug: string;
        logo_url: string | null;
        brand_color: string | null;
        email?: string | null;
        phone?: string | null;
      }
    | Array<{
        id: string;
        name: string;
        slug: string;
        logo_url: string | null;
        brand_color: string | null;
        email?: string | null;
        phone?: string | null;
      }>
    | null;
  benefit_cards:
    | Array<{
        id: string;
        card_number: string;
        qr_token: string;
        active: boolean;
        expires_at: string | null;
        created_at: string;
      }>
    | {
        id: string;
        card_number: string;
        qr_token: string;
        active: boolean;
        expires_at: string | null;
        created_at: string;
      }
    | null;
  subscriptions:
    | Array<{ id: string; plan: string; status: string; next_due_date: string | null }>
    | { id: string; plan: string; status: string; next_due_date: string | null }
    | null;
};

async function getOrRepairPatientLink(supabase: SupabaseClient, userId: string, user: User) {
  const firstLookup = await fetchPatientPortalRow(supabase, userId);
  if (firstLookup.data || firstLookup.error) {
    return { patient: firstLookup.data as PatientPortalRow | null, error: firstLookup.error };
  }

  await repairPatientLinkFromInvitation(userId, user.email);
  const secondLookup = await fetchPatientPortalRow(supabase, userId);

  return { patient: secondLookup.data as PatientPortalRow | null, error: secondLookup.error };
}

function fetchPatientPortalRow(supabase: SupabaseClient, userId: string) {
  return supabase
    .from("patients")
    .select(
      "id, tenant_id, full_name, cpf, email, phone, status, created_at, tenants(id, name, slug, logo_url, brand_color, email, phone), benefit_cards(id, card_number, qr_token, active, expires_at, created_at), subscriptions(id, plan, status, next_due_date)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

async function repairPatientLinkFromInvitation(userId: string, email?: string | null) {
  const normalizedEmail = email?.trim().toLowerCase();
  const invitations = await findRepairablePatientInvitations(userId, normalizedEmail);
  const invitation = invitations.find((item) => isInvitationClaimableByUser(item, userId, email));

  if (!invitation) return;

  const linkedPatient = singleRelation(invitation.patients);
  if (linkedPatient?.user_id && linkedPatient.user_id !== userId) return;

  if (!linkedPatient?.user_id) {
    const { error: patientError } = await supabaseAdmin
      .from("patients")
      .update({ user_id: userId })
      .eq("tenant_id", invitation.tenant_id)
      .eq("id", invitation.patient_id)
      .is("user_id", null);
    if (patientError) throw new Error(patientError.message);
  }

  const { error: roleError } = await supabaseAdmin.from("user_roles").upsert(
    {
      user_id: userId,
      tenant_id: invitation.tenant_id,
      role: "patient",
    },
    { onConflict: "user_id,role,tenant_id" },
  );
  if (roleError) throw new Error(roleError.message);

  const { error: invitationError } = await supabaseAdmin
    .from("patient_invitations")
    .update({
      status: "accepted",
      accepted_by: userId,
      accepted_at: new Date().toISOString(),
    })
    .eq("id", invitation.id)
    .in("status", ["pending", "accepted"]);
  if (invitationError) throw new Error(invitationError.message);
}

async function findRepairablePatientInvitations(userId: string, email?: string | null) {
  const { data: acceptedByUser, error: acceptedError } = await supabaseAdmin
    .from("patient_invitations")
    .select(
      "id, tenant_id, patient_id, email, status, expires_at, accepted_by, created_at, patients(id, user_id)",
    )
    .eq("accepted_by", userId)
    .in("status", ["pending", "accepted"])
    .order("created_at", { ascending: false })
    .limit(5);
  if (acceptedError) throw new Error(acceptedError.message);

  if (acceptedByUser?.length) return acceptedByUser;
  if (!email) return [];

  const { data: matchingEmail, error: emailError } = await supabaseAdmin
    .from("patient_invitations")
    .select(
      "id, tenant_id, patient_id, email, status, expires_at, accepted_by, created_at, patients(id, user_id)",
    )
    .ilike("email", email)
    .in("status", ["pending", "accepted"])
    .order("created_at", { ascending: false })
    .limit(5);
  if (emailError) throw new Error(emailError.message);

  return matchingEmail ?? [];
}

function isInvitationClaimableByUser(
  invitation: {
    email: string;
    status: string;
    expires_at: string;
    accepted_by: string | null;
  },
  userId: string,
  email?: string | null,
) {
  if (email && invitation.email.toLowerCase() !== email.toLowerCase()) return false;
  if (invitation.accepted_by && invitation.accepted_by !== userId) return false;
  if (invitation.status === "accepted") return true;
  return invitation.status === "pending" && new Date(invitation.expires_at).getTime() > Date.now();
}

function singleRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
