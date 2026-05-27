import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase-ext/auth-middleware";
import { assertSuperAdminAccess } from "@/lib/admin-auth.server";
import { recordOperationalEvent } from "@/lib/operational-events.server";

const supportSearchSchema = z.object({
  search: z.string().trim().max(120).optional().default(""),
});

const supportNoteSchema = z.object({
  tenant_id: z.string().uuid().optional(),
  patient_id: z.string().uuid().optional(),
  title: z.string().trim().min(4).max(120),
  detail: z.string().trim().min(4).max(600),
  level: z.enum(["info", "warning", "error"]).default("info"),
});

export const getAdminSupportDesk = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => supportSearchSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdminAccess(supabase, userId);

    const search = data.search.trim();
    const tenantQuery = supabase
      .from("tenants")
      .select(
        "id, name, slug, email, phone, cnpj, status, asaas_onboarding_status, asaas_api_key_ref, asaas_wallet_id, saas_billing_status, saas_invoice_url, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(12);

    const patientQuery = supabase
      .from("patients")
      .select(
        "id, tenant_id, user_id, full_name, email, phone, cpf, status, created_at, tenants(name, slug), benefit_cards(card_number, active), subscriptions(status, next_due_date), payments(id, status, amount, due_date, asaas_invoice_url, created_at), patient_invitations(status, email_sent_at, expires_at, created_at)",
      )
      .order("created_at", { ascending: false })
      .limit(16);

    if (search) {
      const pattern = `%${search.replace(/[%,]/g, "")}%`;
      tenantQuery.or(
        `name.ilike.${pattern},slug.ilike.${pattern},email.ilike.${pattern},cnpj.ilike.${pattern}`,
      );
      patientQuery.or(
        `full_name.ilike.${pattern},email.ilike.${pattern},cpf.ilike.${pattern},phone.ilike.${pattern}`,
      );
    }

    const [tenants, patients, payments, invitations, webhooks, events] = await Promise.all([
      tenantQuery,
      patientQuery,
      supabase
        .from("payments")
        .select(
          "id, tenant_id, patient_id, status, amount, due_date, asaas_payment_id, asaas_invoice_url, created_at, tenants(name, slug), patients(full_name, email)",
        )
        .in("status", ["pending", "failed", "overdue"])
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("patient_invitations")
        .select(
          "id, tenant_id, patient_id, email, status, expires_at, created_at, tenants(name, slug), patients(full_name)",
        )
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("asaas_webhook_events")
        .select("id, event_type, processed_status, processed_result, error_message, processed_at")
        .order("processed_at", { ascending: false })
        .limit(8),
      supabase
        .from("operational_events")
        .select("id, level, scope, title, detail, tenant_id, created_at, tenants(name, slug)")
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

    for (const result of [tenants, patients, payments, invitations, webhooks, events]) {
      if (result.error) throw new Error(result.error.message);
    }

    const tenantRows = tenants.data ?? [];
    const patientRows = patients.data ?? [];
    const paymentRows = payments.data ?? [];
    const invitationRows = invitations.data ?? [];
    const webhookRows = webhooks.data ?? [];
    const eventRows = events.data ?? [];

    return {
      search,
      totals: {
        tenants: tenantRows.length,
        patients: patientRows.length,
        pendingPayments: paymentRows.filter((payment) => payment.status === "pending").length,
        failedPayments: paymentRows.filter((payment) =>
          ["failed", "overdue"].includes(payment.status),
        ).length,
        pendingInvites: invitationRows.length,
        failedWebhooks: webhookRows.filter((webhook) => webhook.processed_status === "failed")
          .length,
        alerts: eventRows.filter((event) => ["warning", "error"].includes(event.level)).length,
      },
      tenants: tenantRows,
      patients: patientRows,
      payments: paymentRows,
      invitations: invitationRows,
      webhooks: webhookRows,
      events: eventRows,
    };
  });

export const recordSupportNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => supportNoteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdminAccess(supabase, userId);

    await recordOperationalEvent({
      tenantId: data.tenant_id ?? null,
      actorUserId: userId,
      scope: "support",
      level: data.level,
      eventType: "support.note",
      title: data.title,
      detail: data.detail,
      metadata: {
        patient_id: data.patient_id ?? null,
      },
    });

    return { ok: true };
  });
