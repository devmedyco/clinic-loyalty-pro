import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase-ext/auth-middleware";

const acceptDocumentSchema = z.object({
  document_id: z.string().uuid(),
});

export type LegalDocument = {
  id: string;
  type: string;
  title: string;
  version: string;
  content: string;
  required_for_patient: boolean;
};

export const getPatientLegalStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const patient = await resolvePatient(supabase, userId);
    if (!patient) return { patient: null, documents: [], acceptances: [], pending: [] };

    const status = await getRequiredLegalStatus(supabase, patient.id, userId);
    return { patient, ...status };
  });

export const acceptLegalDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => acceptDocumentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patient = await resolvePatient(supabase, userId);
    if (!patient) throw new Error("Cadastro de paciente não encontrado.");

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

export async function getRequiredLegalStatus(
  supabase: SupabaseClient,
  patientId: string,
  userId: string,
) {
  const [
    { data: documents, error: documentsError },
    { data: acceptances, error: acceptancesError },
  ] = await Promise.all([
    supabase
      .from("legal_documents")
      .select("id, type, title, version, content, required_for_patient")
      .eq("active", true)
      .eq("required_for_patient", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("legal_acceptances")
      .select("id, document_id, accepted_at")
      .eq("patient_id", patientId)
      .eq("user_id", userId),
  ]);

  if (documentsError) throw new Error(documentsError.message);
  if (acceptancesError) throw new Error(acceptancesError.message);

  const acceptedDocumentIds = new Set((acceptances ?? []).map((item) => item.document_id));
  const pending = ((documents ?? []) as LegalDocument[]).filter(
    (document) => !acceptedDocumentIds.has(document.id),
  );

  return {
    documents: (documents ?? []) as LegalDocument[],
    acceptances: acceptances ?? [],
    pending,
    accepted: pending.length === 0,
  };
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
