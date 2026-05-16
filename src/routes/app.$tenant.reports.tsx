import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, FileText, Printer } from "lucide-react";
import { useState } from "react";
import { Card, PageHeader, StatCard } from "@/components/portal/Shell";
import { getTenantReports } from "@/lib/reports.functions";

export const Route = createFileRoute("/app/$tenant/reports")({
  component: TenantReportsPage,
});

function TenantReportsPage() {
  const { tenant } = Route.useParams();
  const fetchReports = useServerFn(getTenantReports);
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(today());
  const { data, isLoading, error } = useQuery({
    queryKey: ["tenant-reports", tenant, from, to],
    queryFn: () => fetchReports({ data: { tenant, from, to } }),
  });

  return (
    <>
      <PageHeader
        title="Relatórios"
        subtitle="Pacientes, cobranças, atendimentos e validações em um só painel."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() =>
                data && downloadCsv("relatorio-pacientes.csv", patientRows(data.patients))
              }
              className="inline-flex items-center gap-2 rounded-lg border border-input px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
            >
              <Download className="h-4 w-4" />
              CSV pacientes
            </button>
            <button
              onClick={() => data && downloadCsv("relatorio-financeiro.csv", financeRows(data))}
              className="inline-flex items-center gap-2 rounded-lg border border-input px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
            >
              <FileText className="h-4 w-4" />
              CSV financeiro
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              <Printer className="h-4 w-4" />
              PDF
            </button>
          </div>
        }
      />

      <Card className="mb-5 p-4 print:hidden">
        <div className="flex flex-wrap gap-3">
          <DateField label="De" value={from} onChange={setFrom} />
          <DateField label="Até" value={to} onChange={setTo} />
        </div>
      </Card>

      {error && (
        <Card className="mb-5 p-6 text-sm text-destructive">{(error as Error).message}</Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Receita final"
          value={isLoading ? "..." : formatCurrency(data?.totals.finalRevenue)}
          delta="atendimentos"
          tone="success"
        />
        <StatCard
          label="Economia gerada"
          value={isLoading ? "..." : formatCurrency(data?.totals.savings)}
          delta={`${formatNumber(data?.totals.executions)} atendimento(s)`}
        />
        <StatCard
          label="Pagamentos pagos"
          value={isLoading ? "..." : formatCurrency(data?.totals.paidRevenue)}
          delta={`${formatNumber(data?.totals.pendingPayments)} pendente(s)`}
        />
        <StatCard
          label="Validações"
          value={isLoading ? "..." : formatNumber(data?.totals.validations)}
          delta={`${formatNumber(data?.totals.deniedValidations)} negadas`}
        />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-display text-xl text-foreground">Receita e atendimentos</h2>
          <div className="mt-5 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.daily ?? []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip
                  formatter={(value, name) =>
                    name === "receita" ? formatCurrency(Number(value)) : value
                  }
                />
                <Bar dataKey="receita" fill="var(--color-brand)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="font-display text-xl text-foreground">Validações por dia</h2>
          <div className="mt-5 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.daily ?? []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="validacoes"
                  stroke="var(--color-brand)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="negadas"
                  stroke="var(--color-destructive)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <ReportTable
          title="Atendimentos recentes"
          empty="Nenhum atendimento no período."
          headers={["Paciente", "Serviço", "Final", "Data"]}
          rows={(data?.executions ?? [])
            .slice(0, 12)
            .map((execution) => [
              relationName(execution.patients, "full_name") ?? "Paciente",
              relationName(execution.services, "name") ?? "Serviço",
              formatCurrency(execution.final_amount),
              formatDateTime(execution.created_at),
            ])}
        />
        <ReportTable
          title="Pagamentos recentes"
          empty="Nenhum pagamento no período."
          headers={["Paciente", "Valor", "Status", "Data"]}
          rows={(data?.payments ?? [])
            .slice(0, 12)
            .map((payment) => [
              relationName(payment.patients, "full_name") ?? "Paciente",
              formatCurrency(payment.amount),
              payment.status,
              formatDateTime(payment.paid_at ?? payment.created_at),
            ])}
        />
      </div>
    </>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 block rounded-lg border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground"
      />
    </label>
  );
}

function ReportTable({
  title,
  headers,
  rows,
  empty,
}: {
  title: string;
  headers: string[];
  rows: string[][];
  empty: string;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h2 className="font-display text-xl text-foreground">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <div className="px-5 py-10 text-sm text-muted-foreground">{empty}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                {headers.map((header) => (
                  <th key={header} className="px-5 py-3">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-t border-border">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-5 py-4 text-foreground">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function patientRows(patients: Array<Record<string, unknown>>) {
  return [
    ["nome", "cpf", "email", "telefone", "status", "criado_em"],
    ...patients.map((patient) => [
      String(patient.full_name ?? ""),
      String(patient.cpf ?? ""),
      String(patient.email ?? ""),
      String(patient.phone ?? ""),
      String(patient.status ?? ""),
      String(patient.created_at ?? ""),
    ]),
  ];
}

function financeRows(data: {
  payments: Array<Record<string, unknown>>;
  executions: Array<Record<string, unknown>>;
}) {
  return [
    ["tipo", "descricao", "valor", "status", "data"],
    ...data.payments.map((payment) => [
      "pagamento",
      relationName(payment.patients, "full_name") ?? "Paciente",
      String(payment.amount ?? 0),
      String(payment.status ?? ""),
      String(payment.created_at ?? ""),
    ]),
    ...data.executions.map((execution) => [
      "atendimento",
      relationName(execution.services, "name") ?? "Serviço",
      String(execution.final_amount ?? 0),
      "executado",
      String(execution.created_at ?? ""),
    ]),
  ];
}

function relationName(value: unknown, key: string) {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return null;
  return String((row as Record<string, unknown>)[key] ?? "");
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function defaultFrom() {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatNumber(value?: number) {
  return new Intl.NumberFormat("pt-BR").format(value ?? 0);
}

function formatCurrency(value?: number | string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value ?? 0),
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(value),
  );
}
