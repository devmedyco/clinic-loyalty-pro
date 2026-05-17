import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase-ext/auth-middleware";
import { assertSuperAdminAccess } from "@/lib/admin-auth.server";
import {
  DEFAULT_MONTHLY_FEE,
  DEFAULT_SPLIT_FIXED_FEE,
  DEFAULT_SPLIT_PERCENTAGE,
} from "@/lib/commercial-model";
import {
  createAsaasCustomer,
  createAsaasSubscription,
  deleteAsaasSubscription,
  isAsaasConfigured,
  listAsaasSubscriptionPayments,
} from "@/lib/asaas.server";
import { clinicSaasBillingEmail } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email.server";

const startTenantSaasBillingSchema = z.object({
  tenant_id: z.string().uuid(),
  billing_type: z.enum(["PIX", "BOLETO", "CREDIT_CARD"]).default("PIX"),
});

const cancelTenantSaasBillingSchema = z.object({
  tenant_id: z.string().uuid(),
});

export const getAdminMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertSuperAdminAccess(supabase, userId);
    const since30 = daysAgo(30);

    const [tenants, patients, validations, executions, services, invitations, recentTenants] =
      await Promise.all([
        supabase.from("tenants").select("commercial_model, status, created_at"),
        supabase.from("patients").select("status, created_at"),
        supabase
          .from("card_validations")
          .select("outcome, validated_at")
          .gte("validated_at", since30),
        supabase.from("service_executions").select("final_amount, discount_amount, created_at"),
        supabase.from("services").select("active"),
        supabase.from("staff_invitations").select("status, created_at"),
        supabase
          .from("tenants")
          .select(
            "id, name, slug, status, monthly_fee, split_fixed_fee, split_percentage, commercial_model, created_at",
          )
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

    for (const result of [
      tenants,
      patients,
      validations,
      executions,
      services,
      invitations,
      recentTenants,
    ]) {
      if (result.error) throw new Error(result.error.message);
    }

    const tenantRows = tenants.data ?? [];
    const patientRows = patients.data ?? [];
    const validationRows = validations.data ?? [];
    const executionRows = executions.data ?? [];
    const serviceRows = services.data ?? [];
    const inviteRows = invitations.data ?? [];

    return {
      totals: {
        tenants: tenantRows.length,
        activeTenants: tenantRows.filter((tenant) => ["trial", "active"].includes(tenant.status))
          .length,
        patients: patientRows.length,
        activePatients: patientRows.filter((patient) => patient.status === "active").length,
        validations30d: validationRows.length,
        deniedValidations30d: validationRows.filter((item) => item.outcome !== "approved").length,
        executions: executionRows.length,
        revenue: sumAmounts(executionRows, "final_amount"),
        savings: sumAmounts(executionRows, "discount_amount"),
        services: serviceRows.length,
        activeServices: serviceRows.filter((service) => service.active).length,
        pendingInvites: inviteRows.filter((invite) => invite.status === "pending").length,
      },
      commercialModel: groupCount(tenantRows, "commercial_model"),
      tenantStatus: groupCount(tenantRows, "status"),
      patientStatus: groupCount(patientRows, "status"),
      recentTenants: recentTenants.data ?? [],
    };
  });

export const getAdminBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertSuperAdminAccess(supabase, userId);

    const { data: tenants, error } = await supabase
      .from("tenants")
      .select(
        "id, name, slug, status, email, cnpj, monthly_fee, split_fixed_fee, split_percentage, commercial_model, asaas_saas_customer_id, asaas_saas_subscription_id, saas_billing_status, saas_billing_type, saas_next_due_date, saas_invoice_url, saas_billing_error, created_at",
      )
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    const rows = (tenants ?? []).map((tenant) => ({
      ...tenant,
      expected_amount: Number(tenant.monthly_fee ?? 197),
      billing_status: tenant.saas_billing_status ?? "not_started",
    }));

    return {
      totals: {
        tenants: rows.length,
        activeTenants: rows.filter((tenant) => ["active", "trial"].includes(tenant.status)).length,
        expectedMrr: rows.reduce((total, tenant) => total + tenant.expected_amount, 0),
        averageSplit:
          rows.length > 0
            ? rows.reduce(
                (total, tenant) =>
                  total + Number(tenant.split_percentage ?? DEFAULT_SPLIT_PERCENTAGE),
                0,
              ) / rows.length
            : 0,
        averageFixedFee:
          rows.length > 0
            ? rows.reduce(
                (total, tenant) =>
                  total + Number(tenant.split_fixed_fee ?? DEFAULT_SPLIT_FIXED_FEE),
                0,
              ) / rows.length
            : 0,
        billingConnected: rows.some((tenant) => Boolean(tenant.asaas_saas_subscription_id)),
        billingPending: rows.filter((tenant) => tenant.saas_billing_status === "pending").length,
        billingActive: rows.filter((tenant) => tenant.saas_billing_status === "active").length,
        asaasConfigured: isAsaasConfigured(),
      },
      tenants: rows,
    };
  });

