import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase-ext/auth-middleware";

const queueSchema = z.object({
  daysAhead: z.coerce.number().min(1).max(30).default(5),
});

export const listAdminNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
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
    const { supabase } = context;
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

    const rows = (payments ?? []).map((payment) => {
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

    if (rows.length === 0) return { created: 0 };
    const { error: insertError } = await supabase.from("notifications").insert(rows);
    if (insertError) throw new Error(insertError.message);
    return { created: rows.length };
  });

function relation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value || 0),
  );
}
