import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase-ext/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase-ext/client.server";
import { createAsaasSubaccount } from "@/lib/asaas.server";
import {
  DEFAULT_MONTHLY_FEE,
  DEFAULT_PATIENT_SUBSCRIPTION,
  DEFAULT_SPLIT_FIXED_FEE,
  DEFAULT_SPLIT_PERCENTAGE,
} from "@/lib/commercial-model";
import { clinicOnboardingEmail } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email.server";

export const listMyTenants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("tenants")
      .select(
        "id, slug, name, brand_color, plan, status, monthly_fee, split_fixed_fee, split_percentage, commercial_model, asaas_onboarding_status, asaas_wallet_id, asaas_api_key_ref, created_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { tenants: data ?? [] };
  });

const optionalText = (max = 180) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional(),
  );

const createTenantSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Apenas letras minúsculas, números e hífen"),
  brand_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  plan: z.enum(["starter", "professional", "enterprise"]).optional(),
  monthly_fee: z.coerce.number().min(0).optional(),
  split_fixed_fee: z.coerce.number().min(0).optional(),
  split_percentage: z.coerce.number().min(0).max(100).optional(),
  patient_subscription_suggestion: z.coerce.number().min(0).optional(),
  legal_name: optionalText(180),
  cnpj: optionalText(20),
  email: optionalText(160).pipe(z.string().email("E-mail inválido").optional()),
  phone: optionalText(40),
  zip_code: optionalText(12),
  street: optionalText(180),
  number: optionalText(40),
  complement: optionalText(120),
  neighborhood: optionalText(120),
  city: optionalText(120),
  state: optionalText(2),
});

const updateTenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(120),
  legal_name: optionalText(180),
  logo_url: z
    .preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().url("URL inválida").max(500).optional(),
    )
    .optional(),
  brand_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  email: z
    .preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().email("E-mail inválido").max(160).optional(),
    )
    .optional(),
  phone: z
    .preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().trim().max(40).optional(),
    )
    .optional(),
  cnpj: z
    .preprocess(
      (value) => (typeof value === "string" ? value.replace(/\D/g, "") : value),
      z.string().length(14, "CNPJ deve ter 14 dígitos").optional(),
    )
    .optional(),
  status: z.enum(["trial", "active", "paused", "canceled"]),
  monthly_fee: z.coerce.number().min(0).optional(),
  split_fixed_fee: z.coerce.number().min(0).optional(),
  split_percentage: z.coerce.number().min(0).max(100).optional(),
  patient_subscription_suggestion: z.coerce.number().min(0).optional(),
  asaas_account_id: optionalText(120),
  asaas_wallet_id: optionalText(120),
  asaas_api_key_ref: optionalText(120),
  asaas_onboarding_status: z
    .enum(["not_started", "pending_documents", "under_review", "active", "rejected", "disabled"])
    .default("not_started"),
  asaas_split_enabled: z.boolean().default(true),
  zip_code: optionalText(12),
  street: optionalText(180),
  number: optionalText(40),
  complement: optionalText(120),
  neighborhood: optionalText(120),
  city: optionalText(120),
  state: optionalText(2),
});

const createTenantAsaasSubaccountSchema = z.object({
  tenant_id: z.string().uuid(),
  name: z.string().min(2).max(120),
  email: z.string().email("E-mail inválido").max(160),
  cpfCnpj: z.preprocess(
    (value) => (typeof value === "string" ? value.replace(/\D/g, "") : value),
    z.string().min(11, "CPF/CNPJ obrigatório").max(14, "CPF/CNPJ inválido"),
  ),
  birthDate: optionalText(10),
  companyType: z.enum(["MEI", "LIMITED", "INDIVIDUAL", "ASSOCIATION"]).default("LIMITED"),
  phone: optionalText(40),
  mobilePhone: z.preprocess(
    (value) => (typeof value === "string" ? value.replace(/\D/g, "") : value),
    z.string().min(10, "Celular obrigatório").max(14, "Celular inválido"),
  ),
  incomeValue: z.coerce.number().min(0).default(5000),
  address: z.string().min(2, "Endereço obrigatório").max(180),
  addressNumber: z.string().min(1, "Número obrigatório").max(40),
  complement: optionalText(120),
  province: z.string().min(2, "Bairro obrigatório").max(120),
  postalCode: z.preprocess(
    (value) => (typeof value === "string" ? value.replace(/\D/g, "") : value),
    z.string().length(8, "CEP deve ter 8 dígitos"),
  ),
  api_key_ref: optionalText(120),
});

