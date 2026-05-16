import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Card, PageHeader } from "@/components/portal/Shell";
import { lookupCnpj, normalizeSlug } from "@/lib/brasil-data";
import { listMyTenants, createTenant } from "@/lib/tenants.functions";

export const Route = createFileRoute("/admin/tenants")({
  component: TenantsPage,
});

function TenantsPage() {
  const router = useRouter();
  const fetchTenants = useServerFn(listMyTenants);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["tenants"],
    queryFn: () => fetchTenants(),
  });
  const [open, setOpen] = useState(false);

  const tenants = data?.tenants ?? [];

  return (
    <>
      <PageHeader
        title="Tenants"
        subtitle="Clínicas operando na infraestrutura Medyco."
        action={
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Novo tenant
          </button>
        }
      />

      {open && (
        <NewTenantModal
          onClose={() => setOpen(false)}
          onCreated={() => {
            setOpen(false);
            refetch();
            router.invalidate();
          }}
        />
      )}

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="px-5 py-8 text-sm text-muted-foreground">Carregando…</div>
        ) : error ? (
          <div className="px-5 py-8 text-sm text-destructive">{(error as Error).message}</div>
        ) : tenants.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            Nenhuma clínica ainda. Crie a primeira para começar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Nome</th>
                  <th className="px-5 py-3">Slug</th>
                  <th className="px-5 py-3">Mensalidade</th>
                  <th className="px-5 py-3">Split</th>
                  <th className="px-5 py-3">Asaas</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id} className="border-t border-border">
                    <td className="px-5 py-4 font-medium text-foreground">{t.name}</td>
                    <td className="px-5 py-4 text-muted-foreground">/{t.slug}</td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {formatCurrency(t.monthly_fee)}
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {formatPercent(t.split_percentage)}%
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs ${
                          t.asaas_onboarding_status === "active" && t.asaas_api_key_ref
                            ? "bg-success/15 text-success"
                            : t.asaas_onboarding_status === "under_review" ||
                                t.asaas_onboarding_status === "pending_documents"
                              ? "bg-warning/15 text-warning"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {asaasStatusLabel(t.asaas_onboarding_status)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs ${
                          t.status === "active"
                            ? "bg-success/15 text-success"
                            : t.status === "trial"
                              ? "bg-brand-soft text-brand"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          to="/app/$tenant"
                          params={{ tenant: t.slug }}
                          className="rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
                        >
                          Abrir
                        </Link>
                        <Link
                          to="/app/$tenant/settings"
                          params={{ tenant: t.slug }}
                          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90"
                        >
                          Configurar
                        </Link>
                      </div>
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

function NewTenantModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const create = useServerFn(createTenant);
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [slug, setSlug] = useState("");
  const [monthlyFee, setMonthlyFee] = useState("197");
  const [splitPercentage, setSplitPercentage] = useState("10");
  const [patientSubscriptionSuggestion, setPatientSubscriptionSuggestion] = useState("39.90");
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await create({
        data: {
          name,
          legal_name: legalName,
          cnpj,
          email,
          phone,
          zip_code: zipCode,
          street,
          number,
          complement,
          neighborhood,
          city,
          state,
          slug,
          plan: "starter",
          monthly_fee: Number(monthlyFee || 197),
          split_percentage: Number(splitPercentage || 10),
          patient_subscription_suggestion: Number(patientSubscriptionSuggestion || 39.9),
        },
      });
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao criar clínica");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-surface-elevated p-6 shadow-elegant"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl text-foreground">Nova clínica</h2>
        <p className="mt-1 text-sm text-muted-foreground">Você será o admin desta clínica.</p>
        <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
          <Field
            label="CNPJ"
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            placeholder="00.000.000/0001-00"
          />
          <div className="flex items-end">
            <button
              type="button"
              disabled={lookupLoading || cnpj.replace(/\D/g, "").length !== 14}
              onClick={async () => {
                setLookupLoading(true);
                try {
                  const result = await lookupCnpj(cnpj);
                  setCnpj(result.cnpj);
                  setName(result.name || result.legal_name || name);
                  setLegalName(result.legal_name || legalName);
                  setEmail(result.email || email);
                  setPhone(result.phone || phone);
                  setZipCode(result.zip_code || zipCode);
                  setStreet(result.street || street);
                  setNumber(result.number || number);
                  setComplement(result.complement || complement);
                  setNeighborhood(result.neighborhood || neighborhood);
                  setCity(result.city || city);
                  setState(result.state || state);
                  if (!slug) setSlug(normalizeSlug(result.name || result.legal_name));
                  toast.success("Dados do CNPJ preenchidos");
                } catch (error) {
                  toast.error((error as Error).message);
                } finally {
                  setLookupLoading(false);
                }
              }}
              className="w-full rounded-lg border border-input px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-accent disabled:opacity-60"
            >
              {lookupLoading ? "Buscando..." : "Buscar CNPJ"}
            </button>
          </div>
          <Field
            className="sm:col-span-2"
            label="Nome fantasia"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slug) setSlug(normalizeSlug(e.target.value));
            }}
            required
          />
          <Field
            className="sm:col-span-2"
            label="Razão social"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
          />
          <Field
            label="Slug (URL)"
            value={slug}
            onChange={(e) => setSlug(normalizeSlug(e.target.value))}
            placeholder="minha-clinica"
            pattern="[a-z0-9\-]+"
            required
          />
          <Field
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Field label="Telefone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Field label="CEP" value={zipCode} onChange={(e) => setZipCode(e.target.value)} />
          <Field
            className="sm:col-span-2"
            label="Logradouro"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
          />
          <Field label="Número" value={number} onChange={(e) => setNumber(e.target.value)} />
          <Field
            label="Complemento"
            value={complement}
            onChange={(e) => setComplement(e.target.value)}
          />
          <Field
            label="Bairro"
            value={neighborhood}
            onChange={(e) => setNeighborhood(e.target.value)}
          />
          <div className="grid gap-3 sm:grid-cols-[1fr_80px]">
            <Field label="Cidade" value={city} onChange={(e) => setCity(e.target.value)} />
            <Field
              label="UF"
              maxLength={2}
              value={state}
              onChange={(e) => setState(e.target.value)}
            />
          </div>
          <div className="border-t border-border pt-4 sm:col-span-2">
            <h3 className="text-sm font-medium text-foreground">Modelo comercial</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Mensalidade única + split sobre cada assinatura de paciente paga.
            </p>
          </div>
          <Field
            label="Mensalidade da clínica"
            type="number"
            min="0"
            step="0.01"
            value={monthlyFee}
            onChange={(e) => setMonthlyFee(e.target.value)}
          />
          <Field
            label="Split Medyco (%)"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={splitPercentage}
            onChange={(e) => setSplitPercentage(e.target.value)}
          />
          <Field
            label="Sugestão assinatura paciente"
            type="number"
            min="0"
            step="0.01"
            value={patientSubscriptionSuggestion}
            onChange={(e) => setPatientSubscriptionSuggestion(e.target.value)}
          />
          {err && <p className="text-sm text-destructive">{err}</p>}
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
              {loading ? "Criando…" : "Criar clínica"}
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

function formatCurrency(value?: number | string | null) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value ?? 197));
}

function formatPercent(value?: number | string | null) {
  return Number(value ?? 10).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function asaasStatusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    not_started: "não iniciado",
    pending_documents: "documentos",
    under_review: "em análise",
    active: "ativo",
    rejected: "rejeitado",
    disabled: "desativado",
  };
  return labels[status ?? "not_started"] ?? "não iniciado";
}
