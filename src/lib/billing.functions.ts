import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase-ext/auth-middleware";

const tenantSlugSchema = z.object({
  tenant: z.string().min(1).max(60),
});

const createPaymentSchema = tenantSlugSchema.extend({
  patient_id: z.string().uuid(),
  amount: z.coerce.number().min(0).max(999999),
  payment_method: z.enum(["manual", "pix", "credit_card", "boleto", "cash"]).default("manual"),
  status: z.enum(["pending", "paid", "failed", "refunded", "canceled"]).default("paid"),
  notes: z.string().trim().max(500).optional(),
});

const updateSubscriptionSchema = tenantSlugSchema.extend({
  subscription_id: z.string().uuid(),
  status: z.enum(["trial", "active", "past_due", "canceled", "paused"]),
  next_due_date: z.string().optional(),
});

export const getTenantBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => tenantSlugSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tenant = await resolveTenant(supabase, data.tenant);
    await ensurePatientSubscriptions(supabase, tenant.id);

    const [subscriptions, payments] = await Promise.all([
      supabase
        .from("subscriptions")
        .select(
          "id, tenant_id, patient_id, plan, status, next_due_date, asaas_subscription_id, created_at, patients(full_name, email, phone, status)",
        )
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("payments")
        .select(
          "id, tenant_id, patient_id, subscription_id, amount, payment_method, status, paid_at, notes, created_at, patients(full_name)",
        )
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false })
        .limit(25),
    ]);

    if (subscriptions.error) throw new Error(subscriptions.error.message);
    if (payments.error) throw new Error(payments.error.message);

    const subscriptionRows = subscriptions.data ?? [];
    const paymentRows = payments.data ?? [];

    return {
      tenant,
      totals: {
        subscriptions: subscriptionRows.length,
        active: subscriptionRows.filter((item) => ["trial", "active"].includes(item.status)).length,
        pastDue: subscriptionRows.filter((item) => item.status === "past_due").length,
        canceled: subscriptionRows.filter((item) => item.status === "canceled").length,
        paidRevenue: sumPaid(paymentRows),
        pendingPayments: paymentRows.filter((item) => item.status === "pending").length,
      },
      subscriptions: subscriptionRows,
      payments: paymentRows,
    };
  });

export const createManualPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createPaymentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tenant = await resolveTenant(supabase, data.tenant);
    const subscription = await ensurePatientSubscription(supabase, tenant.id, data.patient_id);
    const paidAt = data.status === "paid" ? new Date().toISOString() : null;

    const { data: payment, error } = await supabase
      .from("payments")
      .insert({
        tenant_id: tenant.id,
        patient_id: data.patient_id,
        subscription_id: subscription.id,
        amount: data.amount,
        payment_method: data.payment_method,
        status: data.status,
        paid_at: paidAt,
        notes: data.notes,
      })
      .select("id, amount, payment_method, status, paid_at, created_at")
      .single();

    if (error) throw new Error(error.message);

    if (data.status === "paid") {
      await syncSubscriptionStatus(supabase, tenant.id, data.patient_id, subscription.id, "active");
    }
    if (data.status === "failed") {
      await syncSubscriptionStatus(
        supabase,
        tenant.id,
        data.patient_id,
        subscription.id,
        "past_due",
      );
    }

    return { tenant, payment };
  });

export const updateSubscriptionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateSubscriptionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tenant = await resolveTenant(supabase, data.tenant);

    const { data: subscription, error } = await supabase
      .from("subscriptions")
      .update({
        status: data.status,
        next_due_date: data.next_due_date,
      })
      .eq("tenant_id", tenant.id)
      .eq("id", data.subscription_id)
      .select("id, patient_id, status, next_due_date")
      .single();

    if (error) throw new Error(error.message);
    await syncPatientStatus(supabase, tenant.id, subscription.patient_id, data.status);
    return { tenant, subscription };
  });

async function ensurePatientSubscriptions(supabase: SupabaseClient, tenantId: string) {
  const { data: patients, error: patientsError } = await supabase
    .from("patients")
    .select("id, status")
    .eq("tenant_id", tenantId);
  if (patientsError) throw new Error(patientsError.message);

  const { data: subscriptions, error: subscriptionsError } = await supabase
    .from("subscriptions")
    .select("patient_id")
    .eq("tenant_id", tenantId);
  if (subscriptionsError) throw new Error(subscriptionsError.message);

  const existing = new Set((subscriptions ?? []).map((item) => item.patient_id));
  const missing = (patients ?? []).filter((patient) => !existing.has(patient.id));
  if (missing.length === 0) return;

  const { error } = await supabase.from("subscriptions").insert(
    missing.map((patient) => ({
      tenant_id: tenantId,
      patient_id: patient.id,
      plan: "benefits",
      status: patient.status === "delinquent" ? "past_due" : "active",
      next_due_date: nextDueDate(),
    })),
  );
  if (error) throw new Error(error.message);
}

async function ensurePatientSubscription(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string,
) {
  const { data: existing, error: existingError } = await supabase
    .from("subscriptions")
    .select("id, status, next_due_date")
    .eq("tenant_id", tenantId)
    .eq("patient_id", patientId)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existing) return existing;

  const { data: subscription, error } = await supabase
    .from("subscriptions")
    .insert({
      tenant_id: tenantId,
      patient_id: patientId,
      plan: "benefits",
      status: "active",
      next_due_date: nextDueDate(),
    })
    .select("id, status, next_due_date")
    .single();

  if (error) throw new Error(error.message);
  return subscription;
}

async function syncSubscriptionStatus(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string,
  subscriptionId: string,
  status: "active" | "past_due",
) {
  const { error } = await supabase
    .from("subscriptions")
    .update({
      status,
      next_due_date: status === "active" ? nextDueDate() : undefined,
    })
    .eq("tenant_id", tenantId)
    .eq("id", subscriptionId);
  if (error) throw new Error(error.message);

  await syncPatientStatus(supabase, tenantId, patientId, status);
}

async function syncPatientStatus(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string,
  subscriptionStatus: string,
) {
  const patientStatus =
    subscriptionStatus === "past_due"
      ? "delinquent"
      : subscriptionStatus === "canceled" || subscriptionStatus === "paused"
        ? "inactive"
        : "active";

  const { error } = await supabase
    .from("patients")
    .update({ status: patientStatus })
    .eq("tenant_id", tenantId)
    .eq("id", patientId);
  if (error) throw new Error(error.message);
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

function nextDueDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
}

function sumPaid(rows: Array<{ amount: number | string; status: string }>) {
  return rows.reduce((total, row) => {
    if (row.status !== "paid") return total;
    return total + Number(row.amount || 0);
  }, 0);
}
