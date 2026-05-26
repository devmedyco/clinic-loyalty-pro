import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Eye, Send, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, PageHeader } from "@/components/portal/Shell";
import { lookupCep } from "@/lib/brasil-data";
import {
  createPatient,
  deletePatient,
  importPatients,
  invitePatientToPortal,
  listPatients,
  updatePatient,
} from "@/lib/patients.functions";

export const Route = createFileRoute("/app/$tenant/patients")({
  component: PatientsPage,
});

type Patient = {
  id: string;
  user_id: string | null;
  full_name: string;
  cpf: string | null;
  birth_date?: string | null;
  email: string | null;
  phone: string | null;
  zip_code?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  status: "active" | "inactive" | "delinquent" | string;
  benefit_cards?: Array<{
    id: string;
    card_number: string;
    active: boolean;
    expires_at: string | null;
  }>;
  patient_invitations?: Array<{
    id: string;
    email: string;
    status: string;
    email_status?: string | null;
    email_error?: string | null;
    email_sent_at?: string | null;
    email_last_attempt_at?: string | null;
    expires_at: string;
    created_at: string;
  }>;
};

type PatientFormState = {
  id?: string;
  full_name: string;
  cpf: string;
  birth_date: string;
  email: string;
  phone: string;
  zip_code: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  status: "active" | "inactive" | "delinquent";
};

const emptyPatient: PatientFormState = {
  full_name: "",
  cpf: "",
  birth_date: "",
  email: "",
  phone: "",
  zip_code: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  status: "active",
};

