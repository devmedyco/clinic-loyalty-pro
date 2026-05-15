import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase-ext/auth-middleware";

type CountQuery = ReturnType<ReturnType<SupabaseClient["from"]>["select"]>;

const tenantSlugSchema = z.object({
  tenant: z.string().min(1).max(60),
});

export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const since30 = daysAgo(30);

    const [tenants, activeTenants, patients, validations, executions, recentTenants] =
      await Promise.all([
        countRows(supabase, "tenants"),
        countRows(supabase, "tenants", (query) => query.in("status", ["trial", "active"])),
        countRows(supabase, "patients"),
        countRows(supabase, "card_validations", (query) => query.gte("validated_at", since30)),
        supabase.from("service_executions").select("final_amount").gte("created_at", since30),
        supabase
          .from("tenants")
          .select("id, name, slug, status, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

    if (executions.error) throw new Error(executions.error.message);
    if (recentTenants.error) throw new Error(recentTenants.error.message);

    return {
      totals: {
        tenants: tenants.count,
        activeTenants: activeTenants.count,
        patients: patients.count,
        validations30d: validations.count,
        revenue30d: sumAmounts(executions.data ?? [], "final_amount"),
      },
      recentTenants: recentTenants.data ?? [],
    };
  });

export const getClinicDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => tenantSlugSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tenant = await resolveTenant(supabase, data.tenant);
    const today = startOfDay();
    const since30 = daysAgo(30);

    const [
      patients,
      activePatients,
      delinquentPatients,
      validationsToday,
      validations30,
      executions30,
    ] = await Promise.all([
      countRows(supabase, "patients", (query) => query.eq("tenant_id", tenant.id)),
      countRows(supabase, "patients", (query) =>
        query.eq("tenant_id", tenant.id).eq("status", "active"),
      ),
      countRows(supabase, "patients", (query) =>
        query.eq("tenant_id", tenant.id).eq("status", "delinquent"),
      ),
      countRows(supabase, "card_validations", (query) =>
        query.eq("tenant_id", tenant.id).gte("validated_at", today),
      ),
      countRows(supabase, "card_validations", (query) =>
        query.eq("tenant_id", tenant.id).gte("validated_at", since30),
      ),
      supabase
        .from("service_executions")
        .select("final_amount, discount_amount, created_at")
        .eq("tenant_id", tenant.id)
        .gte("created_at", since30),
    ]);

    if (executions30.error) throw new Error(executions30.error.message);

    return {
      tenant,
      totals: {
        patients: patients.count,
        activePatients: activePatients.count,
        delinquentPatients: delinquentPatients.count,
        validationsToday: validationsToday.count,
        validations30d: validations30.count,
        revenue30d: sumAmounts(executions30.data ?? [], "final_amount"),
        savings30d: sumAmounts(executions30.data ?? [], "discount_amount"),
        executions30d: executions30.data?.length ?? 0,
      },
    };
  });

async function countRows(
  supabase: SupabaseClient,
  table: string,
  refine?: (query: CountQuery) => CountQuery,
) {
  let query: CountQuery = supabase.from(table).select("*", { count: "exact", head: true });
  if (refine) query = refine(query);
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return { count: count ?? 0 };
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

function sumAmounts<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function startOfDay() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}