export const createTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createTenantSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, user, userId } = context;
    const isSuperAdmin = await checkSuperAdmin(supabase, userId);
    if (isSuperAdmin && !data.email) {
      throw new Error(
        "Informe o e-mail do responsável da clínica. O admin global não deve virar dono operacional da clínica.",
      );
    }
    if (isSuperAdmin && data.email?.toLowerCase() === user.email?.toLowerCase()) {
      throw new Error(
        "Use um e-mail da clínica diferente do e-mail do super admin para evitar mistura de acessos.",
      );
    }

    const ownerId = isSuperAdmin
      ? await getOrCreateClinicOwnerUser(data.email!, data.name)
      : userId;
    const tenantClient = isSuperAdmin ? supabaseAdmin : supabase;

    const { data: tenant, error } = await tenantClient
      .from("tenants")
      .insert({
        name: data.name,
        slug: data.slug,
        legal_name: data.legal_name,
        cnpj: data.cnpj?.replace(/\D/g, ""),
        email: data.email,
        phone: data.phone,
        zip_code: data.zip_code?.replace(/\D/g, ""),
        street: data.street,
        number: data.number,
        complement: data.complement,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state?.toUpperCase(),
        brand_color: data.brand_color ?? "#0ea5e9",
        plan: data.plan ?? "starter",
        monthly_fee: data.monthly_fee ?? DEFAULT_MONTHLY_FEE,
        split_fixed_fee: data.split_fixed_fee ?? DEFAULT_SPLIT_FIXED_FEE,
        split_percentage: data.split_percentage ?? DEFAULT_SPLIT_PERCENTAGE,
        patient_subscription_suggestion:
          data.patient_subscription_suggestion ?? DEFAULT_PATIENT_SUBSCRIPTION,
        commercial_model: "base_fixed_plus_split",
        owner_id: ownerId,
      })
      .select(
        "id, slug, name, brand_color, plan, status, monthly_fee, split_fixed_fee, split_percentage, commercial_model",
      )
      .single();
    if (error) throw new Error(error.message);

    const clinicInvite = data.email
      ? await createClinicAdminInvite({
          supabase: isSuperAdmin ? supabaseAdmin : supabase,
          tenant,
          email: data.email,
          invitedBy: userId,
        })
      : null;

    return { tenant, clinicInvite };
  });

export const createTenantAsaasSubaccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createTenantAsaasSubaccountSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: currentTenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id, slug, name")
      .eq("id", data.tenant_id)
      .maybeSingle();

    if (tenantError) throw new Error(tenantError.message);
    if (!currentTenant) throw new Error("Clínica não encontrada ou sem acesso.");

    const subaccount = await createAsaasSubaccount({
      name: data.name,
      email: data.email,
      loginEmail: data.email,
      cpfCnpj: data.cpfCnpj,
      birthDate: data.birthDate,
      companyType: data.companyType,
      phone: onlyDigits(data.phone),
      mobilePhone: data.mobilePhone,
      incomeValue: data.incomeValue,
      address: data.address,
      addressNumber: data.addressNumber,
      complement: data.complement,
      province: data.province,
      postalCode: data.postalCode,
    });

    if (!subaccount.id || !subaccount.walletId || !subaccount.apiKey) {
      throw new Error("Asaas criou a subconta, mas não retornou id, walletId ou apiKey.");
    }

    const apiKeyRef =
      data.api_key_ref || `ASAAS_TENANT_${toSecretSlug(currentTenant.slug)}_API_KEY`;
    const { data: tenant, error } = await supabase
      .from("tenants")
      .update({
        asaas_account_id: subaccount.id,
        asaas_wallet_id: subaccount.walletId,
        asaas_api_key_ref: apiKeyRef,
        asaas_onboarding_status: "active",
        asaas_split_enabled: true,
      })
      .eq("id", currentTenant.id)
      .select(
        "id, slug, name, legal_name, logo_url, brand_color, email, phone, cnpj, zip_code, street, number, complement, neighborhood, city, state, settings, plan, status, monthly_fee, split_fixed_fee, split_percentage, patient_subscription_suggestion, commercial_model, asaas_account_id, asaas_wallet_id, asaas_api_key_ref, asaas_onboarding_status, asaas_split_enabled, owner_id",
      )
      .single();

    if (error) throw new Error(error.message);

    return {
      tenant,
      subaccount: {
        id: subaccount.id,
        walletId: subaccount.walletId,
        apiKey: subaccount.apiKey,
        apiKeyRef,
        name: subaccount.name,
      },
    };
  });

function onlyDigits(value?: string | null) {
  return value?.replace(/\D/g, "") || undefined;
}

async function checkSuperAdmin(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .limit(1);
  if (error) throw new Error(error.message);
  return Boolean(data?.length);
}

