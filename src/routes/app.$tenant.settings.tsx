import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, UploadCloud } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, PageHeader } from "@/components/portal/Shell";
import { supabase } from "@/integrations/supabase-ext/client";
import { lookupCep, lookupCnpj } from "@/lib/brasil-data";
import {
  createTenantAsaasSubaccount,
  getTenantBySlug,
  updateTenantSettings,
} from "@/lib/tenants.functions";

export const Route = createFileRoute("/app/$tenant/settings")({
  component: TenantSettingsPage,
});

type TenantFormState = {
  id: string;
  name: string;
  legal_name: string;
  responsible_name: string;
  responsible_role: string;
  logo_url: string;
  brand_color: string;
  email: string;
  phone: string;
  cnpj: string;
  zip_code: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  monthly_fee: number;
  split_fixed_fee: number;
  split_percentage: number;
  patient_subscription_suggestion: number;
  asaas_account_id: string;
  asaas_wallet_id: string;
  asaas_api_key_ref: string;
  asaas_onboarding_status:
    | "not_started"
    | "pending_documents"
    | "under_review"
    | "active"
    | "rejected"
    | "disabled";
  asaas_split_enabled: boolean;
  status: "trial" | "active" | "paused" | "canceled";
};

type FieldValue = string | number | readonly string[];
type AsaasSubaccountResult = {
  id: string;
  walletId: string;
  apiKey: string;
  apiKeyRef: string;
  name?: string;
};