function PatientsPage() {
  const { tenant } = Route.useParams();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const queryClient = useQueryClient();
  const fetchPatients = useServerFn(listPatients);
  const create = useServerFn(createPatient);
  const update = useServerFn(updatePatient);
  const remove = useServerFn(deletePatient);
  const invite = useServerFn(invitePatientToPortal);
  const bulkImport = useServerFn(importPatients);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<PatientFormState | null>(null);
  const [importOpen, setImportOpen] = useState(false);

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
    onSuccess: async (result) => {
      if (form?.id) {
        toast.success("Paciente atualizado");
      } else if (result.invitation?.emailResult.sent) {
        toast.success("Paciente criado e convite enviado por e-mail");
      } else if (result.invitation) {
        toast.warning(
          "Paciente criado, mas o e-mail do convite não foi enviado. Verifique Resend.",
          { description: result.invitation.email_error ?? describeEmailResult(result.emailResult) },
        );
      } else {
        toast.success("Paciente criado com cartão digital");
      }
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

  const inviteMutation = useMutation({
    mutationFn: (id: string) => invite({ data: { tenant, id } }),
    onSuccess: async (result) => {
      if (result.emailResult.sent) {
        toast.success("Convite enviado para o paciente");
      } else {
        toast.warning("Convite criado, mas o e-mail não foi enviado.", {
          description: result.invitation.email_error ?? describeEmailResult(result.emailResult),
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["patients", tenant] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const importMutation = useMutation({
    mutationFn: (rows: Array<PatientFormState>) =>
      bulkImport({
        data: {
          tenant,
          patients: rows.map((row) => ({
            full_name: row.full_name,
            cpf: row.cpf,
            birth_date: row.birth_date,
            email: row.email,
            phone: row.phone,
            zip_code: row.zip_code,
            street: row.street,
            number: row.number,
            complement: row.complement,
            neighborhood: row.neighborhood,
            city: row.city,
            state: row.state,
            status: row.status,
          })),
        },
      }),
    onSuccess: async (result) => {
      toast.success(
        `${result.created.length} pacientes importados${
          result.skipped.length ? `, ${result.skipped.length} ignorados` : ""
        }`,
      );
      setImportOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["patients", tenant] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const patients = (data?.patients ?? []) as Patient[];
  const basePath = `/app/${tenant}/patients`;

  if (pathname !== basePath && pathname.startsWith(`${basePath}/`)) {
    return <Outlet />;
  }

  return (
    <>
      <PageHeader
        title="Pacientes"
        subtitle="Gerencie titulares e dependentes do programa."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => downloadPatientsCsv(patients)}
              className="inline-flex items-center gap-2 rounded-lg border border-input px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
            >
              <Download className="h-4 w-4" />
              Exportar
            </button>
            <button
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-input px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
            >
              <Upload className="h-4 w-4" />
              Importar CSV
            </button>
            <button
              onClick={() => setForm(emptyPatient)}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              Novo paciente
            </button>
          </div>
        }
      />
      {importOpen && (
        <ImportModal
          loading={importMutation.isPending}
          onClose={() => setImportOpen(false)}
          onImport={(rows) => importMutation.mutate(rows)}
        />
      )}
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
          <>
            <div className="divide-y divide-border md:hidden">
              {patients.map((patient) => {
                const card = patient.benefit_cards?.[0];
                return (
                  <div key={patient.id} className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          to="/app/$tenant/patients/$patientId"
                          params={{ tenant, patientId: patient.id }}
                          className="font-medium text-foreground hover:text-primary"
                        >
                          {patient.full_name}
                        </Link>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatCpf(patient.cpf)}
                        </div>
                      </div>
                      <StatusBadge status={patient.status} />
                    </div>
                    <div className="grid gap-3 rounded-xl border border-border bg-surface p-3 text-sm">
                      <div>
                        <div className="text-xs text-muted-foreground">Contato</div>
                        <div className="mt-0.5 break-words text-foreground">
                          {patient.email || "Sem e-mail"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {patient.phone || "Sem telefone"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Cartão</div>
                        <div className="mt-0.5 font-medium text-foreground">
                          {card?.card_number ?? "Sem cartão"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {card?.active ? "Ativo" : "Inativo"}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        to="/app/$tenant/patients/$patientId"
                        params={{ tenant, patientId: patient.id }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Detalhes
                      </Link>
                      <button
                        onClick={() => setForm(toFormState(patient))}
                        className="rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
                      >
                        Editar
                      </button>
                      <button
                        disabled={inviteMutation.isPending || Boolean(patient.user_id)}
                        onClick={() => inviteMutation.mutate(patient.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent disabled:opacity-60"
                      >
                        <Send className="h-3.5 w-3.5" />
                        {patient.user_id
                          ? "Com acesso"
                          : lastInvitation(patient)?.status === "pending"
                            ? "Reenviar"
                            : "Convidar"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hidden overflow-x-auto md:block">
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
                        <td className="px-5 py-4 font-medium text-foreground">
                          <Link
                            to="/app/$tenant/patients/$patientId"
                            params={{ tenant, patientId: patient.id }}
                            className="hover:text-primary"
                          >
                            {patient.full_name}
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">
                          {formatCpf(patient.cpf)}
                        </td>
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
                            <Link
                              to="/app/$tenant/patients/$patientId"
                              params={{ tenant, patientId: patient.id }}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Detalhes
                            </Link>
                            <button
                              onClick={() => setForm(toFormState(patient))}
                              className="rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
                            >
                              Editar
                            </button>
                            <button
                              disabled={inviteMutation.isPending || Boolean(patient.user_id)}
                              onClick={() => inviteMutation.mutate(patient.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent disabled:opacity-60"
                            >
                              <Send className="h-3.5 w-3.5" />
                              {patient.user_id
                                ? "Com acesso"
                                : lastInvitation(patient)?.status === "pending"
                                  ? "Reenviar"
                                  : "Convidar"}
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
          </>
        )}
      </Card>
    </>
  );
}

function ImportModal({
  loading,
  onClose,
  onImport,
}: {
  loading: boolean;
  onClose: () => void;
  onImport: (rows: PatientFormState[]) => void;
}) {
  const [csvText, setCsvText] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      const rows = parsePatientsCsv(csvText);
      if (rows.length === 0) throw new Error("Nenhum paciente encontrado no CSV.");
      onImport(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "CSV inválido.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-2xl rounded-xl border border-border bg-surface-elevated p-6 shadow-elegant"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="font-display text-xl text-foreground">Importar pacientes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Use colunas: nome, cpf, email, telefone, status. Status pode ser ativo, inadimplente ou
          inativo.
        </p>
        <form className="mt-5 space-y-4" onSubmit={submit}>
          <textarea
            value={csvText}
            onChange={(event) => {
              setCsvText(event.target.value);
              setError(null);
            }}
            rows={10}
            placeholder={
              "nome,cpf,email,telefone,status\nMaria Silva,12345678909,maria@email.com,11999990000,ativo"
            }
            className="block w-full resize-y rounded-lg border border-input bg-surface-elevated px-3 py-2.5 text-sm leading-6 text-foreground shadow-soft outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            required
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2 pt-2">
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
              {loading ? "Importando..." : "Importar pacientes"}
            </button>
          </div>
        </form>
      </div>
    </div>
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
  const [cepLoading, setCepLoading] = useState(false);

  function setField<K extends keyof PatientFormState>(key: K, fieldValue: PatientFormState[K]) {
    setValue((current) => ({ ...current, [key]: fieldValue }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-surface-elevated p-6 shadow-elegant"
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
          <Field
            label="Nascimento"
            type="date"
            value={value.birth_date}
            onChange={(event) => setField("birth_date", event.target.value)}
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
          <div className="border-t border-border pt-4 sm:col-span-2">
            <h3 className="text-sm font-medium text-foreground">Endereço</h3>
          </div>
          <Field
            label="CEP"
            value={value.zip_code}
            onChange={(event) => setField("zip_code", event.target.value)}
            placeholder="00000-000"
          />
          <div className="flex items-end">
            <button
              type="button"
              disabled={cepLoading || value.zip_code.replace(/\D/g, "").length !== 8}
              onClick={async () => {
                setCepLoading(true);
                try {
                  const address = await lookupCep(value.zip_code);
                  setValue((current) => ({ ...current, ...address }));
                  toast.success("Endereço preenchido pelo CEP");
                } catch (err) {
                  toast.error((err as Error).message);
                } finally {
                  setCepLoading(false);
                }
              }}
              className="w-full rounded-lg border border-input px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-accent disabled:opacity-60"
            >
              {cepLoading ? "Buscando..." : "Buscar CEP"}
            </button>
          </div>
          <Field
            className="sm:col-span-2"
            label="Logradouro"
            value={value.street}
            onChange={(event) => setField("street", event.target.value)}
          />
          <Field
            label="Número"
            value={value.number}
            onChange={(event) => setField("number", event.target.value)}
          />
          <Field
            label="Complemento"
            value={value.complement}
            onChange={(event) => setField("complement", event.target.value)}
          />
          <Field
            label="Bairro"
            value={value.neighborhood}
            onChange={(event) => setField("neighborhood", event.target.value)}
          />
          <div className="grid gap-3 sm:grid-cols-[1fr_80px]">
            <Field
              label="Cidade"
              value={value.city}
              onChange={(event) => setField("city", event.target.value)}
            />
            <Field
              label="UF"
              maxLength={2}
              value={value.state}
              onChange={(event) => setField("state", event.target.value)}
            />
          </div>
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

function lastInvitation(patient: Patient) {
  return patient.patient_invitations?.[0];
}

function describeEmailResult(result: { sent: boolean; reason?: string; error?: string }) {
  if (result.sent) return "Resend confirmou o envio.";
  if (result.reason === "missing_resend_api_key") {
    return "RESEND_API_KEY não está disponível no ambiente publicado.";
  }
  return result.error || "Resend recusou o envio sem detalhar o motivo.";
}

function parsePatientsCsv(value: string): PatientFormState[] {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
    return {
      full_name: row.nome || row.full_name || row.name,
      cpf: row.cpf ?? "",
      birth_date: row.nascimento || row.birth_date || "",
      email: row.email ?? "",
      phone: row.telefone || row.phone || "",
      zip_code: row.cep || row.zip_code || "",
      street: row.logradouro || row.rua || row.street || "",
      number: row.numero || row.number || "",
      complement: row.complemento || row.complement || "",
      neighborhood: row.bairro || row.neighborhood || "",
      city: row.cidade || row.city || "",
      state: row.uf || row.state || "",
      status: normalizeStatus(row.status),
    };
  });
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if ((char === "," || char === ";") && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_");
}

function normalizeStatus(value?: string): PatientFormState["status"] {
  const normalized = normalizeHeader(value ?? "");
  if (normalized === "inadimplente" || normalized === "delinquent") return "delinquent";
  if (normalized === "inativo" || normalized === "inactive") return "inactive";
  return "active";
}

function downloadPatientsCsv(patients: Patient[]) {
  const rows = [
    ["nome", "cpf", "email", "telefone", "status", "cartao", "acesso"],
    ...patients.map((patient) => [
      patient.full_name,
      patient.cpf ?? "",
      patient.email ?? "",
      patient.phone ?? "",
      patient.status,
      patient.benefit_cards?.[0]?.card_number ?? "",
      patient.user_id ? "sim" : "nao",
    ]),
  ];
  downloadCsv("pacientes-medyco.csv", rows);
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
    birth_date: patient.birth_date ?? "",
    email: patient.email ?? "",
    phone: patient.phone ?? "",
    zip_code: patient.zip_code ?? "",
    street: patient.street ?? "",
    number: patient.number ?? "",
    complement: patient.complement ?? "",
    neighborhood: patient.neighborhood ?? "",
    city: patient.city ?? "",
    state: patient.state ?? "",
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
