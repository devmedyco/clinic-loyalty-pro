import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, CreditCard } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase-ext/client";
import { acceptPatientInvitation } from "@/lib/patients.functions";

export const Route = createFileRoute("/patient-invite/$token")({
  component: PatientInvitePage,
});

function PatientInvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const acceptInvite = useServerFn(acceptPatientInvitation);
  const [sessionState, setSessionState] = useState<"loading" | "authenticated" | "anonymous">(
    "loading",
  );

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSessionState(data.session ? "authenticated" : "anonymous");
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setSessionState(session ? "authenticated" : "anonymous");
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const { error, isPending, isSuccess, mutate, status } = useMutation({
    mutationFn: () => acceptInvite({ data: { token } }),
    onSuccess: () => navigate({ to: "/patient" }),
  });

  useEffect(() => {
    if (sessionState === "authenticated" && status === "idle") mutate();
  }, [mutate, sessionState, status]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-6">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-elegant">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand">
          {isSuccess ? <CheckCircle2 className="h-6 w-6" /> : <CreditCard className="h-6 w-6" />}
        </div>
        <h1 className="mt-5 font-display text-3xl tracking-tight text-foreground">
          Acesso ao cartão digital
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Entre ou crie uma senha com o mesmo e-mail que recebeu o convite. Depois disso, seu cartão
          ficará disponível no portal do paciente.
        </p>

        {sessionState === "loading" ? (
          <div className="mt-6 text-sm text-muted-foreground">Verificando sessão...</div>
        ) : sessionState !== "authenticated" ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link
              to="/login"
              search={{ redirect: `/patient-invite/${token}`, portal: "patient" } as never}
              className="rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              Entrar
            </Link>
            <Link
              to="/signup"
              search={{ redirect: `/patient-invite/${token}`, portal: "patient" } as never}
              className="rounded-lg border border-border px-4 py-2.5 text-center text-sm font-medium text-foreground transition hover:bg-accent"
            >
              Criar senha
            </Link>
          </div>
        ) : (
          <div className="mt-6">
            {error && (
              <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {(error as Error).message}
              </div>
            )}
            {isSuccess ? (
              <div className="rounded-lg border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">
                Acesso liberado. Redirecionando...
              </div>
            ) : (
              <button
                disabled={isPending}
                onClick={() => mutate()}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
              >
                {isPending ? "Liberando acesso..." : "Liberar meu cartão"}
              </button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
