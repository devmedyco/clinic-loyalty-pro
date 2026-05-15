import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase-ext/auth-middleware";

const tenantSlugSchema = z.object({
  tenant: z.string().min(1).max(60),
});

export const getTenantFinance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => tenantSlugSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tenant = await resolveTenant(supabase, data.tenant);
    const since30 = daysAgo(30);

    const [executions30, executionsAll, services, patients] = await Promise.all([
      supabase
        .from("service_executions")
        .select(
          "final_amount, discount_amount, original_amount, created_at, patients(full_name), services(name)",
        )
        .eq("tenant_id", tenant.id)
        .gte("created_at", since30)
        .order("created_at", { ascending: false }),
      supabase
        .from("service_executions")
        .select("final_amount, discount_amount, original_amount")
        .eq("tenant_id", tenant.id),
      supabase
        .from("services")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id),
      supabase
        .from("patients")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id),
    ]);

    if (executions30.error) throw new Error(executions30.error.message);
    if (executionsAll.error) throw new Error(executionsAll.error.message);
    if (services.error) throw new Error(services.error.message);
    if (patients.error) throw new Error(patients.error.message);

    return {
      tenant,
      totals: {
        revenue30d: sumAmounts(executions30.data ?? [], "final_amount"),
        savings30d: sumAmounts(executions30.data ?? [], "discount_amount"),
        original30d: sumAmounts(executions30.data ?? [], "original_amount"),
        revenueAll: sumAmounts(executionsAll.data ?? [], "final_amount"),
        executions30d: executions30.data?.length ?? 0,
        services: services.count ?? 0,
        patients: patients.count ?? 0,
      },
      recentExecutions: executions30.data?.slice(0, 10) ?? [],
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

function sumAmounts<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}