export const startTenantSaasBilling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => startTenantSaasBillingSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdminAccess(supabase, userId);

    if (!isAsaasConfigured()) {
      throw new Error("Asaas principal ainda não configurado. Salve ASAAS_API_KEY nos secrets.");
    }

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select(
        "id, name, legal_name, slug, email, phone, cnpj, monthly_fee, asaas_saas_customer_id, asaas_saas_subscription_id, saas_billing_status",
      )
      .eq("id", data.tenant_id)
      .maybeSingle();

    if (tenantError) throw new Error(tenantError.message);
    if (!tenant) throw new Error("Clínica não encontrada.");
    if (
      tenant.asaas_saas_subscription_id &&
      !["canceled", "failed"].includes(tenant.saas_billing_status ?? "")
    ) {
      throw new Error("Esta clínica já tem uma assinatura SaaS criada no Asaas.");
    }
    if (!tenant.email) {
      throw new Error("Cadastre o e-mail financeiro da clínica antes de ativar a mensalidade.");
    }

    const monthlyFee = Number(tenant.monthly_fee ?? DEFAULT_MONTHLY_FEE);
    if (monthlyFee <= 0) throw new Error("A mensalidade da clínica precisa ser maior que zero.");

    let customerId = tenant.asaas_saas_customer_id;
    if (!customerId) {
      const customer = await createAsaasCustomer({
        name: tenant.legal_name || tenant.name,
        email: tenant.email,
        phone: tenant.phone,
        cpfCnpj: tenant.cnpj,
      });
      customerId = customer.id;
    }

    const firstDueDate = today();
    const subscription = await createAsaasSubscription({
      customer: customerId,
      billingType: data.billing_type,
      value: monthlyFee,
      nextDueDate: firstDueDate,
      cycle: "MONTHLY",
      description: `Mensalidade Medyco - ${tenant.name}`,
      externalReference: `tenant:${tenant.id}:saas`,
    });
    const firstPayment = await getFirstSubscriptionPayment(subscription.id);

    const { data: updatedTenant, error: updateError } = await supabase
      .from("tenants")
      .update({
        asaas_saas_customer_id: customerId,
        asaas_saas_subscription_id: subscription.id,
        saas_billing_status: "pending",
        saas_billing_type: data.billing_type,
        saas_next_due_date: firstPayment?.dueDate ?? subscription.nextDueDate ?? firstDueDate,
        saas_invoice_url: firstPayment?.invoiceUrl,
        saas_last_payment_id: firstPayment?.id,
        saas_started_at: new Date().toISOString(),
        saas_canceled_at: null,
        saas_billing_error: null,
      })
      .eq("id", tenant.id)
      .select(
        "id, name, slug, status, email, cnpj, monthly_fee, split_fixed_fee, split_percentage, commercial_model, asaas_saas_customer_id, asaas_saas_subscription_id, saas_billing_status, saas_billing_type, saas_next_due_date, saas_invoice_url, saas_billing_error, created_at",
      )
      .single();

    if (updateError) throw new Error(updateError.message);

    const emailTemplate = clinicSaasBillingEmail({
      tenantName: tenant.name,
      amount: monthlyFee,
      dueDate: firstPayment?.dueDate ?? subscription.nextDueDate ?? firstDueDate,
      invoiceUrl: firstPayment?.invoiceUrl,
    });
    const billingEmail = await sendEmail({ to: tenant.email, ...emailTemplate });

    return {
      tenant: updatedTenant,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        nextDueDate: firstPayment?.dueDate ?? subscription.nextDueDate ?? firstDueDate,
        invoiceUrl: firstPayment?.invoiceUrl,
      },
      billingEmail,
    };
  });

