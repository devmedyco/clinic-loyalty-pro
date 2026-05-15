import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Chrome } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase-ext/client";
import { getPostLoginRoute } from "@/lib/access-routing";
import { getMyAccess } from "@/lib/auth.functions";

export const Route = createFileRoute("/_auth/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const fetchAccess = useServerFn(getMyAccess);
  const copy = getLoginCopy();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    const redirect = getSafeRedirect();
    if (redirect) {
      navigate({ to: redirect as never });
      return;
    }
    const access = await fetchAccess();
    navigate({ to: getPostLoginRoute(access) as never });
  }

  async function onGoogleLogin() {
    setError(null);
    const redirect = getSafeRedirect();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          redirect ?? "auto",
        )}`,
      },
    });
    if (error) setError(error.message);
  }

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight text-foreground">{copy.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{copy.subtitle}</p>
      <button
        type="button"
        onClick={onGoogleLogin}
        className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface-elevated px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-accent"
      >
        <Chrome className="h-4 w-4" />
        Entrar com Google
      </button>
      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        ou
        <span className="h-px flex-1 bg-border" />
      </div>
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field
          label="E-mail"
          type="email"
          placeholder={copy.emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Field
          label="Senha"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button
          disabled={loading}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
      <div className="mt-4 flex items-center justify-between text-sm">
        <Link
          to="/reset-password"
          className="text-muted-foreground hover:text-foreground transition"
        >
          Esqueci a senha
        </Link>
        <Link to="/signup" className="text-foreground hover:text-brand transition">
          {copy.signupLabel}
        </Link>
      </div>
    </div>
  );
}

function getLoginCopy() {
  const portal = getPortalContext();
  const copies = {
    clinic: {
      title: "Entrar na clínica",
      subtitle: "Acesse o painel operacional da sua clínica.",
      emailPlaceholder: "voce@clinica.com.br",
      signupLabel: "Criar conta",
    },
    patient: {
      title: "Entrar no seu cartão",
      subtitle: "Consulte seu benefício, pagamentos e histórico.",
      emailPlaceholder: "voce@email.com",
      signupLabel: "Criar acesso",
    },
    admin: {
      title: "Entrar no Admin",
      subtitle: "Área interna da plataforma Medyco.",
      emailPlaceholder: "admin@medyco.com.br",
      signupLabel: "Criar operador",
    },
  };
  return copies[portal];
}

function getSafeRedirect() {
  if (typeof window === "undefined") return null;
  const redirect = new URLSearchParams(window.location.search).get("redirect");
  if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//")) return null;
  return redirect;
}

function getPortalContext(): "clinic" | "patient" | "admin" {
  if (typeof window === "undefined") return "clinic";
  const params = new URLSearchParams(window.location.search);
  const portal = params.get("portal");
  const redirect = params.get("redirect") ?? "";
  if (portal === "patient" || redirect.startsWith("/patient")) return "patient";
  if (portal === "admin" || redirect.startsWith("/admin")) return "admin";
  return "clinic";
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
