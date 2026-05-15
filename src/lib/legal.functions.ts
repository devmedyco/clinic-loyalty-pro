import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase-ext/auth-middleware";

const acceptDocumentSchema = z.object({
  document_id: z.string().uuid(),
});

const tenantSlugSchema = z.object({
  tenant: z.string().min(1).max(60),
});

const publishTenantDocumentSchema = tenantSlugSchema.extend({
  title: z.string().trim().min(4).max(180),
  version: z.string().trim().min(3).max(40),
  content: z.string().trim().min(120).max(20000),
});

export type LegalDocument = {
  id: string;
  tenant_id: string | null;
  type: string;
  title: string;
  version: string;
  content: string;
  active: boolean;
  required_for_patient: boolean;
  created_at?: string;
};

export const getPatientLegalStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const patient = await resolvePatient(supabase, userId);
    if (!patient) return { patient: null, documents: [], acceptances: [], pending: [] };

    const status = await getRequiredLegalStatus(supabase, patient.id, userId, patient.tenant_id);
    return { patient, ...status };
  });

export const acceptLegalDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => acceptDocumentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patient = await resolvePatient(supabase, userId);
    if (!patient) throw new Error("Cadastro de paciente não encontrado.");

    const { data: document, error: documentError } = await supabase
      .from("legal_documents")
      .select("id, tenant_id, active")
      .eq("id", data.document_id)
      .maybeSingle();
    if (documentError) throw new Error(documentError.message);
    if (!document?.active) throw new Error("Este termo não está mais disponível para aceite.");
    if (document.tenant_id && document.tenant_id !== patient.tenant_id) {
      throw new Error("Este termo não pertence à sua clínica.");
    }

    const request = getRequest();
    const ip =
      request?.headers.get("cf-connecting-ip") ??
      request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const userAgent = request?.headers.get("user-agent") ?? undefined;

    const { data: acceptance, error } = await supabase
      .from("legal_acceptances")
      .insert({
        document_id: data.document_id,
        tenant_id: patient.tenant_id,
        patient_id: patient.id,
        user_id: userId,
        ip_address: ip,
        user_agent: userAgent,
      })
      .select("id, document_id, accepted_at")
      .single();

    if (error && !error.message.includes("duplicate key")) throw new Error(error.message);
    return { accepted: true, acceptance };
  });

export const getTenantLegalCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => tenantSlugSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tenant = await resolveTenant(supabase, data.tenant);

    const [
      { data: documents, error: documentsError },
      { data: acceptances, error: acceptancesError },
    ] = await Promise.all([
      supabase
        .from("legal_documents")
        .select(
          "id, tenant_id, type, title, version, content, active, required_for_patient, created_at",
        )
        .or(`tenant_id.is.null,tenant_id.eq.${tenant.id}`)
        .order("created_at", { ascending: false }),
      supabase
        .from("legal_acceptances")
        .select(
          "id, document_id, accepted_at, patients(full_name, email), legal_documents(title, version)",
        )
        .eq("tenant_id", tenant.id)
        .order("accepted_at", { ascending: false })
        .limit(12),
    ]);

    if (documentsError) throw new Error(documentsError.message);
    if (acceptancesError) throw new Error(acceptancesError.message);

    const documentRows = (documents ?? []) as LegalDocument[];
    return {
      tenant,
      documents: documentRows,
      activeTenantDocument:
        documentRows.find(
          (document) =>
            document.tenant_id === tenant.id &&
            document.type === "patient_card_terms" &&
            document.active,
        ) ?? null,
      activePlatformDocument:
        documentRows.find(
          (document) =>
            document.tenant_id === null &&
            document.type === "patient_card_terms" &&
            document.active,
        ) ?? null,
      acceptances: acceptances ?? [],
    };
  });

export const publishTenantLegalDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => publishTenantDocumentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tenant = await resolveTenant(supabase, data.tenant);

    const { error: deactivateError } = await supabase
      .from("legal_documents")
      .update({ active: false })
      .eq("tenant_id", tenant.id)
      .eq("type", "patient_card_terms")
      .eq("active", true);
    if (deactivateError) throw new Error(deactivateError.message);

    const { data: document, error } = await supabase
      .from("legal_documents")
      .insert({
        tenant_id: tenant.id,
        type: "patient_card_terms",
        title: data.title,
        version: data.version,
        content: data.content,
        active: true,
        required_for_patient: true,
      })
      .select(
        "id, tenant_id, type, title, version, content, active, required_for_patient, created_at",
      )
      .single();

    if (error) throw new Error(error.message);
    return { tenant, document };
  });

export async function getRequiredLegalStatus(
  supabase: SupabaseClient,
  patientId: string,
  userId: string,
  tenantId: string,
) {
  const [
    { data: documents, error: documentsError },
    { data: acceptances, error: acceptancesError },
  ] = await Promise.all([
    supabase
      .from("legal_documents")
      .select(
        "id, tenant_id, type, title, version, content, active, required_for_patient, created_at",
      )
      .eq("active", true)
      .eq("required_for_patient", true)
      .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
      .order("created_at", { ascending: false }),
    supabase
      .from("legal_acceptances")
      .select("id, document_id, accepted_at")
      .eq("patient_id", patientId)
      .eq("user_id", userId),
  ]);

  if (documentsError) throw new Error(documentsError.message);
  if (acceptancesError) throw new Error(acceptancesError.message);

  const requiredDocuments = selectRequiredDocuments((documents ?? []) as LegalDocument[], tenantId);
  const acceptedDocumentIds = new Set((acceptances ?? []).map((item) => item.document_id));
  const pending = requiredDocuments.filter((document) => !acceptedDocumentIds.has(document.id));

  return {
    documents: requiredDocuments,
    acceptances: acceptances ?? [],
    pending,
    accepted: pending.length === 0,
  };
}

function selectRequiredDocuments(documents: LegalDocument[], tenantId: string) {
  const byType = new Map<string, LegalDocument>();
  for (const document of documents) {
    const existing = byType.get(document.type);
    const documentIsTenant = document.tenant_id === tenantId;
    const existingIsTenant = existing?.tenant_id === tenantId;
    if (!existing || (documentIsTenant && !existingIsTenant)) {
      byType.set(document.type, document);
    }
  }
  return Array.from(byType.values());
}

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

async function resolvePatient(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("patients")
    .select("id, tenant_id, full_name, email, status")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}
