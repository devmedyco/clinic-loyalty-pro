import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Clock } from "lucide-react";
import { toast } from "sonner";
import { Card, PageHeader, StatCard } from "@/components/portal/Shell";
import {
  listAdminNotifications,
  queuePaymentReminderNotifications,
} from "@/lib/notifications.functions";

export const Route = createFileRoute("/admin/notifications")({
  component: AdminNotificationsPage,
});

function AdminNotificationsPage() {
  const queryClient = useQueryClient();
  const fetchNotifications = useServerFn(listAdminNotifications);
  const queueReminders = useServerFn(queuePaymentReminderNotifications);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: () => fetchNotifications(),
  });

  const mutation = useMutation({
    mutationFn: () => queueReminders({ data: { daysAhead: 5 } }),
    onSuccess: async (result) => {
      toast.success(`${result.created} lembrete(s) gerados`);
      await queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const notifications = data?.notifications ?? [];

  return (
    <>
      <PageHeader
        title="Notificações"
        subtitle="Central administrativa para acompanhar avisos e lembretes operacionais."
        action={
          <button
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            <Clock className="h-4 w-4" />
            {mutation.isPending ? "Gerando..." : "Gerar lembretes financeiros"}
          </button>
        }
      />

      {error && (
        <Card className="mb-5 p-6 text-sm text-destructive">{(error as Error).message}</Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total" value={isLoading ? "..." : String(notifications.length)} />
        <StatCard
          label="Não lidas"
          value={
            isLoading
              ? "..."
              : String(notifications.filter((item) => item.status === "unread").length)
          }
        />
        <StatCard
          label="Fila"
          value={
            isLoading
              ? "..."
              : String(notifications.filter((item) => item.status === "queued").length)
          }
        />
      </div>

      <Card className="mt-6 overflow-hidden">
        {isLoading ? (
          <div className="px-5 py-10 text-sm text-muted-foreground">Carregando notificações...</div>
        ) : notifications.length === 0 ? (
          <div className="px-5 py-14 text-center text-sm text-muted-foreground">
            Nenhuma notificação registrada ainda.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className="flex flex-col gap-3 px-5 py-4 text-sm md:flex-row md:items-start md:justify-between"
              >
                <div className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                    <Bell className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="font-medium text-foreground">{notification.title}</div>
                    <div className="mt-1 text-muted-foreground">{notification.body}</div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {relationName(notification.tenants, "name") ?? "Medyco"} ·{" "}
                      {relationName(notification.patients, "full_name") ?? "sem paciente"}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground md:text-right">
                  <div>{notification.status}</div>
                  <div>{formatDateTime(notification.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

function relationName(value: unknown, key: string) {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return null;
  return String((row as Record<string, unknown>)[key] ?? "");
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(value),
  );
}
