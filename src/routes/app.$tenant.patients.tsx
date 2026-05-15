import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, PageHeader } from "@/components/portal/Shell";
import {
  createPatient,
  deletePatient,
  listPatients,
  updatePatient,
} from "@/lib/patients.functions";

export const Route = createFileRoute("/app/$tenant/patients")({
  component: PatientsPage,
});

type Patient = {
  id: string;
  full_name: string;
  cpf: string | null;
  email: string | null;
  phone: string | null;
  status: "active" | "inactive" | "delinquent" | string;
  benefit_cards?: Array<{
    id: string;
    card_number: string;
    active: boolean;
    expires_at: string | null;
  }>;
};

type PatientFormState = {
  id?: string;
  full_name: string;
  cpf: string;
  email: string;
  phone: string;
  status: "active" | "inactive" | "delinquent";
};

const emptyPatient: PatientFormState = {
  full_name: "",
  cpf: "",
  email: "",
  phone: "",
  status: "active",
};

function PatientsPage() {
  const { tenant } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchPatients = useServerFn(listPatients);
  const create = useServerFn(createPatient);
  const update = useServerFn(updatePatient);
  const remove = useServerFn(deletePatient);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<PatientFormState | null>(null);

  const queryKey = useMemo(() => ["patients", tenant, search], [tenant, search]);
  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => fetchPatients({ data: { tenant, search } }),
  });

  const saveMutation = useMutation({
    mutationFn: async (value: PatientFormState) => {
      if (value.id) {
        return update({ data: { tenant, ...value, id: value.id } });
      }
      return create({ data: { tenant, ...value } });
    },
    onSuccess: async () => {
      toast.success(form?.id ? "Paciente atualizado" : "Paciente criado com cartão digital");
      setForm(null);
      await queryClient.invalidateQueries({ queryKey: ["patients", tenant] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { tenant, id } }),
    onSuccess: async () => {
      toast.success("Paciente removido");
      await queryClient.invalidateQueries({ queryKey: ["patients", tenant] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const patients = (data?.patients ?? []) as Patient[];

  return (
    <>
      <PageHeader
        title="Pacientes"
        subtitle="Gerencie titulares e dependentes do programa."
        action={
          <button
            onClick={() => setForm(emptyPatient)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Novo paciente
          </button>
        }
      />
      {form && (
        <PatientModal
          initialValue={form}
          loading={saveMutation.isPending}
          onClose={() => setForm(null)}
          onSubmit={(value) => saveMutation.mutate(value)}
        />
      )}
      <Card className="overflow-hidden">
        <div className="border-b border-border p-4">
          <input
            placeholder="Buscar por nome ou CPF..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full max-w-sm rounded-lg border border-input bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
        {isLoading ? (
          <div className="px-5 py-10 text-sm text-muted-foreground">Carregando pacientes...</div>
        ) : error ? (
          <div className="px-5 py-10 text-sm text-destructive">{(error as Error).message}</div>
        ) : patients.length === 0 ? (
          <div className="px-5 py-14 text-center text-sm text-muted-foreground">
            Nenhum paciente encontrado. Cadastre o primeiro titular para gerar um cartão digital.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Nome</th>
                  <th className="px-5 py-3">CPF</th>
                  <th className="px-5 py-3">Contato</th>
                  <th className="px-5 py-3">Cartão</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((patient) => {
                  const card = patient.benefit_cards?.[0];
                  return (
                    <tr key={patient.id} className="border-t border-border">
                      <td className="px-5 py-4 font-medium text-foreground">{patient.full_name}</td>
                      <td className="px-5 py-4 text-muted-foreground">{formatCpf(patient.cpf)}</td>
                      <td className="px-5 py-4 text-muted-foreground">
                        <div>{patient.email || "Sem e-mail"}</div>
                        <div className="text-xs">{patient.phone || "Sem telefone"}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-medium text-foreground">
                          {card?.card_number ?? "Sem cartão"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {card?.active ? "Ativo" : "Inativo"}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={patient.status} />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setForm(toFormState(patient))}
                            className="rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
                          >
                            Editar
                          </button>
                          <button
                            disabled={deleteMutation.isPending}
                            onClick={() => {
                              if (window.confirm(`Remover ${patient.full_name}?`))
                                deleteMutation.mutate(patient.id);
                            }}
                            className="rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive transition hover:bg-destructive/10 disabled:opacity-60"
                          >
                            Remover
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function PatientModal({
  initialValue,
  loading,
  onClose,
  onSubmit,
}: {
  initialValue: PatientFormState;
  loading: boolean;
  onClose: () => void;
  onSubmit: (value: PatientFormState) => void;
}) {
  const [value, setValue] = useState(initialValue);

  function setField<K extends keyof PatientFormState>(key: K, fieldValue: PatientFormState[K]) {
    setValue((current) => ({ ...current, [key]: fieldValue }));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-border bg-surface-elevated p-6 shadow-elegant"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="font-display text-xl text-foreground">
          {value.id ? "Editar paciente" : "Novo paciente"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          O cadastro gera automaticamente um cartão digital de benefícios.
        </p>
        <form
          className="mt-5 grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(value);
          }}
        >
          <Field
            className="sm:col-span-2"
            label="Nome completo"
            value={value.full_name}
            onChange={(event) => setField("full_name", event.target.value)}
            required
          />
          <Field
            label="CPF"
            value={value.cpf}
            onChange={(event) => setField("cpf", event.target.value)}
            placeholder="000.000.000-00"
          />
          <label className="block">
            <span className="text-xs font-medium text-foreground">Status</span>
            <select
              value={value.status}
              onChange={(event) =>
                setField("status", event.target.value as PatientFormState["status"])
              }
              className="mt-1.5 block w-full rounded-lg border border-input bg-surface-elevated px-3 py-2.5 text-sm text-foreground"
            >
              <option value="active">Ativo</option>
              <option value="delinquent">Inadimplente</option>
              <option value="inactive">Inativo</option>
            </select>
          </label>
          <Field
            label="E-mail"
            type="email"
            value={value.email}
            onChange={(event) => setField("email", event.target.value)}
            placeholder="paciente@email.com"
          />
          <Field
            label="Telefone"
            value={value.phone}
            onChange={(event) => setField("phone", event.target.value)}
            placeholder="(11) 99999-0000"
          />
          <div className="flex gap-2 pt-2 sm:col-span-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface"
            >
              Cancelar
            </button>
            <button
              disabled={loading}
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Salvando..." : "Salvar paciente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  className = "",
  ...props
}: { label: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-medium text-foreground">{label}</span>
      <input
        {...props}
        className="mt-1.5 block w-full rounded-lg border border-input bg-surface-elevated px-3 py-2.5 text-sm text-foreground shadow-soft outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
    </label>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    {
      active: "bg-success/15 text-success",
      delinquent: "bg-destructive/15 text-destructive",
      inactive: "bg-muted text-muted-foreground",
    }[status] ?? "bg-muted text-muted-foreground";

  const label =
    {
      active: "Ativo",
      delinquent: "Inadimplente",
      inactive: "Inativo",
    }[status] ?? status;

  return <span className={`rounded-md px-2 py-0.5 text-xs ${styles}`}>{label}</span>;
}

function toFormState(patient: Patient): PatientFormState {
  return {
    id: patient.id,
    full_name: patient.full_name,
    cpf: patient.cpf ?? "",
    email: patient.email ?? "",
    phone: patient.phone ?? "",
    status:
      patient.status === "inactive" || patient.status === "delinquent" ? patient.status : "active",
  };
}

function formatCpf(cpf?: string | null) {
  if (!cpf) return "Sem CPF";
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}
