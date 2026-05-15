import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, PageHeader, StatCard } from "@/components/portal/Shell";
import { getTenantLegalCenter, publishTenantLegalDocument } from "@/lib/legal.functions";

export const Route = createFileRoute("/app/$tenant/contracts")({
  component: TenantContractsPage,
});

type LegalDocument = {
  id: string;
  tenant_id: string | null;
  title: string;
  version: string;
  content: string;
  active: boolean;
  created_at?: string;
};

type Acceptance = {
  id: string;
  accepted_at: string;
  patients?: { full_name: string; email: string | null } | null;
  legal_documents?: { title: string; version: string } | null;
};

function TenantContractsPage() {
  const { tenant } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchLegalCenter = useServerFn(getTenantLegalCenter);
  const publishDocument = useServerFn(publishTenantLegalDocument);
  const [form, setForm] = useState({
    title: "Termo de Uso do Cartão de Benefícios",
    version: defaultVersion(),
    content: "",
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["tenant-contracts", tenant],
    queryFn: () => fetchLegalCenter({ data: { tenant } }),
  });

  useEffect(() => {
    const source = data?.activeTenantDocument ?? data?.activePlatformDocument;
    if (!source) return;
    setForm({
      title: source.title,
      version: defaultVersion(),
      content: source.content,
    });
  }, [data?.activePlatformDocument, data?.activeTenantDocument]);

  const mutation = useMutation({
    mutationFn: () => publishDocument({ data: { tenant, ...form } }),
    onSuccess: async () => {
      toast.success("Nova versão publicada. Pacientes precisarão aceitar novamente.");
      await queryClient.invalidateQueries({ queryKey: ["tenant-contracts", tenant] });
      await queryClient.invalidateQueries({ queryKey: ["patient-legal-status"] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const activeDocument = data?.activeTenantDocument as LegalDocument | null | undefined;
  const platformDocument = data?.activePlatformDocument as LegalDocument | null | undefined;
  const documents = (data?.documents ?? []) as LegalDocument[];
  const acceptances = (data?.acceptances ?? []) as Acceptance[];
  const tenantDocuments = documents.filter((document) => document.tenant_id);

  return (
    <>
      <PageHeader
        title="Contratos e termos"
        subtitle="Publique o termo que o paciente precisa aceitar para usar o cartão."
      />

      {error && (
        <Card className="mb-5 p-6 text-sm text-destructive">{(error as Error).message}</Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Termo em vigor"
          value={activeDocument ? "Próprio" : platformDocument ? "Padrão" : "Ausente"}
          delta={activeDocument?.version ?? platformDocument?.version ?? "sem versão ativa"}
        />
        <StatCard
          label="Versões da clínica"
          value={String(tenantDocuments.length)}
          delta="histórico"
        />
        <StatCard
          label="Aceites recentes"
          value={String(acceptances.length)}
          delta="últimos registros"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-xl text-foreground">Publicar nova versão</h2>
              <p className="text-sm text-muted-foreground">
                Ao publicar, o termo anterior da clínica é arquivado.
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="mt-6 text-sm text-muted-foreground">Carregando termo...</div>
          ) : (
            <form
              className="mt-6 grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                mutation.mutate();
              }}
            >
              <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
                <Field
                  label="Título"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  required
                />
                <Field
                  label="Versão"
                  value={form.version}
                  onChange={(event) => setForm({ ...form, version: event.target.value })}
                  required
                />
              </div>
              <label className="block">
                <span className="text-xs font-medium text-foreground">Conteúdo do termo</span>
                <textarea
                  value={form.content}
                  onChange={(event) => setForm({ ...form, content: event.target.value })}
                  rows={18}
                  minLength={120}
                  className="mt-1.5 block w-full resize-y rounded-lg border border-input bg-surface-elevated px-3 py-2.5 text-sm leading-7 text-foreground shadow-soft outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  required
                />
              </label>
              <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
                Este modelo ajuda a operação, mas deve ser revisado por advogado antes do uso
                comercial amplo.
              </div>
              <div className="flex justify-end">
                <button
                  disabled={mutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                >
                  <ShieldCheck className="h-4 w-4" />
                  {mutation.isPending ? "Publicando..." : "Publicar nova versão"}
                </button>
              </div>
            </form>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <h2 className="font-display text-xl text-foreground">Versões publicadas</h2>
            </div>
            {tenantDocuments.length === 0 ? (
              <div className="px-5 py-8 text-sm text-muted-foreground">
                A clínica ainda usa o termo padrão da Medyco.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {tenantDocuments.map((document) => (
                  <div key={document.id} className="px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-foreground">{document.title}</div>
                        <div className="text-xs text-muted-foreground">
                          Versão {document.version}
                        </div>
                      </div>
                      <StatusBadge active={document.active} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <h2 className="font-display text-xl text-foreground">Aceites recentes</h2>
            </div>
            {acceptances.length === 0 ? (
              <div className="px-5 py-8 text-sm text-muted-foreground">
                Nenhum aceite registrado ainda.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {acceptances.map((acceptance) => (
                  <div key={acceptance.id} className="px-5 py-4">
                    <div className="font-medium text-foreground">
                      {acceptance.patients?.full_name ?? "Paciente"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {acceptance.legal_documents?.version ?? "versão"} -{" "}
                      {formatDate(acceptance.accepted_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
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
      {active ? "Em vigor" : "Arquivado"}
    </span>
  );
}

function defaultVersion() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(value));
}
