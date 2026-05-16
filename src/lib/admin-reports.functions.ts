import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase-ext/auth-middleware";

export const getAdminMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
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
            "id, name, slug, status, monthly_fee, split_percentage, commercial_model, created_at",
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
    const { supabase } = context;

    const { data: tenants, error } = await supabase
      .from("tenants")
      .select("id, name, slug, status, monthly_fee, split_percentage, commercial_model, created_at")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    const rows = (tenants ?? []).map((tenant) => ({
      ...tenant,
      expected_amount: Number(tenant.monthly_fee ?? 197),
      billing_status:
        tenant.status === "active"
          ? "operacional"
          : tenant.status === "trial"
            ? "trial"
            : tenant.status,
    }));

    return {
      totals: {
        tenants: rows.length,
        activeTenants: rows.filter((tenant) => ["active", "trial"].includes(tenant.status)).length,
        expectedMrr: rows.reduce((total, tenant) => total + tenant.expected_amount, 0),
        averageSplit:
          rows.length > 0
            ? rows.reduce((total, tenant) => total + Number(tenant.split_percentage ?? 10), 0) /
              rows.length
            : 0,
        billingConnected: false,
      },
      tenants: rows,
    };
  });

export const getAdminAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

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
  .handler(async () => ({
    resendConfigured: Boolean(process.env.RESEND_API_KEY),
    emailFrom: process.env.EMAIL_FROM || "Medyco <no-reply@medyco.com.br>",
    appBaseUrl: process.env.APP_BASE_URL || "https://medyco.com.br",
    asaasConfigured: Boolean(process.env.ASAAS_API_KEY),
    asaasEnvironment: process.env.ASAAS_ENVIRONMENT || "sandbox",
    asaasMedycoWalletConfigured: Boolean(process.env.ASAAS_MEDYCO_WALLET_ID),
    asaasMarketplaceReady: Boolean(process.env.ASAAS_API_KEY && process.env.ASAAS_MEDYCO_WALLET_ID),
  }));

export const getAdminReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    const [tenants, patients, payments, legalDocuments, invitations] = await Promise.all([
      supabase
        .from("tenants")
        .select(
          "id, name, slug, cnpj, email, status, monthly_fee, split_percentage, asaas_onboarding_status, asaas_api_key_ref, asaas_wallet_id",
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
