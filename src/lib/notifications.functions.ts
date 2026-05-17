import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase-ext/auth-middleware";
import { assertSuperAdminAccess } from "@/lib/admin-auth.server";

const queueSchema = z.object({
  daysAhead: z.coerce.number().min(1).max(30).default(5),
});

export const listAdminNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertSuperAdminAccess(supabase, userId);
    const { data, error } = await supabase
      .from("notifications")
      .select(
        "id, tenant_id, patient_id, type, channel, title, body, action_url, status, scheduled_for, sent_at, read_at, created_at, tenants(name, slug), patients(full_name, email)",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { notifications: data ?? [] };
  });

export const queuePaymentReminderNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => queueSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdminAccess(supabase, userId);
    const until = new Date();
    until.setDate(until.getDate() + data.daysAhead);

    const { data: payments, error } = await supabase
      .from("payments")
      .select(
        "id, tenant_id, patient_id, amount, due_date, status, patients(full_name, user_id, email), tenants(name, slug)",
      )
      .eq("status", "pending")
      .not("due_date", "is", null)
      .lte("due_date", until.toISOString().slice(0, 10));
    if (error) throw new Error(error.message);

    const { data: tenants, error: tenantsError } = await supabase
      .from("tenants")
      .select("id, name, slug, monthly_fee, saas_billing_status, saas_next_due_date")
      .in("saas_billing_status", ["pending", "overdue"])
      .not("saas_next_due_date", "is", null)
      .lte("saas_next_due_date", until.toISOString().slice(0, 10));
    if (tenantsError) throw new Error(tenantsError.message);

    const paymentRows = (payments ?? []).map((payment) => {
      const patient = relation(payment.patients);
      const tenant = relation(payment.tenants);
      return {
        tenant_id: payment.tenant_id,
        patient_id: payment.patient_id,
        recipient_user_id: patient?.user_id ?? null,
        type: "payment_due",
        channel: "in_app",
        title: "Pagamento pendente",
        body: `${patient?.full_name ?? "Paciente"} possui cobrança de ${formatCurrency(payment.amount)} em aberto.`,
        action_url: tenant?.slug ? `/app/${tenant.slug}/billing` : "/admin/billing",
        status: patient?.user_id ? "unread" : "queued",
        scheduled_for: payment.due_date,
        metadata: { payment_id: payment.id, patient_email: patient?.email },
      };
    });

    const tenantRows = (tenants ?? []).map((tenant) => ({
      tenant_id: tenant.id,
      patient_id: null,
      recipient_user_id: null,
      type: "tenant_saas_due",
      channel: "in_app",
      title:
        tenant.saas_billing_status === "overdue"
          ? "Mensalidade SaaS em atraso"
          : "Mensalidade SaaS pendente",
      body: `${tenant.name} possui mensalidade Medyco de ${formatCurrency(tenant.monthly_fee)} para acompanhar.`,
      action_url: "/admin/billing",
      status: "queued",
      scheduled_for: tenant.saas_next_due_date,
      metadata: { tenant_id: tenant.id, slug: tenant.slug },
    }));

    const rows = await removeExistingReminders(supabase, [...paymentRows, ...tenantRows]);
    if (rows.length === 0) return { created: 0 };
    const { error: insertError } = await supabase.from("notifications").insert(rows);
    if (insertError) throw new Error(insertError.message);
    return { created: rows.length };
  });

async function removeExistingReminders(
  supabase: SupabaseClient,
  rows: Array<{
    type: string;
    status: string;
    metadata: Record<string, unknown>;
  }>,
) {
  const paymentIds = rows
    .map((row) => row.metadata.payment_id)
    .filter((id): id is string => typeof id === "string");
  const tenantIds = rows
    .map((row) => row.metadata.tenant_id)
    .filter((id): id is string => typeof id === "string");

  if (paymentIds.length === 0 && tenantIds.length === 0) return rows;

  const { data, error } = await supabase
    .from("notifications")
    .select("type, metadata")
    .in("status", ["queued", "unread"])
    .or(
      [
        paymentIds.length ? `metadata->>payment_id.in.(${paymentIds.join(",")})` : null,
        tenantIds.length ? `metadata->>tenant_id.in.(${tenantIds.join(",")})` : null,
      ]
        .filter(Boolean)
        .join(","),
    );
  if (error) throw new Error(error.message);

  const existingPayments = new Set(
    (data ?? [])
      .filter((item) => item.type === "payment_due")
      .map((item) => (item.metadata as Record<string, unknown>).payment_id)
      .filter((id): id is string => typeof id === "string"),
  );
  const existingTenants = new Set(
    (data ?? [])
      .filter((item) => item.type === "tenant_saas_due")
      .map((item) => (item.metadata as Record<string, unknown>).tenant_id)
      .filter((id): id is string => typeof id === "string"),
  );

  return rows.filter((row) => {
    const paymentId = row.metadata.payment_id;
    const tenantId = row.metadata.tenant_id;
    if (typeof paymentId === "string" && existingPayments.has(paymentId)) return false;
    if (typeof tenantId === "string" && existingTenants.has(tenantId)) return false;
    return true;
  });
}

function relation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value || 0),
  );
}
