import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase-ext/auth-middleware";
import {
  createAsaasCustomer,
  createAsaasPayment,
  deleteAsaasPayment,
  getAsaasPayment,
  isAsaasConfigured,
  isAsaasMarketplaceConfigured,
  refundAsaasPayment,
  type AsaasSplitInput,
} from "@/lib/asaas.server";
import {
  DEFAULT_SPLIT_FIXED_FEE,
  DEFAULT_SPLIT_PERCENTAGE,
  roundMoney,
} from "@/lib/commercial-model";
import { paymentReminderEmail } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email.server";
import { recordOperationalEvent } from "@/lib/operational-events.server";
import { assertTenantAdmin } from "@/lib/tenant-auth.server";

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

const paymentActionSchema = sendPaymentReminderSchema.extend({
  reason: z.string().trim().max(500).optional(),
});

const renewSubscriptionSchema = updateSubscriptionSchema.pick({
  tenant: true,
  subscription_id: true,
});

export const getTenantBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => tenantSlugSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tenant = await resolveTenant(supabase, data.tenant);
    await ensurePatientSubscriptions(supabase, tenant.id);
    await syncOverduePayments(supabase, tenant.id);
    await ensurePendingPatientPayments(supabase, tenant);

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
    const { supabase, userId } = context;
    const tenant = await resolveTenant(supabase, data.tenant);
    await assertTenantAdmin(supabase, userId, tenant.id);
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

    await recordOperationalEvent({
      tenantId: tenant.id,
      actorUserId: userId,
      scope: "billing",
      eventType: "payment.manual_created",
      title: "Pagamento manual registrado",
      detail: `${formatCurrency(data.amount)} • ${data.status}`,
      metadata: { payment_id: payment.id, patient_id: data.patient_id },
    });

    return { tenant, payment };
  });

export const updateSubscriptionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateSubscriptionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenant = await resolveTenant(supabase, data.tenant);
    await assertTenantAdmin(supabase, userId, tenant.id);

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
    await recordOperationalEvent({
      tenantId: tenant.id,
      actorUserId: userId,
      scope: "billing",
      eventType: "subscription.status_updated",
      title: "Status da assinatura alterado",
      detail: `Novo status: ${data.status}`,
      metadata: { subscription_id: subscription.id, patient_id: subscription.patient_id },
    });
    return { tenant, subscription };
  });

export const createAsaasCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createAsaasPaymentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenant = await resolveTenant(supabase, data.tenant);
    await assertTenantAdmin(supabase, userId, tenant.id);

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

    const { data: existingCharge, error: existingChargeError } = await supabase
      .from("payments")
      .select(
        "id, amount, payment_method, status, due_date, asaas_payment_id, asaas_invoice_url, created_at",
      )
      .eq("tenant_id", tenant.id)
      .eq("patient_id", subscription.patient_id)
      .eq("subscription_id", subscription.id)
      .eq("status", "pending")
      .not("asaas_payment_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingChargeError) throw new Error(existingChargeError.message);
    if (existingCharge) {
      return { tenant, payment: existingCharge, invoiceUrl: existingCharge.asaas_invoice_url };
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
    const paymentPayload = {
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
    };

    const { data: reusablePayment, error: reusableError } = await supabase
      .from("payments")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("patient_id", subscription.patient_id)
      .eq("subscription_id", subscription.id)
      .eq("status", "pending")
      .is("asaas_payment_id", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reusableError) throw new Error(reusableError.message);

    const paymentQuery = reusablePayment
      ? supabase
          .from("payments")
          .update(paymentPayload)
          .eq("tenant_id", tenant.id)
          .eq("id", reusablePayment.id)
      : supabase.from("payments").insert(paymentPayload);

    const { data: payment, error } = await paymentQuery
      .select(
        "id, amount, payment_method, status, due_date, asaas_payment_id, asaas_invoice_url, created_at",
      )
      .single();

    if (error) throw new Error(error.message);

    await recordOperationalEvent({
      tenantId: tenant.id,
      actorUserId: userId,
      scope: "billing",
      eventType: "payment.asaas_created",
      title: "Cobrança Asaas criada",
      detail: `${formatCurrency(data.amount)} • vencimento ${data.due_date}`,
      metadata: {
        payment_id: payment.id,
        subscription_id: subscription.id,
        asaas_payment_id: charge.id,
        split_requested: Boolean(split?.length),
      },
    });

    return { tenant, payment, invoiceUrl: charge.invoiceUrl };
  });

export const sendPaymentReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => sendPaymentReminderSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenant = await resolveTenant(supabase, data.tenant);
    await assertTenantAdmin(supabase, userId, tenant.id);

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

    await recordOperationalEvent({
      tenantId: tenant.id,
      actorUserId: userId,
      scope: "billing",
      eventType: "payment.reminder_sent",
      title: "Lembrete de cobrança enviado",
      detail: `${patient.full_name} • ${formatCurrency(payment.amount)}`,
      metadata: { payment_id: payment.id, sent: emailResult.sent },
    });

    return { tenant, emailResult };
  });