async function getOrCreateClinicOwnerUser(email: string, clinicName: string) {
  const normalizedEmail = email.toLowerCase();
  const { data: existingProfile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);
  if (existingProfile?.id) return existingProfile.id;

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: normalizedEmail,
    password: createTemporaryPassword(),
    email_confirm: true,
    user_metadata: { full_name: clinicName },
  });

  if (error) throw new Error(error.message);
  if (!data.user?.id) throw new Error("Não foi possível criar o usuário dono da clínica.");
  return data.user.id;
}

function createTemporaryPassword() {
  return `${randomToken(18)}aA1!`;
}

function randomToken(length: number) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  return Array.from(values)
    .map((value) => alphabet[value % alphabet.length])
    .join("");
}

function toSecretSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

async function createClinicAdminInvite({
  supabase,
  tenant,
  email,
  invitedBy,
}: {
  supabase: SupabaseClient;
  tenant: { id: string; slug: string; name: string };
  email: string;
  invitedBy: string;
}) {
  const normalizedEmail = email.toLowerCase();
  const { data: invitation, error } = await supabase
    .from("staff_invitations")
    .insert({
      tenant_id: tenant.id,
      email: normalizedEmail,
      role: "tenant_admin",
      invited_by: invitedBy,
    })
    .select("id, token, email, status, expires_at")
    .single();

  if (error) {
    return {
      sent: false,
      reason: "invite_error",
      error: error.message,
    };
  }

  const inviteUrl = buildStaffInviteUrl(invitation.token);
  const template = clinicOnboardingEmail({
    tenantName: tenant.name,
    inviteUrl,
    expiresAt: invitation.expires_at,
  });
  const emailResult = await sendEmail({ to: normalizedEmail, ...template });

  return {
    invitation: {
      id: invitation.id,
      email: invitation.email,
      status: invitation.status,
      expires_at: invitation.expires_at,
    },
    inviteUrl,
    emailResult,
  };
}

function buildStaffInviteUrl(token: string) {
  const request = getRequest();
  const requestOrigin = request ? new URL(request.url).origin : undefined;
  const baseUrl = process.env.APP_BASE_URL || requestOrigin || "https://medyco.com.br";
  return `${baseUrl.replace(/\/$/, "")}/invite/${token}`;
}

export const getTenantBySlug = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ slug: z.string().min(1).max(60) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: tenant, error } = await supabase
      .from("tenants")
      .select(
        "id, slug, name, legal_name, logo_url, brand_color, email, phone, cnpj, zip_code, street, number, complement, neighborhood, city, state, settings, plan, status, monthly_fee, split_fixed_fee, split_percentage, patient_subscription_suggestion, commercial_model, asaas_account_id, asaas_wallet_id, asaas_api_key_ref, asaas_onboarding_status, asaas_split_enabled, owner_id",
      )
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!tenant) throw new Error("Clínica não encontrada ou sem acesso");
    return { tenant };
  });

export const updateTenantSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateTenantSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: tenant, error } = await supabase
      .from("tenants")
      .update({
        name: data.name,
        legal_name: data.legal_name,
        logo_url: data.logo_url,
        brand_color: data.brand_color,
        email: data.email,
        phone: data.phone,
        cnpj: data.cnpj,
        zip_code: data.zip_code,
        street: data.street,
        number: data.number,
        complement: data.complement,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state?.toUpperCase(),
        status: data.status,
        monthly_fee: data.monthly_fee ?? DEFAULT_MONTHLY_FEE,
        split_fixed_fee: data.split_fixed_fee ?? DEFAULT_SPLIT_FIXED_FEE,
        split_percentage: data.split_percentage ?? DEFAULT_SPLIT_PERCENTAGE,
        patient_subscription_suggestion:
          data.patient_subscription_suggestion ?? DEFAULT_PATIENT_SUBSCRIPTION,
        commercial_model: "base_fixed_plus_split",
        asaas_account_id: data.asaas_account_id,
        asaas_wallet_id: data.asaas_wallet_id,
        asaas_api_key_ref: data.asaas_api_key_ref,
        asaas_onboarding_status: data.asaas_onboarding_status,
        asaas_split_enabled: data.asaas_split_enabled,
      })
      .eq("id", data.id)
      .select(
        "id, slug, name, legal_name, logo_url, brand_color, email, phone, cnpj, zip_code, street, number, complement, neighborhood, city, state, settings, plan, status, monthly_fee, split_fixed_fee, split_percentage, patient_subscription_suggestion, commercial_model, asaas_account_id, asaas_wallet_id, asaas_api_key_ref, asaas_onboarding_status, asaas_split_enabled, owner_id",
      )
      .single();

    if (error) throw new Error(error.message);
    return { tenant };
  });