function TenantSettingsPage() {
  const { tenant } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchTenant = useServerFn(getTenantBySlug);
  const updateTenant = useServerFn(updateTenantSettings);
  const createSubaccount = useServerFn(createTenantAsaasSubaccount);
  const [form, setForm] = useState<TenantFormState | null>(null);
  const [uploading, setUploading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState<"cnpj" | "cep" | null>(null);
  const [asaasModalOpen, setAsaasModalOpen] = useState(false);
  const [asaasResult, setAsaasResult] = useState<AsaasSubaccountResult | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["tenant-settings", tenant],
    queryFn: () => fetchTenant({ data: { slug: tenant } }),
  });

  useEffect(() => {
    if (!data?.tenant) return;
    setForm({
      id: data.tenant.id,
      name: data.tenant.name,
      legal_name: data.tenant.legal_name ?? "",
      responsible_name: data.tenant.responsible_name ?? "",
      responsible_role: data.tenant.responsible_role ?? "",
      logo_url: data.tenant.logo_url ?? "",
      brand_color: data.tenant.brand_color ?? "#0ea5e9",
      email: data.tenant.email ?? "",
      phone: data.tenant.phone ?? "",
      cnpj: data.tenant.cnpj ?? "",
      zip_code: data.tenant.zip_code ?? "",
      street: data.tenant.street ?? "",
      number: data.tenant.number ?? "",
      complement: data.tenant.complement ?? "",
      neighborhood: data.tenant.neighborhood ?? "",
      city: data.tenant.city ?? "",
      state: data.tenant.state ?? "",
      monthly_fee: Number(data.tenant.monthly_fee ?? 197),
      split_fixed_fee: Number(data.tenant.split_fixed_fee ?? 2.9),
      split_percentage: Number(data.tenant.split_percentage ?? 7.9),
      patient_subscription_suggestion: Number(data.tenant.patient_subscription_suggestion ?? 39.9),
      asaas_account_id: data.tenant.asaas_account_id ?? "",
      asaas_wallet_id: data.tenant.asaas_wallet_id ?? "",
      asaas_api_key_ref: data.tenant.asaas_api_key_ref ?? "",
      asaas_onboarding_status: data.tenant.asaas_onboarding_status ?? "not_started",
      asaas_split_enabled: data.tenant.asaas_split_enabled ?? true,
      status: data.tenant.status,
    });
  }, [data?.tenant]);

  const mutation = useMutation({
    mutationFn: (value: TenantFormState) => updateTenant({ data: value }),
    onSuccess: async () => {
      toast.success("Configurações salvas");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tenant", tenant] }),
        queryClient.invalidateQueries({ queryKey: ["tenant-settings", tenant] }),
      ]);
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const asaasMutation = useMutation({
    mutationFn: (value: AsaasSubaccountInput) => createSubaccount({ data: value }),
    onSuccess: async (result) => {
      setAsaasResult(result.subaccount);
      setForm((current) =>
        current
          ? {
              ...current,
              asaas_account_id: result.tenant.asaas_account_id ?? "",
              asaas_wallet_id: result.tenant.asaas_wallet_id ?? "",
              asaas_api_key_ref: result.tenant.asaas_api_key_ref ?? "",
              asaas_onboarding_status: result.tenant.asaas_onboarding_status ?? "active",
              asaas_split_enabled: result.tenant.asaas_split_enabled ?? true,
            }
          : current,
      );
      toast.success("Subconta Asaas criada. Salve a API key como secret no Lovable.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tenant", tenant] }),
        queryClient.invalidateQueries({ queryKey: ["tenant-settings", tenant] }),
      ]);
    },
    onError: (err) => toast.error((err as Error).message),
  });

  return (
    <>
      <PageHeader
        title="Configurações"
        subtitle="Ajuste identidade, dados públicos e status da clínica."
      />

      {isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground">Carregando configurações...</Card>
      ) : error ? (
        <Card className="p-6 text-sm text-destructive">{(error as Error).message}</Card>
      ) : form ? (
        <>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="p-6 lg:col-span-2">
              <form
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  mutation.mutate(form);
                }}
              >
                <Field
                  className="sm:col-span-2"
                  label="Nome da clínica"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  required
                />
                <Field
                  className="sm:col-span-2"
                  label="Razão social"
                  value={form.legal_name}
                  onChange={(event) => setForm({ ...form, legal_name: event.target.value })}
                />
                <div className="border-t border-border pt-4 sm:col-span-2">
                  <h3 className="text-sm font-medium text-foreground">Responsável legal</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Dados usados em contrato, cobrança e cadastro financeiro da clínica.
                  </p>
                </div>
                <Field
                  label="Nome do responsável"
                  value={form.responsible_name}
                  onChange={(event) => setForm({ ...form, responsible_name: event.target.value })}
                  placeholder="Nome de quem assina pela clínica"
                />
                <Field
                  label="Cargo do responsável"
                  value={form.responsible_role}
                  onChange={(event) => setForm({ ...form, responsible_role: event.target.value })}
                  placeholder="Ex.: Sócio administrador"
                />
                <Field
                  label="E-mail"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  placeholder="contato@clinica.com.br"
                />
                <Field
                  label="Telefone"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  placeholder="(11) 99999-0000"
                />
                <Field
                  label="CNPJ"
                  value={form.cnpj}
                  onChange={(event) => setForm({ ...form, cnpj: event.target.value })}
                  placeholder="00.000.000/0001-00"
                />
                <div className="flex items-end">
                  <button
                    type="button"
                    disabled={
                      lookupLoading === "cnpj" || form.cnpj.replace(/\D/g, "").length !== 14
                    }
                    onClick={async () => {
                      if (!form) return;
                      setLookupLoading("cnpj");
                      try {
                        const result = await lookupCnpj(form.cnpj);
                        setForm({
                          ...form,
                          name: result.name || form.name,
                          legal_name: result.legal_name || form.legal_name,
                          cnpj: result.cnpj,
                          email: result.email || form.email,
                          phone: result.phone || form.phone,
                          zip_code: result.zip_code || form.zip_code,
                          street: result.street || form.street,
                          number: result.number || form.number,
                          complement: result.complement || form.complement,
                          neighborhood: result.neighborhood || form.neighborhood,
                          city: result.city || form.city,
                          state: result.state || form.state,
                        });
                        toast.success("Dados do CNPJ preenchidos");
                      } catch (err) {
                        toast.error((err as Error).message);
                      } finally {
                        setLookupLoading(null);
                      }
                    }}
                    className="w-full rounded-lg border border-input px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-accent disabled:opacity-60"
                  >
                    {lookupLoading === "cnpj" ? "Buscando..." : "Buscar CNPJ"}
                  </button>
                </div>
                <label className="block">
                  <span className="text-xs font-medium text-foreground">Status</span>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm({ ...form, status: event.target.value as TenantFormState["status"] })
                    }
                    className="mt-1.5 block w-full rounded-lg border border-input bg-surface-elevated px-3 py-2.5 text-sm text-foreground"
                  >
                    <option value="trial">Trial</option>
                    <option value="active">Ativa</option>
                    <option value="paused">Pausada</option>
                    <option value="canceled">Cancelada</option>
                  </select>
                </label>
                <Field
                  className="sm:col-span-2"
                  label="Logo URL"
                  value={form.logo_url}
                  onChange={(event) => setForm({ ...form, logo_url: event.target.value })}
                  placeholder="https://..."
                />
                <div className="sm:col-span-2">
                  <span className="text-xs font-medium text-foreground">Logo da clínica</span>
                  <div className="mt-1.5 flex flex-col gap-3 rounded-xl border border-input bg-surface-elevated p-4 sm:flex-row sm:items-center">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface">
                      {form.logo_url ? (
                        <img
                          src={form.logo_url}
                          alt="Logo da clínica"
                          className="h-full w-full object-contain p-2"
                        />
                      ) : (
                        <ImagePlus className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {form.logo_url ? "Logo carregada" : "Enviar arquivo da marca"}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Use PNG, JPG, WEBP ou SVG. Depois do envio, clique em salvar para aplicar no
                        portal.
                      </p>
                      {form.logo_url && (
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {form.logo_url}
                        </p>
                      )}
                    </div>
                    <label
                      aria-disabled={uploading}
                      className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-soft transition hover:opacity-90 aria-disabled:pointer-events-none aria-disabled:opacity-60"
                    >
                      <UploadCloud className="h-4 w-4" />
                      {uploading ? "Enviando..." : "Enviar logo"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        disabled={uploading}
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          event.currentTarget.value = "";
                          if (!file || !form) return;
                          setUploading(true);
                          try {
                            const url = await uploadTenantLogo(form.id, file);
                            setForm({ ...form, logo_url: url });
                            toast.success("Logo enviada. Clique em salvar para aplicar.");
                          } catch (err) {
                            toast.error((err as Error).message);
                          } finally {
                            setUploading(false);
                          }
                        }}
                        className="sr-only"
                      />
                    </label>
                  </div>
                </div>
                <div className="sm:col-span-2 mt-2 border-t border-border pt-4">
                  <h3 className="text-sm font-medium text-foreground">Endereço</h3>
                </div>
                <Field
                  label="CEP"
                  value={form.zip_code}
                  onChange={(event) => setForm({ ...form, zip_code: event.target.value })}
                  placeholder="00000-000"
                />
                <div className="flex items-end">
                  <button
                    type="button"
                    disabled={
                      lookupLoading === "cep" || form.zip_code.replace(/\D/g, "").length !== 8
                    }
                    onClick={async () => {
                      if (!form) return;
                      setLookupLoading("cep");
                      try {
                        const result = await lookupCep(form.zip_code);
                        setForm({ ...form, ...result });
                        toast.success("Endereço preenchido pelo CEP");
                      } catch (err) {
                        toast.error((err as Error).message);
                      } finally {
                        setLookupLoading(null);
                      }
                    }}
                    className="w-full rounded-lg border border-input px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-accent disabled:opacity-60"
                  >
                    {lookupLoading === "cep" ? "Buscando..." : "Buscar CEP"}
                  </button>
                </div>
                <Field
                  className="sm:col-span-2"
                  label="Logradouro"
                  value={form.street}
                  onChange={(event) => setForm({ ...form, street: event.target.value })}
                />
                <Field
                  label="Número"
                  value={form.number}
                  onChange={(event) => setForm({ ...form, number: event.target.value })}
                />
                <Field
                  label="Complemento"
                  value={form.complement}
                  onChange={(event) => setForm({ ...form, complement: event.target.value })}
                />
                <Field
                  label="Bairro"
                  value={form.neighborhood}
                  onChange={(event) => setForm({ ...form, neighborhood: event.target.value })}
                />
                <div className="grid gap-3 sm:grid-cols-[1fr_80px]">
                  <Field
                    label="Cidade"
                    value={form.city}
                    onChange={(event) => setForm({ ...form, city: event.target.value })}
                  />
                  <Field
                    label="UF"
                    maxLength={2}
                    value={form.state}
                    onChange={(event) => setForm({ ...form, state: event.target.value })}
                  />
                </div>
                <div className="border-t border-border pt-4 sm:col-span-2">
                  <h3 className="text-sm font-medium text-foreground">Modelo comercial</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    A Medyco cobra uma mensalidade fixa da clínica, uma taxa operacional por
                    paciente pago e uma participação percentual.
                  </p>
                </div>
                <Field
                  label="Mensalidade da clínica"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.monthly_fee}
                  onChange={(event) =>
                    setForm({ ...form, monthly_fee: Number(event.target.value) })
                  }
                />
                <Field
                  label="Taxa operacional por paciente"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.split_fixed_fee}
                  onChange={(event) =>
                    setForm({ ...form, split_fixed_fee: Number(event.target.value) })
                  }
                />
                <Field
                  label="Participação Medyco (%)"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.split_percentage}
                  onChange={(event) =>
                    setForm({ ...form, split_percentage: Number(event.target.value) })
                  }
                />
                <Field
                  label="Sugestão assinatura paciente"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.patient_subscription_suggestion}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      patient_subscription_suggestion: Number(event.target.value),
                    })
                  }
                />
                <div className="border-t border-border pt-4 sm:col-span-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-medium text-foreground">Asaas marketplace</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Modelo recomendado: a clínica recebe na própria subconta/carteira e a Medyco
                        recebe o split automático.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAsaasResult(null);
                        setAsaasModalOpen(true);
                      }}
                      className="rounded-lg border border-input px-3 py-2 text-xs font-medium text-foreground transition hover:bg-accent"
                    >
                      Criar subconta Asaas
                    </button>
                  </div>
                </div>
                <Field
                  label="ID da conta Asaas"
                  value={form.asaas_account_id}
                  onChange={(event) => setForm({ ...form, asaas_account_id: event.target.value })}
                  placeholder="Opcional"
                />
                <Field
                  label="Wallet ID da clínica"
                  value={form.asaas_wallet_id}
                  onChange={(event) => setForm({ ...form, asaas_wallet_id: event.target.value })}
                  placeholder="wallet da subconta"
                />
                <Field
                  className="sm:col-span-2"
                  label="Nome do secret da API key da clínica"
                  value={form.asaas_api_key_ref}
                  onChange={(event) => setForm({ ...form, asaas_api_key_ref: event.target.value })}
                  placeholder="Ex.: ASAAS_TENANT_SANTAVIDA_API_KEY"
                />
                <label className="block">
                  <span className="text-xs font-medium text-foreground">Status Asaas</span>
                  <select
                    value={form.asaas_onboarding_status}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        asaas_onboarding_status: event.target
                          .value as TenantFormState["asaas_onboarding_status"],
                      })
                    }
                    className="mt-1.5 block w-full rounded-lg border border-input bg-surface-elevated px-3 py-2.5 text-sm text-foreground"
                  >
                    <option value="not_started">Não iniciado</option>
                    <option value="pending_documents">Documentos pendentes</option>
                    <option value="under_review">Em análise</option>
                    <option value="active">Ativo</option>
                    <option value="rejected">Rejeitado</option>
                    <option value="disabled">Desativado</option>
                  </select>
                </label>
                <label className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
                  <input
                    type="checkbox"
                    checked={form.asaas_split_enabled}
                    onChange={(event) =>
                      setForm({ ...form, asaas_split_enabled: event.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  <span>
                    <span className="block text-sm font-medium text-foreground">Split ativo</span>
                    <span className="block text-xs text-muted-foreground">
                      Solicitar R$ 2,90 + 7,9% para a Medyco nas cobranças do paciente.
                    </span>
                  </span>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-foreground">Cor principal</span>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      type="color"
                      value={form.brand_color}
                      onChange={(event) => setForm({ ...form, brand_color: event.target.value })}
                      className="h-10 w-12 rounded-lg border border-input bg-surface-elevated p-1"
                    />
                    <input
                      value={form.brand_color}
                      onChange={(event) => setForm({ ...form, brand_color: event.target.value })}
                      className="block flex-1 rounded-lg border border-input bg-surface-elevated px-3 py-2.5 text-sm text-foreground shadow-soft outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                      required
                    />
                  </div>
                </label>
                <div className="flex justify-end pt-2 sm:col-span-2">
                  <button
                    disabled={mutation.isPending}
                    className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                  >
                    {mutation.isPending ? "Salvando..." : "Salvar configurações"}
                  </button>
                </div>
              </form>
            </Card>

            <Card className="p-6">
              <div className="text-sm font-medium text-foreground">Preview da marca</div>
              <div className="mt-4 rounded-2xl border border-border bg-surface p-5">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl text-sm font-semibold text-white"
                  style={{ backgroundColor: form.brand_color }}
                >
                  {initials(form.name)}
                </div>
                <div className="mt-4 font-display text-2xl text-foreground">{form.name}</div>
                <div className="mt-1 text-sm text-foreground">
                  {form.responsible_name || "Responsável não informado"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {form.responsible_role || "Cargo não informado"}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {form.email || "E-mail não informado"}
                </div>
                <div className="mt-3 inline-flex rounded-md bg-brand-soft px-2 py-0.5 text-xs text-brand">
                  {form.status}
                </div>
              </div>
            </Card>
          </div>
          {asaasModalOpen && (
            <AsaasSubaccountModal
              tenant={form}
              result={asaasResult}
              loading={asaasMutation.isPending}
              onClose={() => setAsaasModalOpen(false)}
              onSubmit={(input) => asaasMutation.mutate(input)}
            />
          )}
        </>
      ) : null}
    </>
  );
}

