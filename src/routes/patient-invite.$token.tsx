import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CreditCard, LockKeyhole } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase-ext/client";
import {
  acceptPatientInvitation,
  completePatientInvitation,
  getPatientInvitationPreview,
} from "@/lib/patients.functions";

export const Route = createFileRoute("/patient-invite/$token")({
  component: PatientInvitePage,
});

function PatientInvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const completeInvite = useServerFn(completePatientInvitation);
  const acceptInvite = useServerFn(acceptPatientInvitation);
  const fetchPreview = useServerFn(getPatientInvitationPreview);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  const { data: preview, isLoading: previewLoading } = useQuery({
    queryKey: ["patient-invite-preview", token],
    queryFn: () => fetchPreview({ data: { token } }),
  });
  const sessionMismatch =
    authenticated &&
    sessionEmail &&
    preview?.email &&
    sessionEmail.toLowerCase() !== preview.email.toLowerCase();

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setAuthenticated(Boolean(data.session));
        setSessionEmail(data.session?.user.email ?? null);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const mutation = useMutation({
    mutationFn: async () => {
      if (password.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");
      if (password !== confirmation) throw new Error("As senhas não conferem.");

      const result = await completeInvite({ data: { token, password } });
      const { error } = await supabase.auth.signInWithPassword({
        email: result.email,
        password,
      });
      if (error) throw new Error(error.message);
      queryClient.clear();
      return result;
    },
    onSuccess: () => navigate({ to: "/patient/terms" }),
  });

  const acceptExistingMutation = useMutation({
    mutationFn: () => acceptInvite({ data: { token } }),
    onSuccess: () => {
      queryClient.clear();
      navigate({ to: "/patient/terms" });
    },
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-6">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-elegant">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand">
          {mutation.isSuccess ? (
            <CheckCircle2 className="h-6 w-6" />
          ) : (
            <CreditCard className="h-6 w-6" />
          )}
        </div>
        <h1 className="mt-5 font-display text-3xl tracking-tight text-foreground">
          Ative seu cartão de benefícios
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Seu cadastro já foi iniciado pela clínica. Esta tela é exclusiva para o e-mail convidado:
          confira os dados abaixo, crie sua senha e siga para os termos.
        </p>

        <div className="mt-5 rounded-xl border border-border bg-surface p-4">
          {previewLoading ? (
            <div className="text-sm text-muted-foreground">Carregando convite...</div>
          ) : !preview?.found ? (
            <div className="text-sm text-destructive">
              Convite não encontrado. Peça para a clínica reenviar o acesso.
            </div>
          ) : preview.expired ? (
            <div className="text-sm text-destructive">
              Este convite expirou. Peça para a clínica reenviar o acesso do cartão.
            </div>
          ) : (
            <div className="space-y-3">
              {preview.alreadyLinked && (
                <div className="rounded-lg border border-success/20 bg-success/10 px-3 py-2 text-sm text-success">
                  Este convite já está vinculado a um acesso de paciente. Entre com o e-mail abaixo
                  para continuar.
                </div>
              )}
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Programa
                </div>
                <div className="mt-1 font-medium text-foreground">
                  {preview.tenant?.name ?? "Clínica"}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Info label="Paciente" value={preview.patientName ?? "Paciente"} />
                <Info label="E-mail do convite" value={preview.email ?? "e-mail cadastrado"} />
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 grid gap-2 text-sm text-foreground">
          {["Criar sua senha", "Aceitar o termo de uso", "Pagar a primeira cobrança"].map(
            (step, index) => (
              <div key={step} className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-soft text-xs font-medium text-brand">
                  {index + 1}
                </span>
                {step}
              </div>
            ),
          )}
        </div>

        {authenticated ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
              Este navegador já tem uma conta aberta
              {sessionEmail ? (
                <>
                  {" "}
                  como <strong className="text-foreground">{sessionEmail}</strong>
                </>
              ) : null}
              . Use este caminho apenas se for o mesmo e-mail do convite. Caso contrário, saia e
              crie a senha correta do paciente.
            </div>
            {sessionMismatch && (
              <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
                A conta aberta é {sessionEmail}, mas este convite é para {preview.email}. Saia desta
                conta para criar a senha do paciente correto.
              </div>
            )}
            {acceptExistingMutation.error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {(acceptExistingMutation.error as Error).message}
              </div>
            )}
            <button
              disabled={acceptExistingMutation.isPending || Boolean(sessionMismatch)}
              onClick={() => acceptExistingMutation.mutate()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" />
              {acceptExistingMutation.isPending ? "Ativando vínculo..." : "Usar esta conta"}
            </button>
            <button
              type="button"
              onClick={() => {
                queryClient.clear();
                supabase.auth.signOut().then(() => {
                  setAuthenticated(false);
                  setSessionEmail(null);
                });
              }}
              className="inline-flex w-full items-center justify-center rounded-lg border border-input px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-accent"
            >
              Sair e criar senha do convite
            </button>
          </div>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setLocalError(null);
              mutation.mutate();
            }}
          >
            <Field
              label="Senha"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
            />
            <Field
              label="Confirmar senha"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="new-password"
            />

            {(localError || mutation.error) && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {localError || (mutation.error as Error).message}
                {(mutation.error as Error | null)?.message?.includes("já possui acesso") && (
                  <Link
                    to="/login"
                    search={{ redirect: `/patient-invite/${token}`, portal: "patient" } as never}
                    className="mt-3 inline-flex rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-medium"
                  >
                    Entrar com minha senha
                  </Link>
                )}
              </div>
            )}

            {mutation.isSuccess ? (
              <div className="rounded-lg border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">
                Senha criada. Redirecionando para os termos...
              </div>
            ) : (
              <button
                disabled={
                  mutation.isPending || previewLoading || !preview?.found || preview.expired
                }
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
              >
                <LockKeyhole className="h-4 w-4" />
                {mutation.isPending ? "Criando acesso..." : "Criar senha e entrar"}
              </button>
            )}
          </form>
        )}
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-foreground">{value}</div>
    </div>
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
        type="password"
        minLength={6}
        required
        className="mt-1.5 block w-full rounded-lg border border-input bg-surface-elevated px-3 py-2.5 text-sm text-foreground shadow-soft outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
    </label>
  );
}
