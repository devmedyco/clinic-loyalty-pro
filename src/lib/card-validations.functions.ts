import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase-ext/auth-middleware";

const tenantSlugSchema = z.object({
  tenant: z.string().min(1).max(60),
});

const validateCardSchema = tenantSlugSchema.extend({
  token: z.string().trim().min(4).max(180),
  notes: z
    .preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().trim().max(500).optional(),
    )
    .optional(),
});

export const listRecentCardValidations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => tenantSlugSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tenant = await resolveTenant(supabase, data.tenant);

    const { data: validations, error } = await supabase
      .from("card_validations")
      .select(
        "id, card_id, tenant_id, validated_at, outcome, reason, qr_token_snapshot, notes, benefit_cards(card_number, patients(full_name, cpf, status))",
      )
      .eq("tenant_id", tenant.id)
      .order("validated_at", { ascending: false })
      .limit(12);

    if (error) throw new Error(error.message);

    return { tenant, validations: validations ?? [] };
  });

export const validateCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => validateCardSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenant = await resolveTenant(supabase, data.tenant);
    const token = normalizeToken(data.token);

    const { data: card, error: cardError } = await supabase
      .from("benefit_cards")
      .select(
        "id, tenant_id, patient_id, card_number, qr_token, active, expires_at, patients(id, user_id, full_name, cpf, status, email, phone)",
      )
      .or(`qr_token.eq.${token},card_number.eq.${token}`)
      .maybeSingle();

    if (cardError) throw new Error(cardError.message);

    if (!card || card.tenant_id !== tenant.id) {
      await recordValidation(supabase, {
        tenantId: tenant.id,
        userId,
        token,
        outcome: "denied",
        reason: "Cartão não encontrado para esta clínica",
        notes: data.notes,
      });
      return deniedResult("Cartão não encontrado para esta clínica");
    }

    const patient = Array.isArray(card.patients) ? card.patients[0] : card.patients;
    const legalDenialReason = patient?.user_id
      ? await getLegalDenialReason(supabase, patient.id, patient.user_id)
      : "Paciente ainda não assinou o termo de uso do cartão";
    const denialReason = getDenialReason(card, patient) ?? legalDenialReason;
    const outcome = denialReason ? "denied" : "approved";

    const { data: validation, error: validationError } = await recordValidation(supabase, {
      cardId: card.id,
      tenantId: tenant.id,
      userId,
      token,
      outcome,
      reason: denialReason,
      notes: data.notes,
    });

    if (validationError) throw new Error(validationError.message);

    return {
      authorized: outcome === "approved",
      outcome,
      reason: denialReason,
      validation,
      card: {
        id: card.id,
        card_number: card.card_number,
        active: card.active,
        expires_at: card.expires_at,
      },
      patient,
    };
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

function normalizeToken(token: string) {
  return token.trim();
}

function getDenialReason(
  card: { active: boolean; expires_at: string | null },
  patient?: { status?: string | null } | null,
) {
  if (!card.active) return "Cartão bloqueado";
  if (card.expires_at && new Date(card.expires_at).getTime() < Date.now()) return "Cartão expirado";
  if (patient?.status === "inactive") return "Paciente inativo";
  if (patient?.status === "delinquent") return "Paciente inadimplente";
  return null;
}

async function getLegalDenialReason(supabase: SupabaseClient, patientId: string, userId: string) {
  const { data: documents, error: documentsError } = await supabase
    .from("legal_documents")
    .select("id")
    .eq("active", true)
    .eq("required_for_patient", true);
  if (documentsError) throw new Error(documentsError.message);
  if (!documents || documents.length === 0) return null;

  const { data: acceptances, error: acceptancesError } = await supabase
    .from("legal_acceptances")
    .select("document_id")
    .eq("patient_id", patientId)
    .eq("user_id", userId);
  if (acceptancesError) throw new Error(acceptancesError.message);

  const accepted = new Set((acceptances ?? []).map((item) => item.document_id));
  const hasPending = documents.some((document) => !accepted.has(document.id));
  return hasPending ? "Paciente ainda não assinou o termo de uso do cartão" : null;
}

function deniedResult(reason: string) {
  return {
    authorized: false,
    outcome: "denied",
    reason,
    validation: null,
    card: null,
    patient: null,
  };
}

function recordValidation(
  supabase: SupabaseClient,
  {
    cardId,
    tenantId,
    userId,
    token,
    outcome,
    reason,
    notes,
  }: {
    cardId?: string;
    tenantId: string;
    userId: string;
    token: string;
    outcome: "approved" | "denied";
    reason?: string | null;
    notes?: string;
  },
) {
  return supabase
    .from("card_validations")
    .insert({
      card_id: cardId,
      tenant_id: tenantId,
      validated_by: userId,
      outcome,
      reason,
      notes,
      qr_token_snapshot: token.slice(0, 180),
    })
    .select("id, card_id, tenant_id, validated_at, outcome, reason, notes")
    .single();
}