type AsaasSubaccountInput = {
  tenant_id: string;
  name: string;
  email: string;
  cpfCnpj: string;
  birthDate?: string;
  companyType: "MEI" | "LIMITED" | "INDIVIDUAL" | "ASSOCIATION";
  phone?: string;
  mobilePhone: string;
  incomeValue: number;
  address: string;
  addressNumber: string;
  complement?: string;
  province: string;
  postalCode: string;
  api_key_ref?: string;
};

function AsaasSubaccountModal({
  tenant,
  result,
  loading,
  onClose,
  onSubmit,
}: {
  tenant: TenantFormState;
  result: AsaasSubaccountResult | null;
  loading: boolean;
  onClose: () => void;
  onSubmit: (input: AsaasSubaccountInput) => void;
}) {
  const suggestedSecret = `ASAAS_TENANT_${tenant.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase()}_API_KEY`;
  const [companyType, setCompanyType] = useState<AsaasSubaccountInput["companyType"]>("LIMITED");
  const [birthDate, setBirthDate] = useState("");
  const [mobilePhone, setMobilePhone] = useState(tenant.phone);
  const [incomeValue, setIncomeValue] = useState("5000");
  const [secretName, setSecretName] = useState(suggestedSecret);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-surface-elevated p-6 shadow-elegant"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="font-display text-xl text-foreground">Criar subconta Asaas</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Usa a API key da conta Medyco configurada nos secrets e cria uma subconta para esta
          clínica.
        </p>

        {result ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-success/30 bg-success/10 p-4 text-sm text-foreground">
              Subconta criada. A clínica já recebeu ID, wallet e status ativo na Medyco.
            </div>
            <SecretBox label="Secret para criar no Lovable" value={result.apiKeyRef} />
            <SecretBox label="Valor do secret (API key da clínica)" value={result.apiKey} />
            <SecretBox label="ID da conta Asaas" value={result.id} />
            <SecretBox label="Wallet ID da clínica" value={result.walletId} />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
              >
                Concluir
              </button>
            </div>
          </div>
        ) : (
          <form
            className="mt-5 grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit({
                tenant_id: tenant.id,
                name: tenant.legal_name || tenant.name,
                email: tenant.email,
                cpfCnpj: tenant.cnpj,
                birthDate,
                companyType,
                phone: tenant.phone,
                mobilePhone,
                incomeValue: Number(incomeValue || 0),
                address: tenant.street,
                addressNumber: tenant.number,
                complement: tenant.complement,
                province: tenant.neighborhood,
                postalCode: tenant.zip_code,
                api_key_ref: secretName,
              });
            }}
          >
            <Field
              className="sm:col-span-2"
              label="Razão social/nome"
              value={tenant.legal_name || tenant.name}
              disabled
            />
            <Field label="CNPJ/CPF" value={tenant.cnpj} disabled />
            <Field label="E-mail" value={tenant.email} disabled />
            <label className="block">
              <span className="text-xs font-medium text-foreground">Tipo da empresa</span>
              <select
                value={companyType}
                onChange={(event) =>
                  setCompanyType(event.target.value as AsaasSubaccountInput["companyType"])
                }
                className="mt-1.5 block w-full rounded-lg border border-input bg-surface-elevated px-3 py-2.5 text-sm text-foreground"
              >
                <option value="LIMITED">LTDA / limitada</option>
                <option value="MEI">MEI</option>
                <option value="INDIVIDUAL">Individual</option>
                <option value="ASSOCIATION">Associação</option>
              </select>
            </label>
            <Field
              label="Data nasc. responsável"
              type="date"
              value={birthDate}
              onChange={(event) => setBirthDate(event.target.value)}
            />
            <Field
              label="Celular responsável"
              value={mobilePhone}
              onChange={(event) => setMobilePhone(event.target.value)}
              required
            />
            <Field
              label="Renda/faturamento mensal"
              type="number"
              min="0"
              step="0.01"
              value={incomeValue}
              onChange={(event) => setIncomeValue(event.target.value)}
              required
            />
            <Field label="CEP" value={tenant.zip_code} disabled />
            <Field className="sm:col-span-2" label="Endereço" value={tenant.street} disabled />
            <Field label="Número" value={tenant.number} disabled />
            <Field label="Bairro" value={tenant.neighborhood} disabled />
            <Field
              className="sm:col-span-2"
              label="Nome do secret no Lovable"
              value={secretName}
              onChange={(event) => setSecretName(event.target.value)}
              required
            />
            <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-xs text-warning sm:col-span-2">
              Depois de criar, copie a API key retornada e salve no Lovable com exatamente esse nome
              de secret. A API key aparece apenas nessa confirmação.
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
                {loading ? "Criando..." : "Criar subconta"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function SecretBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 break-all font-mono text-sm text-foreground">{value}</div>
    </div>
  );
}

function Field({
  label,
  className = "",
  value,
  ...props
}: { label: string; className?: string; value?: FieldValue } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value"
>) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-medium text-foreground">{label}</span>
      <input
        {...props}
        value={value}
        className="mt-1.5 block w-full rounded-lg border border-input bg-surface-elevated px-3 py-2.5 text-sm text-foreground shadow-soft outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
    </label>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

async function uploadTenantLogo(tenantId: string, file: File) {
  const extension = file.name.split(".").pop() || "png";
  const path = `${tenantId}/logo-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from("tenant-assets").upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("tenant-assets").getPublicUrl(path);
  return data.publicUrl;
}
