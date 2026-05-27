import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase-ext/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase-ext/client.server";
import { staffInviteEmail } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email.server";
import { assertTenantAdmin } from "@/lib/tenant-auth.server";

const tenantSlugSchema = z.object({
  tenant: z.string().min(1).max(60),
});

const inviteSchema = tenantSlugSchema.extend({
  email: z.string().trim().email().max(200),
  role: z.enum(["tenant_admin", "tenant_staff"]),
});

const revokeSchema = tenantSlugSchema.extend({
  id: z.string().uuid(),
});

const acceptSchema = z.object({
  token: z.string().min(16).max(200),
});

const completeStaffInvitationSchema = acceptSchema.extend({
  password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres").max(120),
});

export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => tenantSlugSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tenant = await resolveTenant(supabase, data.tenant);

    const [{ data: members, error: membersError }, { data: invitations, error: invitesError }] =
      await Promise.all([
        supabase
          .from("user_roles")
          .select("id, user_id, role, tenant_id, created_at")
          .eq("tenant_id", tenant.id)
          .in("role", ["tenant_admin", "tenant_staff"])
          .order("created_at", { ascending: false }),
        supabase
          .from("staff_invitations")
          .select("id, tenant_id, email, role, status, expires_at, created_at")
          .eq("tenant_id", tenant.id)
          .order("created_at", { ascending: false }),
      ]);

    if (membersError) throw new Error(membersError.message);
    if (invitesError) throw new Error(invitesError.message);

    const userIds = Array.from(new Set((members ?? []).map((member) => member.user_id)));
    const { data: profiles, error: profilesError } = userIds.length
      ? await supabase.from("profiles").select("id, email, full_name, avatar_url").in("id", userIds)
      : { data: [], error: null };

    if (profilesError) throw new Error(profilesError.message);

    const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    return {
      tenant,
      members: (members ?? []).map((member) => ({
        ...member,
        profile: profilesById.get(member.user_id) ?? null,
      })),
      invitations: invitations ?? [],
    };
  });

export const createStaffInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inviteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenant = await resolveTenant(supabase, data.tenant);
    await assertTenantAdmin(supabase, userId, tenant.id);
    const email = data.email.toLowerCase();

    await expireOldInvitation(supabase, tenant.id, email);

    const { data: invitation, error } = await supabase
      .from("staff_invitations")
      .insert({
        tenant_id: tenant.id,
        email,
        role: data.role,
        invited_by: userId,
      })
      .select("id, tenant_id, email, role, token, status, expires_at, created_at")
      .single();

    if (error) throw new Error(error.message);

    const inviteUrl = buildInviteUrl(invitation.token);
    const template = staffInviteEmail({
      tenantName: tenant.name,
      roleLabel: roleLabel(data.role),
      inviteUrl,
      expiresAt: invitation.expires_at,
    });
    const emailResult = await sendEmail({ to: email, ...template });

    return {
      tenant,
      invitation: {
        id: invitation.id,
        tenant_id: invitation.tenant_id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expires_at: invitation.expires_at,
        created_at: invitation.created_at,
      },
      inviteUrl,
      emailResult,
    };
  });

export const revokeStaffInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => revokeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenant = await resolveTenant(supabase, data.tenant);
    await assertTenantAdmin(supabase, userId, tenant.id);

    const { data: invitation, error } = await supabase
      .from("staff_invitations")
      .update({ status: "revoked" })
      .eq("tenant_id", tenant.id)
      .eq("id", data.id)
      .eq("status", "pending")
      .select("id, tenant_id, email, role, status, expires_at, created_at")
      .single();

    if (error) throw new Error(error.message);
    return { tenant, invitation };
  });

export const acceptStaffInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => acceptSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, user, userId } = context as {
      supabase: SupabaseClient;
      user: User;
      userId: string;
    };

    const { data: invitation, error } = await supabase
      .from("staff_invitations")
      .select("id, tenant_id, email, role, status, expires_at, tenants(id, slug, name)")
      .eq("token", data.token)
      .eq("status", "pending")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!invitation) throw new Error("Convite não encontrado ou já utilizado.");
    if (new Date(invitation.expires_at).getTime() < Date.now()) {
      throw new Error("Este convite expirou.");
    }
    if ((user.email ?? "").toLowerCase() !== invitation.email.toLowerCase()) {
      throw new Error("Entre com o mesmo e-mail que recebeu o convite.");
    }

    const { error: roleError } = await supabase.from("user_roles").insert({
      user_id: userId,
      tenant_id: invitation.tenant_id,
      role: invitation.role,
    });
    if (roleError && !roleError.message.includes("duplicate key")) {
      throw new Error(roleError.message);
    }

    const { error: updateError } = await supabase
      .from("staff_invitations")
      .update({
        status: "accepted",
        accepted_by: userId,
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);
    if (updateError) throw new Error(updateError.message);

    const tenantRelation = Array.isArray(invitation.tenants)
      ? invitation.tenants[0]
      : invitation.tenants;
    return {
      accepted: true,
      tenant: tenantRelation,
    };
  });

export const completeStaffInvitation = createServerFn({ method: "POST" })
  .inputValidator((input) => completeStaffInvitationSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: invitation, error } = await supabaseAdmin
      .from("staff_invitations")
      .select("id, tenant_id, email, role, status, expires_at, tenants(id, slug, name)")
      .eq("token", data.token)
      .eq("status", "pending")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!invitation) throw new Error("Convite não encontrado ou já utilizado.");
    if (new Date(invitation.expires_at).getTime() < Date.now()) {
      throw new Error("Este convite expirou.");
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", invitation.email.toLowerCase())
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);

    let userId = profile?.id;
    if (userId) {
      const { error: updateUserError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: data.password,
        email_confirm: true,
      });
      if (updateUserError) throw new Error(updateUserError.message);
    } else {
      const { data: createdUser, error: createUserError } =
        await supabaseAdmin.auth.admin.createUser({
          email: invitation.email.toLowerCase(),
          password: data.password,
          email_confirm: true,
        });
      if (createUserError) throw new Error(createUserError.message);
      userId = createdUser.user?.id;
    }

    if (!userId) throw new Error("Não foi possível criar o acesso da clínica.");

    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      tenant_id: invitation.tenant_id,
      role: invitation.role,
    });
    if (roleError && !roleError.message.includes("duplicate key")) {
      throw new Error(roleError.message);
    }

    const { error: updateError } = await supabaseAdmin
      .from("staff_invitations")
      .update({
        status: "accepted",
        accepted_by: userId,
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);
    if (updateError) throw new Error(updateError.message);

    return {
      accepted: true,
      email: invitation.email,
      tenant: Array.isArray(invitation.tenants) ? invitation.tenants[0] : invitation.tenants,
    };
  });

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

async function expireOldInvitation(supabase: SupabaseClient, tenantId: string, email: string) {
  const { error } = await supabase
    .from("staff_invitations")
    .update({ status: "expired" })
    .eq("tenant_id", tenantId)
    .eq("email", email)
    .eq("status", "pending");
  if (error) throw new Error(error.message);
}

function buildInviteUrl(token: string) {
  const request = getRequest();
  const requestOrigin = request ? new URL(request.url).origin : undefined;
  const baseUrl = process.env.APP_BASE_URL || requestOrigin || "https://medyco.com.br";
  return `${baseUrl.replace(/\/$/, "")}/invite/${token}`;
}

function roleLabel(role: "tenant_admin" | "tenant_staff") {
  return role === "tenant_admin" ? "Administrador da clínica" : "Funcionário";
}
