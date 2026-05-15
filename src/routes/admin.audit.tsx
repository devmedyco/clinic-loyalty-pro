import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, PageHeader } from "@/components/portal/Shell";
import { getAdminAudit } from "@/lib/admin-reports.functions";

export const Route = createFileRoute("/admin/audit")({
  component: AdminAuditPage,
});

function AdminAuditPage() {
  const fetchAudit = useServerFn(getAdminAudit);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-audit"],
    queryFn: () => fetchAudit(),
  });

  return (
    <>
      <PageHeader
        title="Auditoria"
        subtitle="Linha do tempo operacional com eventos importantes da plataforma."
      />
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="px-5 py-10 text-sm text-muted-foreground">Carregando auditoria...</div>
        ) : error ? (
          <div className="px-5 py-10 text-sm text-destructive">{(error as Error).message}</div>
        ) : (data?.events ?? []).length === 0 ? (
          <div className="px-5 py-10 text-sm text-muted-foreground">Nenhum evento registrado.</div>
        ) : (
          <div className="divide-y divide-border">
            {data?.events.map((event) => (
              <div
                key={event.id}
                className="grid gap-3 px-5 py-4 text-sm md:grid-cols-[150px_1fr_160px]"
              >
                <div>
                  <div className="font-medium text-foreground">{event.type}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(event.created_at)}
                  </div>
                </div>
                <div>
                  <div className="font-medium text-foreground">{event.title}</div>
                  <div className="text-xs text-muted-foreground">{event.detail}</div>
                </div>
                <div className="text-xs text-muted-foreground md:text-right">{event.tenant}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
