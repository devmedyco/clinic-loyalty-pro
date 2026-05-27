import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileText } from "lucide-react";
import { toast } from "sonner";
import { Card, PageHeader } from "@/components/portal/Shell";
import { useRequireSession } from "@/hooks/use-auth-session";
import { acceptLegalDocument, getPatientLegalStatus } from "@/lib/legal.functions";

export const Route = createFileRoute("/patient/terms")({
  component: PatientTermsPage,
});

function PatientTermsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchStatus = useServerFn(getPatientLegalStatus);
  const acceptDocument = useServerFn(acceptLegalDocument);
  const session = useRequireSession();
  const { data, isLoading, error } = useQuery({
    queryKey: ["patient-legal-status", session.userId],
    queryFn: () => fetchStatus(),
    enabled: session.isAuthenticated && Boolean(session.userId),
  });

  const mutation = useMutation({
    mutationFn: (documentId: string) => acceptDocument({ data: { document_id: documentId } }),
    onSuccess: async () => {
      toast.success("Termo aceito com sucesso");
      await queryClient.invalidateQueries({ queryKey: ["patient-legal-status"] });
      await queryClient.invalidateQueries({ queryKey: ["patient-portal"] });
      await queryClient.invalidateQueries({ queryKey: ["patient-portal-shell"] });
      await queryClient.invalidateQueries({ queryKey: ["patient-subscription"] });
      if ((data?.pending ?? []).length <= 1) {
        navigate({ to: "/patient/subscription" });
      }
    },
    onError: (err) => toast.error((err as Error).message),
  });

  return (
    <>
      <PageHeader
        title="Termos e aceite"
        subtitle="Documentos necessários para uso do cartão de benefícios."
        action={
          data?.patient && data.pending.length === 0 ? (
            <Link
              to="/patient/subscription"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              Ver assinatura
            </Link>
          ) : undefined
        }
      />

      {isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground">Carregando termos...</Card>
      ) : error ? (
        <Card className="p-6 text-sm text-destructive">{(error as Error).message}</Card>
      ) : !data?.patient ? (
        <Card className="p-8 text-sm text-muted-foreground">
          Seu cadastro de paciente ainda não foi vinculado a uma clínica.
        </Card>
      ) : (data.documents ?? []).length === 0 ? (
        <Card className="p-8 text-sm text-muted-foreground">
          Nenhum termo obrigatório publicado no momento. Você já pode acompanhar sua assinatura e
          pagamentos.
          <div className="mt-4">
            <Link
              to="/patient/subscription"
              className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              Ver assinatura
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-5">
          {data.documents.map((document) => {
            const accepted = !data.pending.some((pending) => pending.id === document.id);
            return (
              <Card key={document.id} className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
                      {accepted ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <FileText className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <h2 className="font-display text-xl text-foreground">{document.title}</h2>
                      <div className="text-xs text-muted-foreground">Versão {document.version}</div>
                    </div>
                  </div>
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs ${
                      accepted ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                    }`}
                  >
                    {accepted ? "Aceito" : "Pendente"}
                  </span>
                </div>
                <div className="max-h-[420px] overflow-auto whitespace-pre-wrap px-5 py-5 text-sm leading-7 text-muted-foreground">
                  {document.content}
                </div>
                {!accepted && (
                  <div className="border-t border-border bg-surface px-5 py-4">
                    <button
                      disabled={mutation.isPending}
                      onClick={() => mutation.mutate(document.id)}
                      className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                    >
                      {mutation.isPending ? "Registrando..." : "Li e aceito este termo"}
                    </button>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Seu aceite ficará registrado com data, usuário e versão do documento.
                    </p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
