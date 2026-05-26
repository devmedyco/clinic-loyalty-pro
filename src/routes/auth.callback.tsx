import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase-ext/client";
import { getPostAuthRoute, getPostLoginRoute } from "@/lib/access-routing";
import { getMyAccess } from "@/lib/auth.functions";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const [message, setMessage] = useState("Finalizando autenticação...");
  const fetchAccess = useServerFn(getMyAccess);

  useEffect(() => {
    async function finishAuth() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const errorDescription =
        url.searchParams.get("error_description") || url.searchParams.get("error");
      const rawNext = url.searchParams.get("next");

      if (errorDescription) {
        setMessage(errorDescription);
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMessage(error.message);
          return;
        }
      } else if (window.location.hash) {
        await supabase.auth.getSession();
      }

      const safeNext = getSafeNext(rawNext);
      if (safeNext && isAuthFlowNext(safeNext)) {
        window.location.replace(safeNext);
        return;
      }

      const access = await fetchAccess();
      window.location.replace(
        rawNext === "auto" ? getPostLoginRoute(access) : getPostAuthRoute(access, safeNext),
      );
    }

    finishAuth().catch((error) => {
      setMessage(error instanceof Error ? error.message : "Não foi possível finalizar o acesso.");
    });
  }, [fetchAccess]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-6">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-elegant">
        <div className="mx-auto h-10 w-10 animate-pulse rounded-full bg-brand-soft" />
        <h1 className="mt-5 font-display text-2xl text-foreground">Medyco</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      </section>
    </main>
  );
}

function getSafeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function isAuthFlowNext(value: string) {
  return (
    value === "/reset-password" ||
    value.startsWith("/invite/") ||
    value.startsWith("/patient-invite/")
  );
}