export const cancelTenantSaasBilling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => cancelTenantSaasBillingSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdminAccess(supabase, userId);

    if (!isAsaasConfigured()) {
      throw new Error("Asaas principal ainda não configurado. Salve ASAAS_API_KEY nos secrets.");
    }

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id, name, asaas_saas_subscription_id")
      .eq("id", data.tenant_id)
      .maybeSingle();

    if (tenantError) throw new Error(tenantError.message);
    if (!tenant) throw new Error("Clínica não encontrada.");
    if (!tenant.asaas_saas_subscription_id) {
      throw new Error("Esta clínica ainda não tem assinatura SaaS no Asaas.");
    }

    await deleteAsaasSubscription(tenant.asaas_saas_subscription_id);

    const { data: updatedTenant, error: updateError } = await supabase
      .from("tenants")
      .update({
        saas_billing_status: "canceled",
        saas_canceled_at: new Date().toISOString(),
        saas_billing_error: null,
      })
      .eq("id", tenant.id)
      .select(
        "id, name, slug, status, email, cnpj, monthly_fee, split_fixed_fee, split_percentage, commercial_model, asaas_saas_customer_id, asaas_saas_subscription_id, saas_billing_status, saas_billing_type, saas_next_due_date, saas_invoice_url, saas_billing_error, created_at",
      )
      .single();

    if (updateError) throw new Error(updateError.message);

    return { tenant: updatedTenant };
  });

export const getAdminAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertSuperAdminAccess(supabase, userId);

    const [validations, executions, invitations, tenants] = await Promise.all([
      supabase
        .from("card_validations")
        .select("id, outcome, reason, validated_at, tenants(name, slug)")
        .order("validated_at", { ascending: false })
        .limit(12),
      supabase
        .from("service_executions")
        .select("id, final_amount, created_at, tenants(name, slug), patients(full_name)")
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("staff_invitations")
        .select("id, email, role, status, created_at, tenants(name, slug)")
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("tenants")
        .select("id, name, slug, status, created_at")
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

    for (const result of [validations, executions, invitations, tenants]) {
      if (result.error) throw new Error(result.error.message);
    }

    return {
      events: [
        ...(validations.data ?? []).map((item) => ({
          id: `validation-${item.id}`,
          type: "Validação de cartão",
          title: item.outcome === "approved" ? "Cartão autorizado" : "Cartão negado",
          detail: item.reason || tenantLabel(item.tenants),
          tenant: tenantLabel(item.tenants),
          created_at: item.validated_at,
        })),
        ...(executions.data ?? []).map((item) => ({
          id: `execution-${item.id}`,
          type: "Atendimento",
          title: `Atendimento de ${patientLabel(item.patients)}`,
          detail: formatCurrency(item.final_amount),
          tenant: tenantLabel(item.tenants),
          created_at: item.created_at,
        })),
        ...(invitations.data ?? []).map((item) => ({
          id: `invite-${item.id}`,
          type: "Convite",
          title: item.email,
          detail: `${roleLabel(item.role)} • ${statusLabel(item.status)}`,
          tenant: tenantLabel(item.tenants),
          created_at: item.created_at,
        })),
        ...(tenants.data ?? []).map((item) => ({
          id: `tenant-${item.id}`,
          type: "Tenant",
          title: item.name,
          detail: `/${item.slug} • ${item.status}`,
          tenant: item.name,
          created_at: item.created_at,
        })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    };
  });

export const getAdminSettingsStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertSuperAdminAccess(supabase, userId);

    return {
      resendConfigured: Boolean(process.env.RESEND_API_KEY),
      emailFrom: process.env.EMAIL_FROM || "Medyco <no-reply@medyco.com.br>",
      appBaseUrl: process.env.APP_BASE_URL || "https://medyco.com.br",
      asaasConfigured: Boolean(process.env.ASAAS_API_KEY),
      asaasEnvironment: process.env.ASAAS_ENVIRONMENT || "sandbox",
      asaasMedycoWalletConfigured: Boolean(process.env.ASAAS_MEDYCO_WALLET_ID),
      asaasWebhookConfigured: Boolean(process.env.ASAAS_WEBHOOK_TOKEN),
      asaasMarketplaceReady: Boolean(
        process.env.ASAAS_API_KEY && process.env.ASAAS_MEDYCO_WALLET_ID,
      ),
    };
  });

