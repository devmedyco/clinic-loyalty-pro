import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Card, PageHeader } from "@/components/portal/Shell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  createService,
  deleteService,
  listServices,
  updateService,
} from "@/lib/services.functions";

export const Route = createFileRoute("/app/$tenant/services")({
  component: ServicesPage,
});

type Service = {
  id: string;
  name: string;
  description: string | null;
  original_price: number | string;
  discount_percentage: number | string;
  final_price: number | string;
  active: boolean;
};

type ServiceFormState = {
  id?: string;
  name: string;
  description: string;
  original_price: string;
  discount_percentage: string;
  active: boolean;
};

const emptyService: ServiceFormState = {
  name: "",
  description: "",
  original_price: "",
  discount_percentage: "0",
  active: true,
};

function ServicesPage() {
  const { tenant } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchServices = useServerFn(listServices);
  const create = useServerFn(createService);
  const update = useServerFn(updateService);
  const remove = useServerFn(deleteService);
  const [form, setForm] = useState<ServiceFormState | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["services", tenant],
    queryFn: () => fetchServices({ data: { tenant } }),
  });

  const saveMutation = useMutation({
    mutationFn: async (value: ServiceFormState) => {
      const payload = {
        tenant,
        name: value.name,
        description: value.description,
        original_price: Number(value.original_price),
        discount_percentage: Number(value.discount_percentage),
        active: value.active,
      };

      if (value.id) return update({ data: { ...payload, id: value.id } });
      return create({ data: payload });
    },
    onSuccess: async () => {
      toast.success(form?.id ? "Serviço atualizado" : "Serviço criado");
      setForm(null);
      await queryClient.invalidateQueries({ queryKey: ["services", tenant] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { tenant, id } }),
    onSuccess: async () => {
      toast.success("Serviço removido");
      await queryClient.invalidateQueries({ queryKey: ["services", tenant] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const services = (data?.services ?? []) as Service[];

  return (
    <>
      <PageHeader
        title="Serviços"
        subtitle="Configure os procedimentos, preços e descontos do programa."
        action={
          <button
            onClick={() => setForm(emptyService)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Novo serviço
          </button>
        }
      />

      {form && (
        <ServiceModal
          initialValue={form}
          loading={saveMutation.isPending}
          onClose={() => setForm(null)}
          onSubmit={(value) => saveMutation.mutate(value)}
        />
      )}

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="px-5 py-10 text-sm text-muted-foreground">Carregando serviços...</div>
        ) : error ? (
          <div className="px-5 py-10 text-sm text-destructive">{(error as Error).message}</div>
        ) : services.length === 0 ? (
          <div className="px-5 py-14 text-center text-sm text-muted-foreground">
            Nenhum serviço cadastrado. Crie o primeiro para usar na execução de atendimento.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Serviço</th>
                  <th className="px-5 py-3">Preço original</th>
                  <th className="px-5 py-3">Desconto</th>
                  <th className="px-5 py-3">Preço final</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service) => (
                  <tr key={service.id} className="border-t border-border">
                    <td className="px-5 py-4">
                      <div className="font-medium text-foreground">{service.name}</div>
                      <div className="max-w-md truncate text-xs text-muted-foreground">
                        {service.description || "Sem descrição"}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {formatCurrency(service.original_price)}
                    </td>
                    <td className="px-5 py-4">{formatPercent(service.discount_percentage)}</td>
                    <td className="px-5 py-4 font-medium text-foreground">
                      {formatCurrency(service.final_price)}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge active={service.active} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setForm(toFormState(service))}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              disabled={deleteMutation.isPending}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive transition hover:bg-destructive/10 disabled:opacity-60"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Remover
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="border-border bg-surface-elevated">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover serviço?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Isso remove {service.name} da lista de procedimentos disponíveis
                                para novos atendimentos e para a rede credenciada.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(service.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Remover serviço
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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

function ServiceModal({
  initialValue,
  loading,
  onClose,
  onSubmit,
}: {
  initialValue: ServiceFormState;
  loading: boolean;
  onClose: () => void;
  onSubmit: (value: ServiceFormState) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const finalPrice = calculatePreview(value.original_price, value.discount_percentage);

  function setField<K extends keyof ServiceFormState>(key: K, fieldValue: ServiceFormState[K]) {
    setValue((current) => ({ ...current, [key]: fieldValue }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-xl rounded-xl border border-border bg-surface-elevated p-6 shadow-elegant"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="font-display text-xl text-foreground">
          {value.id ? "Editar serviço" : "Novo serviço"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          O preço final é calculado automaticamente a partir do desconto.
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
            label="Nome"
            value={value.name}
            onChange={(event) => setField("name", event.target.value)}
            placeholder="Consulta clínica geral"
            required
          />
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-foreground">Descrição</span>
            <textarea
              value={value.description}
              onChange={(event) => setField("description", event.target.value)}
              placeholder="Opcional"
              rows={3}
              className="mt-1.5 block w-full resize-none rounded-lg border border-input bg-surface-elevated px-3 py-2.5 text-sm text-foreground shadow-soft outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </label>
          <Field
            label="Preço original"
            type="number"
            min="0"
            step="0.01"
            value={value.original_price}
            onChange={(event) => setField("original_price", event.target.value)}
            required
          />
          <Field
            label="Desconto (%)"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={value.discount_percentage}
            onChange={(event) => setField("discount_percentage", event.target.value)}
            required
          />
          <div className="rounded-xl border border-border bg-surface p-4 sm:col-span-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Preço final
            </div>
            <div className="mt-1 font-display text-2xl text-foreground">
              {formatCurrency(finalPrice)}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2">
            <input
              type="checkbox"
              checked={value.active}
              onChange={(event) => setField("active", event.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Serviço ativo
          </label>
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
              {loading ? "Salvando..." : "Salvar serviço"}
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

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-xs ${
        active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
      }`}
    >
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}

function toFormState(service: Service): ServiceFormState {
  return {
    id: service.id,
    name: service.name,
    description: service.description ?? "",
    original_price: String(service.original_price),
    discount_percentage: String(service.discount_percentage),
    active: service.active,
  };
}

function calculatePreview(originalPrice: string, discountPercentage: string) {
  const original = Number(originalPrice || 0);
  const discount = Number(discountPercentage || 0);
  return Math.max(0, Math.round((original - original * (discount / 100)) * 100) / 100);
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
