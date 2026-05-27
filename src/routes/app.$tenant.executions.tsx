import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, PageHeader } from "@/components/portal/Shell";
import { createServiceExecution, listServiceExecutions } from "@/lib/service-executions.functions";

export const Route = createFileRoute("/app/$tenant/executions")({
  component: ExecutionsPage,
});

type PatientOption = {
  id: string;
  full_name: string;
  cpf: string | null;
  status: string;
};

type ServiceOption = {
  id: string;
  name: string;
  original_price: number | string;
  discount_percentage: number | string;
  final_price: number | string;
  active: boolean;
};

type Execution = {
  id: string;
  original_amount: number | string;
  discount_amount: number | string;
  final_amount: number | string;
  notes: string | null;
  created_at: string;
  patients?: { full_name: string; cpf: string | null } | null;
  services?: { name: string } | null;
};

type ExecutionFormState = {
  patient_id: string;
  service_id: string;
  notes: string;
};

function ExecutionsPage() {
  const { tenant } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchExecutions = useServerFn(listServiceExecutions);
  const createExecution = useServerFn(createServiceExecution);
  const [formOpen, setFormOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["service-executions", tenant],
    queryFn: () => fetchExecutions({ data: { tenant } }),
  });

  const mutation = useMutation({
    mutationFn: (value: ExecutionFormState) => createExecution({ data: { tenant, ...value } }),
    onSuccess: async () => {
      toast.success("Atendimento registrado");
      setFormOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["service-executions", tenant] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const executions = (data?.executions ?? []) as Execution[];
  const patients = (data?.patients ?? []) as PatientOption[];
  const services = (data?.services ?? []) as ServiceOption[];

  return (
    <>
      <PageHeader
        title="Atendimentos"
        subtitle="Registre a execução de serviços autorizados pelo programa."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => downloadExecutionsCsv(executions)}
              className="inline-flex items-center gap-2 rounded-lg border border-input px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
            >
              <Download className="h-4 w-4" />
              Exportar
            </button>
            <button
              onClick={() => setFormOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Novo atendimento
            </button>
          </div>
        }
      />

      {formOpen && (
        <ExecutionModal
          patients={patients}
          services={services}
          loading={mutation.isPending}
          onClose={() => setFormOpen(false)}
          onSubmit={(value) => mutation.mutate(value)}
        />
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Atendimentos registrados" value={String(executions.length)} />
        <MetricCard label="Receita final" value={formatCurrency(sum(executions, "final_amount"))} />
        <MetricCard
          label="Economia gerada"
          value={formatCurrency(sum(executions, "discount_amount"))}
        />
      </div>

      <Card className="mt-6 overflow-hidden">
        {isLoading ? (
          <div className="px-5 py-10 text-sm text-muted-foreground">Carregando atendimentos...</div>
        ) : error ? (
          <div className="px-5 py-10 text-sm text-destructive">{(error as Error).message}</div>
        ) : executions.length === 0 ? (
          <div className="px-5 py-14 text-center text-sm text-muted-foreground">
            Nenhum atendimento registrado ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Paciente</th>
                  <th className="px-5 py-3">Serviço</th>
                  <th className="px-5 py-3">Original</th>
                  <th className="px-5 py-3">Desconto</th>
                  <th className="px-5 py-3">Final</th>
                  <th className="px-5 py-3">Data</th>
                </tr>
              </thead>
              <tbody>
                {executions.map((execution) => (
                  <tr key={execution.id} className="border-t border-border">
                    <td className="px-5 py-4">
                      <div className="font-medium text-foreground">
                        {execution.patients?.full_name ?? "Paciente"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatCpf(execution.patients?.cpf)}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-foreground">
                      {execution.services?.name ?? "Serviço"}
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {formatCurrency(execution.original_amount)}
                    </td>
                    <td className="px-5 py-4 text-success">
                      {formatCurrency(execution.discount_amount)}
                    </td>
                    <td className="px-5 py-4 font-medium text-foreground">
                      {formatCurrency(execution.final_amount)}
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {formatDateTime(execution.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function ExecutionModal({
  patients,
  services,
  loading,
  onClose,
  onSubmit,
}: {
  patients: PatientOption[];
  services: ServiceOption[];
  loading: boolean;
  onClose: () => void;
  onSubmit: (value: ExecutionFormState) => void;
}) {
  const [value, setValue] = useState<ExecutionFormState>({
    patient_id: "",
    service_id: "",
    notes: "",
  });
  const selectedService = useMemo(
    () => services.find((service) => service.id === value.service_id),
    [services, value.service_id],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-xl rounded-xl border border-border bg-surface-elevated p-6 shadow-elegant"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="font-display text-xl text-foreground">Novo atendimento</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Selecione o paciente e o serviço executado pela clínica.
        </p>

        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(value);
          }}
        >
          <label className="block">
            <span className="text-xs font-medium text-foreground">Paciente</span>
            <select
              value={value.patient_id}
              onChange={(event) =>
                setValue((current) => ({ ...current, patient_id: event.target.value }))
              }
              required
              className="mt-1.5 block w-full rounded-lg border border-input bg-surface-elevated px-3 py-2.5 text-sm text-foreground"
            >
              <option value="">Selecione um paciente</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.full_name} · {formatCpf(patient.cpf)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-foreground">Serviço</span>
            <select
              value={value.service_id}
              onChange={(event) =>
                setValue((current) => ({ ...current, service_id: event.target.value }))
              }
              required
              className="mt-1.5 block w-full rounded-lg border border-input bg-surface-elevated px-3 py-2.5 text-sm text-foreground"
            >
              <option value="">Selecione um serviço</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} · {formatCurrency(service.final_price)}
                </option>
              ))}
            </select>
          </label>

          {selectedService && (
            <div className="grid gap-3 rounded-xl border border-border bg-surface p-4 text-sm sm:grid-cols-3">
              <div>
                <div className="text-xs text-muted-foreground">Original</div>
                <div className="font-medium text-foreground">
                  {formatCurrency(selectedService.original_price)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Desconto</div>
                <div className="font-medium text-success">
                  {formatPercent(selectedService.discount_percentage)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Final</div>
                <div className="font-medium text-foreground">
                  {formatCurrency(selectedService.final_price)}
                </div>
              </div>
            </div>
          )}

          <label className="block">
            <span className="text-xs font-medium text-foreground">Observações</span>
            <textarea
              value={value.notes}
              onChange={(event) =>
                setValue((current) => ({ ...current, notes: event.target.value }))
              }
              rows={3}
              placeholder="Opcional"
              className="mt-1.5 block w-full resize-none rounded-lg border border-input bg-surface-elevated px-3 py-2.5 text-sm text-foreground shadow-soft outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </label>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface"
            >
              Cancelar
            </button>
            <button
              disabled={loading || patients.length === 0 || services.length === 0}
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Registrando..." : "Registrar atendimento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-3xl text-foreground">{value}</div>
    </div>
  );
}

function sum(executions: Execution[], key: "discount_amount" | "final_amount") {
  return executions.reduce((total, execution) => total + Number(execution[key] || 0), 0);
}

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function formatPercent(value: number | string) {
  return `${Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

function formatCpf(cpf?: string | null) {
  if (!cpf) return "Sem CPF";
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function downloadExecutionsCsv(executions: Execution[]) {
  const rows = [
    ["paciente", "cpf", "servico", "valor_original", "desconto", "valor_final", "data"],
    ...executions.map((execution) => [
      execution.patients?.full_name ?? "",
      execution.patients?.cpf ?? "",
      execution.services?.name ?? "",
      String(execution.original_amount),
      String(execution.discount_amount),
      String(execution.final_amount),
      execution.created_at,
    ]),
  ];
  downloadCsv("atendimentos-medyco.csv", rows);
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
