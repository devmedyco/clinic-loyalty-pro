import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Card, PageHeader } from "@/components/portal/Shell";
import { deleteProvider, listProviders, saveProvider } from "@/lib/providers.functions";

export const Route = createFileRoute("/app/$tenant/providers")({
  component: ProvidersPage,
});

type ServiceOption = { id: string; name: string };
type Provider = {
  id: string;
  name: string;
  specialty: string | null;
  document: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  active: boolean;
  provider_services?: Array<{
    service_id: string;
    services?: ServiceOption | ServiceOption[] | null;
  }>;
};

type ProviderForm = {
  id?: string;
  name: string;
  specialty: string;
  document: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  notes: string;
  active: boolean;
  service_ids: string[];
};

const emptyProvider: ProviderForm = {
  name: "",
  specialty: "",
  document: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  notes: "",
  active: true,
  service_ids: [],
};

function ProvidersPage() {
  const { tenant } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchProviders = useServerFn(listProviders);
  const save = useServerFn(saveProvider);
  const remove = useServerFn(deleteProvider);
  const [form, setForm] = useState<ProviderForm | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["providers", tenant],
    queryFn: () => fetchProviders({ data: { tenant } }),
  });

  const saveMutation = useMutation({
    mutationFn: (value: ProviderForm) => save({ data: { tenant, ...value } }),
    onSuccess: async () => {
      toast.success("Credenciado salvo");
      setForm(null);
      await queryClient.invalidateQueries({ queryKey: ["providers", tenant] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { tenant, id } }),
    onSuccess: async () => {
      toast.success("Credenciado removido");
      await queryClient.invalidateQueries({ queryKey: ["providers", tenant] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const providers = (data?.providers ?? []) as Provider[];
  const services = (data?.services ?? []) as ServiceOption[];

  return (
    <>
      <PageHeader
        title="Rede credenciada"
        subtitle="Gerencie médicos, parceiros, unidades e serviços visíveis para o paciente."
        action={
          <button
            onClick={() => setForm(emptyProvider)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Novo credenciado
          </button>
        }
      />
      {form && (
        <ProviderModal
          value={form}
          services={services}
          loading={saveMutation.isPending}
          onClose={() => setForm(null)}
          onSubmit={(value) => saveMutation.mutate(value)}
        />
      )}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="px-5 py-10 text-sm text-muted-foreground">Carregando rede...</div>
        ) : error ? (
          <div className="px-5 py-10 text-sm text-destructive">{(error as Error).message}</div>
        ) : providers.length === 0 ? (
          <div className="px-5 py-14 text-center text-sm text-muted-foreground">
            Nenhum credenciado cadastrado ainda.
          </div>
        ) : (
          <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            {providers.map((provider) => (
              <div key={provider.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                    <Building2 className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground">{provider.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {provider.specialty || "Especialidade não informada"}
                    </div>
                  </div>
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs ${provider.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}
                  >
                    {provider.active ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <div className="mt-4 space-y-1 text-sm text-muted-foreground">
                  <div>
                    {[provider.address, provider.city, provider.state]
                      .filter(Boolean)
                      .join(" · ") || "Endereço não informado"}
                  </div>
                  <div>{provider.phone || "Telefone não informado"}</div>
                  <div>{provider.email || "E-mail não informado"}</div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {providerServices(provider)
                    .slice(0, 4)
                    .map((service) => (
                      <span
                        key={service.id}
                        className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {service.name}
                      </span>
                    ))}
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setForm(toForm(provider))}
                    className="rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
                  >
                    Editar
                  </button>
                  <button
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      if (window.confirm(`Remover ${provider.name}?`))
                        deleteMutation.mutate(provider.id);
                    }}
                    className="rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive transition hover:bg-destructive/10 disabled:opacity-60"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

function ProviderModal({
  value: initialValue,
  services,
  loading,
  onClose,
  onSubmit,
}: {
  value: ProviderForm;
  services: ServiceOption[];
  loading: boolean;
  onClose: () => void;
  onSubmit: (value: ProviderForm) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const setField = <K extends keyof ProviderForm>(key: K, fieldValue: ProviderForm[K]) =>
    setValue((current) => ({ ...current, [key]: fieldValue }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-surface-elevated p-6 shadow-elegant"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="font-display text-xl text-foreground">
          {value.id ? "Editar credenciado" : "Novo credenciado"}
        </h2>
        <form
          className="mt-5 grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(value);
          }}
        >
          <Field
            className="sm:col-span-2"
            label="Nome"
            value={value.name}
            onChange={(event) => setField("name", event.target.value)}
            required
          />
          <Field
            label="Especialidade"
            value={value.specialty}
            onChange={(event) => setField("specialty", event.target.value)}
          />
          <Field
            label="Documento"
            value={value.document}
            onChange={(event) => setField("document", event.target.value)}
          />
          <Field
            label="E-mail"
            type="email"
            value={value.email}
            onChange={(event) => setField("email", event.target.value)}
          />
          <Field
            label="Telefone"
            value={value.phone}
            onChange={(event) => setField("phone", event.target.value)}
          />
          <Field
            className="sm:col-span-2"
            label="Endereço"
            value={value.address}
            onChange={(event) => setField("address", event.target.value)}
          />
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
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-foreground">Serviços vinculados</span>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {services.map((service) => (
                <label
                  key={service.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={value.service_ids.includes(service.id)}
                    onChange={(event) => {
                      setField(
                        "service_ids",
                        event.target.checked
                          ? [...value.service_ids, service.id]
                          : value.service_ids.filter((id) => id !== service.id),
                      );
                    }}
                  />
                  {service.name}
                </label>
              ))}
            </div>
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={value.active}
              onChange={(event) => setField("active", event.target.checked)}
            />
            Credenciado ativo
          </label>
          <Field
            className="sm:col-span-2"
            label="Observações"
            value={value.notes}
            onChange={(event) => setField("notes", event.target.value)}
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
              {loading ? "Salvando..." : "Salvar"}
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

function providerServices(provider: Provider) {
  return (provider.provider_services ?? [])
    .map((item) => (Array.isArray(item.services) ? item.services[0] : item.services))
    .filter(Boolean) as ServiceOption[];
}

function toForm(provider: Provider): ProviderForm {
  return {
    id: provider.id,
    name: provider.name,
    specialty: provider.specialty ?? "",
    document: provider.document ?? "",
    email: provider.email ?? "",
    phone: provider.phone ?? "",
    address: provider.address ?? "",
    city: provider.city ?? "",
    state: provider.state ?? "",
    notes: provider.notes ?? "",
    active: provider.active,
    service_ids: (provider.provider_services ?? []).map((service) => service.service_id),
  };
}