export const cancelPatientPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => paymentActionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenant = await resolveTenant(supabase, data.tenant);
    await assertTenantAdmin(supabase, userId, tenant.id);
    const payment = await getTenantPayment(supabase, tenant.id, data.payment_id);

    if (payment.status === "paid") {
      throw new Error("Pagamento já pago. Use reembolso para estornar uma cobrança paga.");
    }
    if (payment.status === "canceled") {
      return { tenant, payment };
    }
    if (payment.asaas_payment_id) {
      const credential = getTenantAsaasCredential(tenant);
      await deleteAsaasPayment(payment.asaas_payment_id, credential.apiKey);
    }

    const { data: updated, error } = await supabase
      .from("payments")
      .update({
        status: "canceled",
        notes: appendNote(payment.notes, data.reason || "Cobrança cancelada pela clínica."),
      })
      .eq("tenant_id", tenant.id)
      .eq("id", payment.id)
      .select(
        "id, amount, payment_method, status, paid_at, due_date, asaas_payment_id, asaas_invoice_url, notes, created_at",
      )
      .single();

    if (error) throw new Error(error.message);

    await markSubscriptionPastDueIfNoPaidPayments(
      supabase,
      tenant.id,
      payment.patient_id,
      payment.subscription_id,
    );

    await recordOperationalEvent({
      tenantId: tenant.id,
      actorUserId: userId,
      scope: "billing",
      level: "warning",
      eventType: "payment.canceled",
      title: "Cobrança cancelada",
      detail: `${formatCurrency(payment.amount)} • ${data.reason || "sem motivo informado"}`,
      metadata: { payment_id: payment.id, asaas_payment_id: payment.asaas_payment_id },
    });

    return { tenant, payment: updated };
  });

export const refundPatientPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => paymentActionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenant = await resolveTenant(supabase, data.tenant);
    await assertTenantAdmin(supabase, userId, tenant.id);
    const payment = await getTenantPayment(supabase, tenant.id, data.payment_id);

    if (payment.status !== "paid") {
      throw new Error("Somente pagamentos marcados como pagos podem ser reembolsados.");
    }
    if (!payment.asaas_payment_id) {
      throw new Error("Este pagamento não tem ID Asaas. Registre o estorno manual em observações.");
    }

    const credential = getTenantAsaasCredential(tenant);
    const refunded = await refundAsaasPayment(payment.asaas_payment_id, credential.apiKey);

    const { data: updated, error } = await supabase
      .from("payments")
      .update({
        status: "refunded",
        notes: appendNote(payment.notes, data.reason || "Pagamento reembolsado no Asaas."),
        asaas_net_value: refunded.netValue ?? payment.asaas_net_value,
      })
      .eq("tenant_id", tenant.id)
      .eq("id", payment.id)
      .select(
        "id, amount, payment_method, status, paid_at, due_date, asaas_payment_id, asaas_invoice_url, notes, created_at",
      )
      .single();

    if (error) throw new Error(error.message);
    await markSubscriptionPastDueIfNoPaidPayments(
      supabase,
      tenant.id,
      payment.patient_id,
      payment.subscription_id,
    );

    await recordOperationalEvent({
      tenantId: tenant.id,
      actorUserId: userId,
      scope: "billing",
      level: "warning",
      eventType: "payment.refunded",
      title: "Pagamento reembolsado",
      detail: `${formatCurrency(payment.amount)} • ${data.reason || "sem motivo informado"}`,
      metadata: { payment_id: payment.id, asaas_payment_id: payment.asaas_payment_id },
    });

    return { tenant, payment: updated };
  });

