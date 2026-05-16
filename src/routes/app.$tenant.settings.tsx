import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, PageHeader } from "@/components/portal/Shell";
import { supabase } from "@/integrations/supabase-ext/client";
import { lookupCep, lookupCnpj } from "@/lib/brasil-data";
import { getTenantBySlug, updateTenantSettings } from "@/lib/tenants.functions";

export const Route = createFileRoute("/app/$tenant/settings")({
  component: TenantSettingsPage,
});

type TenantFormState = {
  id: string;
  name: string;
  legal_name: string;
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
  status: "trial" | "active" | "paused" | "canceled";
};

function TenantSettingsPage() {
  const { tenant } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchTenant = useServerFn(getTenantBySlug);
  const updateTenant = useServerFn(updateTenantSettings);
  const [form, setForm] = useState<TenantFormState | null>(null);
  const [uploading, setUploading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState<"cnpj" | "cep" | null>(null);

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
                  disabled={lookupLoading === "cnpj" || form.cnpj.replace(/\D/g, "").length !== 14}
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
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-foreground">Upload da logo</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  disabled={uploading}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
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
                  className="mt-1.5 block w-full rounded-lg border border-input bg-surface-elevated px-3 py-2.5 text-sm text-foreground"
                />
              </label>
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
              <div className="mt-1 text-sm text-muted-foreground">
                {form.email || "E-mail não informado"}
              </div>
              <div className="mt-3 inline-flex rounded-md bg-brand-soft px-2 py-0.5 text-xs text-brand">
                {form.status}
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </>
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
