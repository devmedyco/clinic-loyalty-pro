import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase-ext/auth-middleware";
import {
  createAsaasCustomer,
  createAsaasPayment,
  isAsaasConfigured,
  isAsaasMarketplaceConfigured,
  type AsaasSplitInput,
} from "@/lib/asaas.server";
import {
  DEFAULT_SPLIT_FIXED_FEE,
  DEFAULT_SPLIT_PERCENTAGE,
  roundMoney,
} from "@/lib/commercial-model";
import { paymentReminderEmail } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email.server";

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

const createAsaasPaymentSchema = tenantSlugSchema.extend({
  subscription_id: z.string().uuid(),
  amount: z.coerce.number().min(1).max(999999),
  billing_type: z.enum(["PIX", "BOLETO", "CREDIT_CARD"]).default("PIX"),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const sendPaymentReminderSchema = tenantSlugSchema.extend({
  payment_id: z.string().uuid(),
});

export const getTenantBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => tenantSlugSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tenant = await resolveTenant(supabase, data.tenant);
    await ensurePatientSubscriptions(supabase, tenant.id);
    await syncOverduePayments(supabase, tenant.id);

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
          "id, tenant_id, patient_id, subscription_id, amount, payment_method, status, paid_at, due_date, confirmed_at, asaas_payment_id, asaas_invoice_url, asaas_bank_slip_url, asaas_net_value, asaas_split_value, asaas_split_status, asaas_split_fixed_fee, asaas_split_percentage, notes, created_at, patients(full_name)",
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
      asaasConfigured: isAsaasConfigured(),
      asaasMarketplaceConfigured: isAsaasMarketplaceConfigured(),
      asaasMode: getAsaasModeLabel(tenant),
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

export const createAsaasCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createAsaasPaymentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tenant = await resolveTenant(supabase, data.tenant);

    const { data: subscription, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select(
        "id, tenant_id, patient_id, plan, status, next_due_date, patients(id, full_name, email, phone, cpf, asaas_customer_id)",
      )
      .eq("tenant_id", tenant.id)
      .eq("id", data.subscription_id)
      .maybeSingle();

    if (subscriptionError) throw new Error(subscriptionError.message);
    if (!subscription) throw new Error("Assinatura não encontrada.");

    const patient = Array.isArray(subscription.patients)
      ? subscription.patients[0]
      : subscription.patients;
    if (!patient) throw new Error("Paciente não encontrado.");
    if (!patient.email && !patient.phone) {
      throw new Error("Informe e-mail ou telefone no cadastro do paciente antes de cobrar.");
    }

    const customerId =
      patient.asaas_customer_id ||
      (await createAndStoreAsaasCustomer(supabase, tenant, {
        id: patient.id,
        full_name: patient.full_name,
        email: patient.email,
        phone: patient.phone,
        cpf: patient.cpf,
      }));

    const asaasCredential = getTenantAsaasCredential(tenant);
    const split = buildMedycoSplit(tenant, asaasCredential.usesTenantCredential);

    const charge = await createAsaasPayment({
      customer: customerId,
      billingType: data.billing_type,
      value: data.amount,
      dueDate: data.due_date,
      description: `Assinatura de benefícios - ${tenant.name}`,
      externalReference: subscription.id,
      split,
      apiKey: asaasCredential.apiKey,
    });
    const firstSplit = charge.split?.[0];

    const { data: payment, error } = await supabase
      .from("payments")
      .insert({
        tenant_id: tenant.id,
        patient_id: subscription.patient_id,
        subscription_id: subscription.id,
        amount: data.amount,
        payment_method: data.billing_type.toLowerCase(),
        status: "pending",
        due_date: data.due_date,
        asaas_payment_id: charge.id,
        asaas_invoice_url: charge.invoiceUrl,
        asaas_bank_slip_url: charge.bankSlipUrl,
        asaas_pix_payload: charge.pixQrCode ?? charge.payload,
        asaas_split_wallet_id: firstSplit?.walletId ?? split?.[0]?.walletId,
        asaas_split_fixed_fee: firstSplit?.fixedValue ?? split?.[0]?.fixedValue,
        asaas_split_percentage: firstSplit?.percentualValue ?? split?.[0]?.percentualValue,
        asaas_split_status: firstSplit?.status ?? (split?.length ? "requested" : "not_applied"),
        asaas_net_value: charge.netValue,
        asaas_split_value: firstSplit?.totalValue,
        notes: split?.length
          ? "Cobrança criada via Asaas com taxa fixa e percentual Medyco solicitados."
          : "Cobrança criada via Asaas sem split automático. Configure subconta da clínica e wallet Medyco.",
      })
      .select(
        "id, amount, payment_method, status, due_date, asaas_payment_id, asaas_invoice_url, created_at",
      )
      .single();

    if (error) throw new Error(error.message);

    return { tenant, payment, invoiceUrl: charge.invoiceUrl };
  });

export const sendPaymentReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => sendPaymentReminderSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tenant = await resolveTenant(supabase, data.tenant);

    const { data: payment, error } = await supabase
      .from("payments")
      .select("id, amount, due_date, asaas_invoice_url, status, patients(full_name, email)")
      .eq("tenant_id", tenant.id)
      .eq("id", data.payment_id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!payment) throw new Error("Pagamento não encontrado.");
    if (payment.status === "paid") throw new Error("Este pagamento já está pago.");

    const patient = Array.isArray(payment.patients) ? payment.patients[0] : payment.patients;
    if (!patient?.email) throw new Error("Paciente sem e-mail cadastrado.");

    const template = paymentReminderEmail({
      tenantName: tenant.name,
      patientName: patient.full_name,
      amount: Number(payment.amount),
      dueDate: payment.due_date,
      invoiceUrl: payment.asaas_invoice_url,
    });
    const emailResult = await sendEmail({ to: patient.email, ...template });

    return { tenant, emailResult };
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

async function syncOverduePayments(supabase: SupabaseClient, tenantId: string) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const cutoff = yesterday.toISOString().slice(0, 10);

  const { data: payments, error } = await supabase
    .from("payments")
    .select("id, patient_id, subscription_id")
    .eq("tenant_id", tenantId)
    .eq("status", "pending")
    .not("due_date", "is", null)
    .lte("due_date", cutoff);
  if (error) throw new Error(error.message);
  if (!payments?.length) return;

  const { error: updateError } = await supabase
    .from("payments")
    .update({
      status: "failed",
      notes: "Cobrança marcada automaticamente como vencida pelo financeiro Medyco.",
    })
    .eq("tenant_id", tenantId)
    .in(
      "id",
      payments.map((payment) => payment.id),
    );
  if (updateError) throw new Error(updateError.message);

  await Promise.all(
    payments
      .filter((payment) => payment.subscription_id)
      .map((payment) =>
        syncSubscriptionStatus(
          supabase,
          tenantId,
          payment.patient_id,
          payment.subscription_id!,
          "past_due",
        ),
      ),
  );
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
    .select(
      "id, slug, name, brand_color, plan, status, monthly_fee, split_fixed_fee, split_percentage, patient_subscription_suggestion, asaas_account_id, asaas_wallet_id, asaas_api_key_ref, asaas_onboarding_status, asaas_split_enabled",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Clínica não encontrada ou sem acesso");
  return data;
}

async function createAndStoreAsaasCustomer(
  supabase: SupabaseClient,
  tenant: TenantBillingConfig,
  patient: {
    id: string;
    full_name: string;
    email?: string | null;
    phone?: string | null;
    cpf?: string | null;
  },
) {
  const asaasCredential = getTenantAsaasCredential(tenant);
  const customer = await createAsaasCustomer({
    name: patient.full_name,
    email: patient.email,
    phone: onlyDigits(patient.phone),
    cpfCnpj: onlyDigits(patient.cpf),
    apiKey: asaasCredential.apiKey,
  });

  const { error } = await supabase
    .from("patients")
    .update({ asaas_customer_id: customer.id })
    .eq("tenant_id", tenant.id)
    .eq("id", patient.id);
  if (error) throw new Error(error.message);

  return customer.id;
}

type TenantBillingConfig = {
  id: string;
  slug: string;
  name: string;
  brand_color?: string | null;
  plan?: string | null;
  status: string;
  monthly_fee?: number | string | null;
  split_fixed_fee?: number | string | null;
  split_percentage?: number | string | null;
  patient_subscription_suggestion?: number | string | null;
  asaas_account_id?: string | null;
  asaas_wallet_id?: string | null;
  asaas_api_key_ref?: string | null;
  asaas_onboarding_status?: string | null;
  asaas_split_enabled?: boolean | null;
};

function getTenantAsaasCredential(tenant: TenantBillingConfig) {
  const ref = tenant.asaas_api_key_ref?.trim();
  const apiKey = ref ? process.env[ref] : undefined;
  return {
    apiKey,
    usesTenantCredential: Boolean(apiKey),
    ref,
  };
}

function buildMedycoSplit(tenant: TenantBillingConfig, usesTenantCredential: boolean) {
  const walletId = process.env.ASAAS_MEDYCO_WALLET_ID?.trim();
  const fixedValue = roundMoney(Number(tenant.split_fixed_fee ?? DEFAULT_SPLIT_FIXED_FEE));
  const splitPercentage = Number(tenant.split_percentage ?? DEFAULT_SPLIT_PERCENTAGE);
  const hasSplitValue = fixedValue > 0 || splitPercentage > 0;
  if (!walletId || !tenant.asaas_split_enabled || !hasSplitValue || !usesTenantCredential) {
    return undefined;
  }

  return [
    {
      walletId,
      fixedValue: fixedValue > 0 ? fixedValue : undefined,
      percentualValue: splitPercentage > 0 ? splitPercentage : undefined,
    },
  ] satisfies AsaasSplitInput[];
}

function getAsaasModeLabel(tenant: TenantBillingConfig) {
  if (!isAsaasConfigured()) return "not_configured";
  if (!isAsaasMarketplaceConfigured()) return "platform_without_medyco_wallet";
  if (!tenant.asaas_api_key_ref) return "platform_account_only";
  if (!process.env[tenant.asaas_api_key_ref]) return "tenant_secret_missing";
  return "tenant_subaccount_split";
}

function nextDueDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
}

function onlyDigits(value?: string | null) {
  const cleaned = value?.replace(/\D/g, "");
  return cleaned || undefined;
}

function sumPaid(rows: Array<{ amount: number | string; status: string }>) {
  return rows.reduce((total, row) => {
    if (row.status !== "paid") return total;
    return total + Number(row.amount || 0);
  }, 0);
}