export const getAdminReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertSuperAdminAccess(supabase, userId);

    const [tenants, patients, payments, legalDocuments, invitations] = await Promise.all([
      supabase
        .from("tenants")
        .select(
          "id, name, slug, cnpj, email, status, monthly_fee, split_fixed_fee, split_percentage, asaas_onboarding_status, asaas_api_key_ref, asaas_wallet_id, asaas_saas_subscription_id, saas_billing_status",
        ),
      supabase.from("patients").select("id, tenant_id, status, user_id, email, cpf"),
      supabase.from("payments").select("id, tenant_id, status, asaas_payment_id"),
      supabase.from("legal_documents").select("id, type, active"),
      supabase.from("staff_invitations").select("id, status"),
    ]);

    for (const result of [tenants, patients, payments, legalDocuments, invitations]) {
      if (result.error) throw new Error(result.error.message);
    }

    const tenantRows = tenants.data ?? [];
    const patientRows = patients.data ?? [];
    const paymentRows = payments.data ?? [];
    const legalRows = legalDocuments.data ?? [];
    const inviteRows = invitations.data ?? [];

    const activeLegalTypes = new Set(
      legalRows.filter((document) => document.active).map((document) => document.type),
    );
    const tenantGaps = tenantRows
      .map((tenant) => ({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        gaps: [
          !tenant.cnpj ? "CNPJ" : null,
          !tenant.email ? "e-mail" : null,
          !tenant.asaas_wallet_id ? "wallet Asaas" : null,
          !tenant.asaas_api_key_ref ? "secret Asaas" : null,
          tenant.asaas_onboarding_status !== "active" ? "Asaas ativo" : null,
          !tenant.asaas_saas_subscription_id ? "mensalidade Medyco" : null,
          tenant.saas_billing_status === "overdue" ? "mensalidade em atraso" : null,
        ].filter(Boolean),
      }))
      .filter((tenant) => tenant.gaps.length > 0);

    return {
      environment: {
        resend: Boolean(process.env.RESEND_API_KEY),
        appBaseUrl: Boolean(process.env.APP_BASE_URL),
        asaasApi: Boolean(process.env.ASAAS_API_KEY),
        asaasWallet: Boolean(process.env.ASAAS_MEDYCO_WALLET_ID),
        asaasWebhook: Boolean(process.env.ASAAS_WEBHOOK_TOKEN),
      },
      totals: {
        tenants: tenantRows.length,
        activeTenants: tenantRows.filter((tenant) => ["active", "trial"].includes(tenant.status))
          .length,
        patients: patientRows.length,
        linkedPatients: patientRows.filter((patient) => Boolean(patient.user_id)).length,
        payments: paymentRows.length,
        asaasPayments: paymentRows.filter((payment) => Boolean(payment.asaas_payment_id)).length,
        pendingInvites: inviteRows.filter((invite) => invite.status === "pending").length,
      },
      legal: {
        patientTerms: activeLegalTypes.has("patient_terms"),
        privacyPolicy: activeLegalTypes.has("privacy_policy"),
        platformTerms: activeLegalTypes.has("platform_terms"),
        clinicAgreement: activeLegalTypes.has("clinic_agreement"),
        billingPolicy: activeLegalTypes.has("billing_policy"),
      },
      tenants: tenantRows,
      tenantGaps,
    };
  });

function groupCount<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  return rows.reduce<Record<string, number>>((groups, row) => {
    const value = String(row[key] ?? "sem_status");
    groups[value] = (groups[value] ?? 0) + 1;
    return groups;
  }, {});
}

function sumAmounts<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function getFirstSubscriptionPayment(subscriptionId: string) {
  try {
    const payments = await listAsaasSubscriptionPayments(subscriptionId);
    return payments.data?.[0] ?? null;
  } catch {
    return null;
  }
}

function tenantLabel(value: unknown) {
  const tenant = Array.isArray(value) ? value[0] : value;
  if (!tenant || typeof tenant !== "object") return "Medyco";
  return "name" in tenant && typeof tenant.name === "string" ? tenant.name : "Medyco";
}

function patientLabel(value: unknown) {
  const patient = Array.isArray(value) ? value[0] : value;
  if (!patient || typeof patient !== "object") return "paciente";
  return "full_name" in patient && typeof patient.full_name === "string"
    ? patient.full_name
    : "paciente";
}

function roleLabel(role: string) {
  return role === "tenant_admin" ? "Admin clínica" : "Funcionário";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "pendente",
    accepted: "aceito",
    revoked: "revogado",
    expired: "expirado",
  };
  return labels[status] ?? status;
}

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}
