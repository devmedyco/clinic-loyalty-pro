import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase-ext/client";
import { acceptStaffInvitation } from "@/lib/staff.functions";

export const Route = createFileRoute("/invite/$token")({
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const acceptInvite = useServerFn(acceptStaffInvitation);
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

  const mutation = useMutation({
    mutationFn: () => acceptInvite({ data: { token } }),
    onSuccess: (result) => {
      const slug = result.tenant?.slug;
      if (slug) navigate({ to: `/app/${slug}` as never });
    },
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-6">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-elegant">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand">
          {mutation.isSuccess ? (
            <CheckCircle2 className="h-6 w-6" />
          ) : (
            <KeyRound className="h-6 w-6" />
          )}
        </div>
        <h1 className="mt-5 font-display text-3xl tracking-tight text-foreground">
          Convite Medyco
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Para aceitar, entre com o mesmo e-mail que recebeu o convite. Depois disso, o acesso à
          clínica será liberado automaticamente.
        </p>

        {sessionState === "loading" ? (
          <div className="mt-6 text-sm text-muted-foreground">Verificando sessão...</div>
        ) : sessionState !== "authenticated" ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link
              to="/login"
              search={{ redirect: `/invite/${token}` } as never}
              className="rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              Entrar
            </Link>
            <Link
              to="/signup"
              search={{ redirect: `/invite/${token}` } as never}
              className="rounded-lg border border-border px-4 py-2.5 text-center text-sm font-medium text-foreground transition hover:bg-accent"
            >
              Criar conta
            </Link>
          </div>
        ) : (
          <div className="mt-6">
            {mutation.error && (
              <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {(mutation.error as Error).message}
              </div>
            )}
            {mutation.isSuccess ? (
              <div className="rounded-lg border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">
                Convite aceito. Redirecionando...
              </div>
            ) : (
              <button
                disabled={mutation.isPending}
                onClick={() => mutation.mutate()}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
              >
                {mutation.isPending ? "Aceitando..." : "Aceitar convite"}
              </button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