export const reconcilePatientPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => sendPaymentReminderSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenant = await resolveTenant(supabase, data.tenant);
    await assertTenantAdmin(supabase, userId, tenant.id);
    const payment = await getTenantPayment(supabase, tenant.id, data.payment_id);

    if (!payment.asaas_payment_id) {
      throw new Error("Este pagamento ainda não tem cobrança Asaas para conciliar.");
    }

    const credential = getTenantAsaasCredential(tenant);
    const asaasPayment = await getAsaasPayment(payment.asaas_payment_id, credential.apiKey);
    const mapped = mapAsaasPaymentStatus(asaasPayment.status);

    const { data: updated, error } = await supabase
      .from("payments")
      .update({
        status: mapped.status,
        paid_at: mapped.status === "paid" ? new Date().toISOString() : payment.paid_at,
        confirmed_at: mapped.status === "paid" ? new Date().toISOString() : payment.confirmed_at,
        due_date: asaasPayment.dueDate ?? payment.due_date,
        asaas_invoice_url: asaasPayment.invoiceUrl ?? payment.asaas_invoice_url,
        asaas_bank_slip_url: asaasPayment.bankSlipUrl ?? payment.asaas_bank_slip_url,
        asaas_net_value: asaasPayment.netValue ?? payment.asaas_net_value,
        asaas_split_status: asaasPayment.split?.[0]?.status ?? payment.asaas_split_status,
        asaas_split_value: asaasPayment.split?.[0]?.totalValue ?? payment.asaas_split_value,
        notes: appendNote(
          payment.notes,
          `Conciliação Asaas: ${asaasPayment.status ?? "sem status"}.`,
        ),
      })
      .eq("tenant_id", tenant.id)
      .eq("id", payment.id)
      .select(
        "id, amount, payment_method, status, paid_at, due_date, asaas_payment_id, asaas_invoice_url, asaas_split_status, notes, created_at",
      )
      .single();

    if (error) throw new Error(error.message);

    if (mapped.status === "paid") {
      await syncSubscriptionStatus(
        supabase,
        tenant.id,
        payment.patient_id,
        payment.subscription_id,
        "active",
      );
    }
    if (mapped.status === "failed") {
      await syncSubscriptionStatus(
        supabase,
        tenant.id,
        payment.patient_id,
        payment.subscription_id,
        "past_due",
      );
    }

    await recordOperationalEvent({
      tenantId: tenant.id,
      actorUserId: userId,
      scope: "billing",
      eventType: "payment.reconciled",
      title: "Pagamento conciliado com Asaas",
      detail: `${asaasPayment.status ?? "sem status"} → ${mapped.status}`,
      metadata: { payment_id: payment.id, asaas_payment_id: payment.asaas_payment_id },
    });

    return { tenant, payment: updated };
  });

export const renewPatientSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => renewSubscriptionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenant = await resolveTenant(supabase, data.tenant);
    await assertTenantAdmin(supabase, userId, tenant.id);

    const { data: subscription, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select("id, patient_id, status, next_due_date")
      .eq("tenant_id", tenant.id)
      .eq("id", data.subscription_id)
      .maybeSingle();
    if (subscriptionError) throw new Error(subscriptionError.message);
    if (!subscription) throw new Error("Assinatura não encontrada.");

    const amount = calculateSubscriptionAmount(
      tenant,
      (await countActiveDependentsByPatient(supabase, tenant.id, [subscription.patient_id])).get(
        subscription.patient_id,
      ) ?? 0,
    );
    if (amount <= 0) throw new Error("Valor da assinatura não configurado.");

    const { data: existingPending, error: existingError } = await supabase
      .from("payments")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("subscription_id", subscription.id)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existingPending) {
      throw new Error("Já existe uma cobrança pendente para esta assinatura.");
    }

    const dueDate = today();
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        tenant_id: tenant.id,
        patient_id: subscription.patient_id,
        subscription_id: subscription.id,
        amount,
        payment_method: "manual",
        status: "pending",
        due_date: dueDate,
        notes: "Renovação manual gerada pela clínica.",
      })
      .select("id, amount, status, due_date, created_at")
      .single();
    if (paymentError) throw new Error(paymentError.message);

    await syncSubscriptionStatus(
      supabase,
      tenant.id,
      subscription.patient_id,
      subscription.id,
      "past_due",
    );

    await recordOperationalEvent({
      tenantId: tenant.id,
      actorUserId: userId,
      scope: "billing",
      eventType: "subscription.renewal_created",
      title: "Renovação gerada",
      detail: `${formatCurrency(amount)} • vencimento hoje`,
      metadata: { subscription_id: subscription.id, payment_id: payment.id },
    });

    return { tenant, payment };
  });

async function getTenantPayment(supabase: SupabaseClient, tenantId: string, paymentId: string) {
  const { data, error } = await supabase
    .from("payments")
    .select(
      "id, tenant_id, patient_id, subscription_id, amount, payment_method, status, paid_at, due_date, confirmed_at, asaas_payment_id, asaas_invoice_url, asaas_bank_slip_url, asaas_net_value, asaas_split_value, asaas_split_status, notes, created_at",
    )
    .eq("tenant_id", tenantId)
    .eq("id", paymentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Pagamento não encontrado.");
  if (!data.subscription_id) throw new Error("Pagamento sem assinatura vinculada.");
  return data;
}

async function markSubscriptionPastDueIfNoPaidPayments(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string,
  subscriptionId: string,
) {
  const { count, error } = await supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("subscription_id", subscriptionId)
    .eq("status", "paid");
  if (error) throw new Error(error.message);
  if ((count ?? 0) === 0) {
    await syncSubscriptionStatus(supabase, tenantId, patientId, subscriptionId, "past_due");
  }
}

function appendNote(current: string | null | undefined, note: string) {
  const timestamp = new Date().toLocaleString("pt-BR");
  return [current, `[${timestamp}] ${note}`].filter(Boolean).join("\n");
}

function mapAsaasPaymentStatus(status?: string) {
  const normalized = status?.toUpperCase();
  if (["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(normalized ?? "")) {
    return { status: "paid" as const };
  }
  if (
    ["OVERDUE", "REFUNDED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE"].includes(normalized ?? "")
  ) {
    return { status: "failed" as const };
  }
  if (["DELETED", "CANCELLED"].includes(normalized ?? "")) {
    return { status: "canceled" as const };
  }
  return { status: "pending" as const };
}

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
      status: "past_due",
      next_due_date: nextDueDate(),
    })),
  );
  if (error) throw new Error(error.message);
}

