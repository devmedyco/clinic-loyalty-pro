import { supabaseAdmin } from "@/integrations/supabase-ext/client.server";

type AsaasWebhookPayload = {
  id?: string;
  event?: string;
  payment?: {
    id?: string;
    status?: string;
    paymentDate?: string;
    clientPaymentDate?: string;
    confirmedDate?: string;
    invoiceUrl?: string;
    bankSlipUrl?: string;
    dateCreated?: string;
    netValue?: number;
    split?: Array<{
      walletId?: string;
      fixedValue?: number;
      percentualValue?: number;
      status?: string;
      totalValue?: number;
      netValue?: number;
    }>;
  };
};

export async function handleAsaasWebhook(request: Request) {
  if (request.method !== "POST") {
    return json({ error: "Método não permitido." }, 405);
  }

  const tokenError = validateWebhookToken(request);
  if (tokenError) return tokenError;

  const payload = (await request.json()) as AsaasWebhookPayload;
  const event = payload.event ?? "UNKNOWN";
  const payment = payload.payment;
  const eventId = buildEventId(payload, event);

  const { error: eventError } = await supabaseAdmin.from("asaas_webhook_events").upsert(
    {
      id: eventId,
      event,
      asaas_payment_id: payment?.id,
      payload,
    },
    { ignoreDuplicates: true },
  );
  if (eventError) return json({ error: eventError.message }, 500);

  if (!payment?.id) {
    return json({ received: true, ignored: "payment_not_found" });
  }

  const mappedStatus = mapAsaasStatus(event, payment.status);
  if (!mappedStatus) {
    return json({ received: true, ignored: "status_not_mapped" });
  }

  const paidAt =
    mappedStatus === "paid"
      ? (payment.clientPaymentDate ??
        payment.paymentDate ??
        payment.confirmedDate ??
        new Date().toISOString())
      : null;
  const firstSplit = payment.split?.[0];

  const { data: paymentRow, error: paymentError } = await supabaseAdmin
    .from("payments")
    .update({
      status: mappedStatus,
      paid_at: paidAt,
      confirmed_at: paidAt,
      asaas_invoice_url: payment.invoiceUrl,
      asaas_bank_slip_url: payment.bankSlipUrl,
      asaas_net_value: payment.netValue,
      asaas_split_wallet_id: firstSplit?.walletId,
      asaas_split_fixed_fee: firstSplit?.fixedValue,
      asaas_split_percentage: firstSplit?.percentualValue,
      asaas_split_status: firstSplit?.status,
      asaas_split_value: firstSplit?.totalValue,
    })
    .eq("asaas_payment_id", payment.id)
    .select("id, tenant_id, patient_id, subscription_id")
    .maybeSingle();

  if (paymentError) return json({ error: paymentError.message }, 500);
  if (!paymentRow) {
    return json({ received: true, ignored: "local_payment_not_found" });
  }

  await syncSubscriptionFromPayment(paymentRow, mappedStatus);
  return json({ received: true });
}

function validateWebhookToken(request: Request) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!expected) {
    return json({ error: "ASAAS_WEBHOOK_TOKEN não configurado." }, 503);
  }

  const received =
    request.headers.get("asaas-access-token") ??
    request.headers.get("access_token") ??
    request.headers.get("x-asaas-token") ??
    "";

  if (received !== expected) {
    return json({ error: "Token inválido." }, 401);
  }

  return null;
}

function buildEventId(payload: AsaasWebhookPayload, event: string) {
  if (payload.id) return payload.id;
  const paymentId = payload.payment?.id ?? "no-payment";
  const marker =
    payload.payment?.dateCreated ??
    payload.payment?.confirmedDate ??
    payload.payment?.paymentDate ??
    new Date().toISOString();
  return `${event}:${paymentId}:${marker}`;
}

function mapAsaasStatus(event: string, status?: string) {
  const signal = `${event}:${status ?? ""}`.toUpperCase();

  if (
    signal.includes("PAYMENT_RECEIVED") ||
    signal.includes("PAYMENT_CONFIRMED") ||
    signal.includes(":RECEIVED") ||
    signal.includes(":CONFIRMED")
  ) {
    return "paid" as const;
  }

  if (signal.includes("OVERDUE") || signal.includes("FAILED")) return "failed" as const;
  if (signal.includes("REFUNDED")) return "refunded" as const;
  if (signal.includes("DELETED") || signal.includes("CANCELED") || signal.includes("CANCELLED")) {
    return "canceled" as const;
  }

  if (signal.includes("PENDING") || signal.includes("AWAITING")) return "pending" as const;
  return null;
}

async function syncSubscriptionFromPayment(
  payment: {
    tenant_id: string;
    patient_id: string;
    subscription_id: string | null;
  },
  status: "pending" | "paid" | "failed" | "refunded" | "canceled",
) {
  if (!payment.subscription_id) return;

  const subscriptionStatus =
    status === "paid" ? "active" : status === "failed" ? "past_due" : undefined;
  if (!subscriptionStatus) return;

  const { error: subscriptionError } = await supabaseAdmin
    .from("subscriptions")
    .update({
      status: subscriptionStatus,
      next_due_date: subscriptionStatus === "active" ? nextDueDate() : undefined,
    })
    .eq("tenant_id", payment.tenant_id)
    .eq("id", payment.subscription_id);
  if (subscriptionError) throw new Error(subscriptionError.message);

  const { error: patientError } = await supabaseAdmin
    .from("patients")
    .update({ status: subscriptionStatus === "active" ? "active" : "delinquent" })
    .eq("tenant_id", payment.tenant_id)
    .eq("id", payment.patient_id);
  if (patientError) throw new Error(patientError.message);
}

function nextDueDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
