import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, MailPlus, ShieldCheck, UserRoundCheck, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Card, PageHeader } from "@/components/portal/Shell";
import { createStaffInvitation, listStaff, revokeStaffInvitation } from "@/lib/staff.functions";

export const Route = createFileRoute("/app/$tenant/staff")({
  component: StaffPage,
});

type StaffRole = "tenant_admin" | "tenant_staff";

type InvitationResult = {
  inviteUrl: string;
  emailResult: { sent: true } | { sent: false; reason: string; error?: string };
};

function StaffPage() {
  const { tenant } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchStaff = useServerFn(listStaff);
  const inviteStaff = useServerFn(createStaffInvitation);
  const revokeInvite = useServerFn(revokeStaffInvitation);
  const [modalOpen, setModalOpen] = useState(false);
  const [lastInvite, setLastInvite] = useState<InvitationResult | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["staff", tenant],
    queryFn: () => fetchStaff({ data: { tenant } }),
  });

  const inviteMutation = useMutation({
    mutationFn: (input: { email: string; role: StaffRole }) =>
      inviteStaff({ data: { tenant, ...input } }),
    onSuccess: async (result) => {
      setLastInvite(result as InvitationResult);
      toast.success(result.emailResult.sent ? "Convite enviado por e-mail" : "Convite criado", {
        description: result.emailResult.sent
          ? "O funcionário recebeu o link para aceitar."
          : "Configure o Resend para disparar automaticamente. O link manual está disponível.",
      });
      await queryClient.invalidateQueries({ queryKey: ["staff", tenant] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeInvite({ data: { tenant, id } }),
    onSuccess: async () => {
      toast.success("Convite revogado");
      await queryClient.invalidateQueries({ queryKey: ["staff", tenant] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const members = data?.members ?? [];
  const invitations = data?.invitations ?? [];

  return (
    <>
      <PageHeader
        title="Funcionários"
        subtitle="Convide e acompanhe os acessos operacionais da clínica."
        action={
          <button
            onClick={() => {
              setLastInvite(null);
              setModalOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            <MailPlus className="h-4 w-4" />
            Convidar funcionário
          </button>
        }
      />

      {modalOpen && (
        <InviteModal
          lastInvite={lastInvite}
          loading={inviteMutation.isPending}
          onClose={() => setModalOpen(false)}
          onSubmit={(input) => inviteMutation.mutate(input)}
        />
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-display text-xl text-foreground">Membros ativos</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Usuários com acesso liberado para este tenant.
            </p>
          </div>
          {isLoading ? (
            <StateText>Carregando funcionários...</StateText>
          ) : error ? (
            <StateText tone="danger">{(error as Error).message}</StateText>
          ) : members.length === 0 ? (
            <StateText>Nenhum funcionário ativo encontrado.</StateText>
          ) : (
            <div className="divide-y divide-border">
              {members.map((member) => (
                <div key={member.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
                    <UserRoundCheck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">
                      {member.profile?.full_name || member.profile?.email || member.user_id}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {member.profile?.email ? `${member.profile.email} • ` : ""}Desde{" "}
                      {formatDate(member.created_at)}
                    </div>
                  </div>
                  <RoleBadge role={member.role as StaffRole} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-display text-xl text-foreground">Convites</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Links enviados ou gerados para novos membros.
            </p>
          </div>
          {isLoading ? (
            <StateText>Carregando convites...</StateText>
          ) : invitations.length === 0 ? (
            <StateText>Nenhum convite criado ainda.</StateText>
          ) : (
            <div className="divide-y divide-border">
              {invitations.map((invite) => (
                <div key={invite.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        {invite.email}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>{roleLabel(invite.role as StaffRole)}</span>
                        <span>Expira {formatDate(invite.expires_at)}</span>
                      </div>
                    </div>
                    <StatusBadge status={invite.status} />
                  </div>
                  {invite.status === "pending" && (
                    <button
                      disabled={revokeMutation.isPending}
                      onClick={() => revokeMutation.mutate(invite.id)}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive transition hover:bg-destructive/10 disabled:opacity-60"
                    >
                      <X className="h-3.5 w-3.5" />
                      Revogar
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function InviteModal({
  lastInvite,
  loading,
  onClose,
  onSubmit,
}: {
  lastInvite: InvitationResult | null;
  loading: boolean;
  onClose: () => void;
  onSubmit: (input: { email: string; role: StaffRole }) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("tenant_staff");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-border bg-surface-elevated p-6 shadow-elegant"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="font-display text-xl text-foreground">Convidar funcionário</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          O convidado precisa entrar com o mesmo e-mail para aceitar o acesso.
        </p>

        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit({ email, role });
          }}
        >
          <label className="block">
            <span className="text-xs font-medium text-foreground">E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="recepcao@clinica.com.br"
              required
              className="mt-1.5 block w-full rounded-lg border border-input bg-surface-elevated px-3 py-2.5 text-sm text-foreground shadow-soft outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-foreground">Perfil</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as StaffRole)}
              className="mt-1.5 block w-full rounded-lg border border-input bg-surface-elevated px-3 py-2.5 text-sm text-foreground shadow-soft outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <option value="tenant_staff">Funcionário</option>
              <option value="tenant_admin">Administrador da clínica</option>
            </select>
          </label>

          {lastInvite && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ShieldCheck className="h-4 w-4 text-success" />
                Link de convite criado
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {lastInvite.emailResult.sent
                  ? "O e-mail foi disparado pelo Resend."
                  : "Resend ainda não está configurado. Use este link manual por enquanto."}
              </p>
              <button
                type="button"
                onClick={() => copyInvite(lastInvite.inviteUrl)}
                className="mt-3 inline-flex max-w-full items-center gap-2 rounded-lg border border-input px-3 py-2 text-xs font-medium text-foreground transition hover:bg-accent"
              >
                <Copy className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{lastInvite.inviteUrl}</span>
              </button>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface"
            >
              Fechar
            </button>
            <button
              disabled={loading}
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Enviando..." : "Enviar convite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StateText({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "danger";
}) {
  return (
    <div
      className={`px-5 py-10 text-sm ${tone === "danger" ? "text-destructive" : "text-muted-foreground"}`}
    >
      {children}
    </div>
  );
}

function RoleBadge({ role }: { role: StaffRole }) {
  return (
    <span className="rounded-md bg-brand-soft px-2 py-0.5 text-xs text-brand">
      {roleLabel(role)}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "pending"
      ? "bg-warning/15 text-warning"
      : status === "accepted"
        ? "bg-success/15 text-success"
        : "bg-muted text-muted-foreground";
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs ${className}`}>{statusLabel(status)}</span>
  );
}

function roleLabel(role: StaffRole) {
  return role === "tenant_admin" ? "Admin" : "Funcionário";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "Pendente",
    accepted: "Aceito",
    revoked: "Revogado",
    expired: "Expirado",
  };
  return labels[status] ?? status;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function copyInvite(url: string) {
  navigator.clipboard
    .writeText(url)
    .then(() => toast.success("Link copiado"))
    .catch(() => toast.error("Não foi possível copiar o link"));
}