async function ensurePendingPatientPayments(supabase: SupabaseClient, tenant: TenantBillingConfig) {
  const todayValue = today();
  const [
    { data: subscriptions, error: subscriptionsError },
    { data: payments, error: paymentsError },
  ] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id, tenant_id, patient_id, status, next_due_date, patients(status)")
      .eq("tenant_id", tenant.id),
    supabase
      .from("payments")
      .select("subscription_id, status")
      .eq("tenant_id", tenant.id)
      .in("status", ["pending", "paid"]),
  ]);

  if (subscriptionsError) throw new Error(subscriptionsError.message);
  if (paymentsError) throw new Error(paymentsError.message);
  if (!subscriptions?.length) return;

  const pendingSubscriptions = new Set(
    (payments ?? [])
      .filter((payment) => payment.status === "pending")
      .map((payment) => payment.subscription_id)
      .filter(Boolean),
  );

  const dueSubscriptions = subscriptions.filter((subscription) => {
    if (pendingSubscriptions.has(subscription.id)) return false;
    if (["canceled", "paused"].includes(subscription.status)) return false;
    const patient = Array.isArray(subscription.patients)
      ? subscription.patients[0]
      : subscription.patients;
    if (patient?.status === "inactive") return false;
    if (subscription.status === "active" && subscription.next_due_date) {
      return subscription.next_due_date <= todayValue;
    }
    return true;
  });

  if (dueSubscriptions.length === 0) return;

  const dependentCounts = await countActiveDependentsByPatient(
    supabase,
    tenant.id,
    dueSubscriptions.map((subscription) => subscription.patient_id),
  );
  const rows = dueSubscriptions
    .map((subscription) => {
      const amount = calculateSubscriptionAmount(
        tenant,
        dependentCounts.get(subscription.patient_id) ?? 0,
      );
      if (!Number.isFinite(amount) || amount <= 0) return null;
      return {
        tenant_id: tenant.id,
        patient_id: subscription.patient_id,
        subscription_id: subscription.id,
        amount,
        payment_method: "manual",
        status: "pending",
        due_date:
          subscription.next_due_date && subscription.next_due_date <= todayValue
            ? subscription.next_due_date
            : todayValue,
        notes: "Cobrança pendente gerada automaticamente pelo ciclo financeiro Medyco.",
      };
    })
    .filter(Boolean);

  if (rows.length === 0) return;

  const { error } = await supabase.from("payments").insert(rows);
  if (error) throw new Error(error.message);
}

async function countActiveDependentsByPatient(
  supabase: SupabaseClient,
  tenantId: string,
  patientIds: string[],
) {
  const counts = new Map<string, number>();
  if (patientIds.length === 0) return counts;

  const { data, error } = await supabase
    .from("patient_dependents")
    .select("patient_id")
    .eq("tenant_id", tenantId)
    .in("patient_id", patientIds)
    .eq("status", "active");
  if (error) throw new Error(error.message);

  for (const dependent of data ?? []) {
    counts.set(dependent.patient_id, (counts.get(dependent.patient_id) ?? 0) + 1);
  }
  return counts;
}

function calculateSubscriptionAmount(tenant: TenantBillingConfig, dependentCount: number) {
  const baseAmount = Number(tenant.patient_subscription_suggestion ?? 39.9);
  const dependentAmount = Number(tenant.dependent_extra_amount ?? 0);
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) return 0;
  const extras =
    Number.isFinite(dependentAmount) && dependentAmount > 0 ? dependentCount * dependentAmount : 0;
  return roundMoney(baseAmount + extras);
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
      status: "past_due",
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
      "id, slug, name, brand_color, plan, status, monthly_fee, split_fixed_fee, split_percentage, patient_subscription_suggestion, dependent_extra_amount, asaas_account_id, asaas_wallet_id, asaas_api_key_ref, asaas_onboarding_status, asaas_split_enabled",
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
  dependent_extra_amount?: number | string | null;
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

function today() {
  return new Date().toISOString().slice(0, 10);
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

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}
