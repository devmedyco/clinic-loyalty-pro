import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase-ext/auth-middleware";

const reportSchema = z.object({
  tenant: z.string().min(1).max(60),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const getTenantReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => reportSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tenant = await resolveTenant(supabase, data.tenant);
    const range = normalizeRange(data.from, data.to);

    const [patientsResult, paymentsResult, executionsResult, validationsResult] = await Promise.all(
      [
        supabase
          .from("patients")
          .select("id, full_name, cpf, email, phone, status, created_at")
          .eq("tenant_id", tenant.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("payments")
          .select(
            "id, amount, payment_method, status, paid_at, due_date, created_at, patients(full_name)",
          )
          .eq("tenant_id", tenant.id)
          .gte("created_at", range.fromIso)
          .lte("created_at", range.toIso)
          .order("created_at", { ascending: false }),
        supabase
          .from("service_executions")
          .select(
            "id, original_amount, discount_amount, final_amount, created_at, patients(full_name), services(name)",
          )
          .eq("tenant_id", tenant.id)
          .gte("created_at", range.fromIso)
          .lte("created_at", range.toIso)
          .order("created_at", { ascending: false }),
        supabase
          .from("card_validations")
          .select(
            "id, outcome, reason, validated_at, benefit_cards(card_number, patients(full_name))",
          )
          .eq("tenant_id", tenant.id)
          .gte("validated_at", range.fromIso)
          .lte("validated_at", range.toIso)
          .order("validated_at", { ascending: false }),
      ],
    );

    if (patientsResult.error) throw new Error(patientsResult.error.message);
    if (paymentsResult.error) throw new Error(paymentsResult.error.message);
    if (executionsResult.error) throw new Error(executionsResult.error.message);
    if (validationsResult.error) throw new Error(validationsResult.error.message);

    const patients = patientsResult.data ?? [];
    const payments = paymentsResult.data ?? [];
    const executions = executionsResult.data ?? [];
    const validations = validationsResult.data ?? [];

    return {
      tenant,
      range,
      totals: {
        patients: patients.length,
        activePatients: patients.filter((patient) => patient.status === "active").length,
        paidRevenue: sumPaid(payments),
        pendingPayments: payments.filter((payment) => payment.status === "pending").length,
        executions: executions.length,
        finalRevenue: sumNumeric(executions, "final_amount"),
        savings: sumNumeric(executions, "discount_amount"),
        validations: validations.length,
        approvedValidations: validations.filter((validation) => validation.outcome === "approved")
          .length,
        deniedValidations: validations.filter((validation) => validation.outcome === "denied")
          .length,
      },
      patients,
      payments,
      executions,
      validations,
      daily: buildDailySeries(range.fromDate, range.toDate, executions, validations),
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

function normalizeRange(from?: string, to?: string) {
  const toDate = to ? new Date(`${to}T23:59:59.999`) : new Date();
  const fromDate = from ? new Date(`${from}T00:00:00.000`) : daysAgo(30);
  return {
    from: fromDate.toISOString().slice(0, 10),
    to: toDate.toISOString().slice(0, 10),
    fromIso: fromDate.toISOString(),
    toIso: toDate.toISOString(),
    fromDate,
    toDate,
  };
}

function buildDailySeries(
  fromDate: Date,
  toDate: Date,
  executions: Array<{ created_at: string; final_amount: number | string }>,
  validations: Array<{ validated_at: string; outcome: string }>,
) {
  const days = new Map<
    string,
    { date: string; receita: number; atendimentos: number; validacoes: number; negadas: number }
  >();
  const cursor = new Date(fromDate);
  while (cursor <= toDate) {
    const key = cursor.toISOString().slice(0, 10);
    days.set(key, { date: key.slice(5), receita: 0, atendimentos: 0, validacoes: 0, negadas: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  for (const execution of executions) {
    const key = execution.created_at.slice(0, 10);
    const row = days.get(key);
    if (!row) continue;
    row.receita += Number(execution.final_amount || 0);
    row.atendimentos += 1;
  }
  for (const validation of validations) {
    const key = validation.validated_at.slice(0, 10);
    const row = days.get(key);
    if (!row) continue;
    row.validacoes += 1;
    if (validation.outcome === "denied") row.negadas += 1;
  }
  return Array.from(days.values());
}

function sumPaid(rows: Array<{ amount: number | string; status: string }>) {
  return rows
    .filter((row) => row.status === "paid")
    .reduce((total, row) => total + Number(row.amount || 0), 0);
}

function sumNumeric<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
}
