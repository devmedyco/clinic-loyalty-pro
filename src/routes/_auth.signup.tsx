import { Link, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Chrome } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase-ext/client";
import { getPostAuthRoute } from "@/lib/access-routing";
import {
  getAuthLinkSearch,
  getPortalFromAuthSearch,
  getSafeRedirectFromAuthSearch,
} from "@/lib/auth-portal";
import { getMyAccess } from "@/lib/auth.functions";

export const Route = createFileRoute("/_auth/signup")({
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchAccess = useServerFn(getMyAccess);
  const routeSearch = useRouterState({ select: (state) => state.location.search });
  const copy = getSignupCopy(getPortalFromAuthSearch(routeSearch));
  const authSearch = getAuthLinkSearch(routeSearch);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    queryClient.clear();
    const redirect = getSafeRedirectFromAuthSearch(routeSearch);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          redirect ?? "auto",
        )}`,
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (!data.session) {
      setInfo("Verifique seu e-mail para confirmar a conta antes de entrar.");
      return;
    }
    queryClient.clear();
    const access = await fetchAccess();
    navigate({ to: getPostAuthRoute(access, redirect) as never });
  }

  async function onGoogleSignup() {
    setError(null);
    const redirect = getSafeRedirectFromAuthSearch(routeSearch);
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
        onClick={onGoogleSignup}
        className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface-elevated px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-accent"
      >
        <Chrome className="h-4 w-4" />
        Criar conta com Google
      </button>
      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        ou
        <span className="h-px flex-1 bg-border" />
      </div>
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field
          label="Nome completo"
          placeholder={copy.namePlaceholder}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
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
          minLength={6}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        {info && <p className="text-sm text-foreground">{info}</p>}
        <button
          disabled={loading}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Criando..." : "Criar minha conta"}
        </button>
      </form>
      <div className="mt-6 text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link
          to="/login"
          search={authSearch as never}
          className="text-foreground hover:text-brand transition"
        >
          Entrar
        </Link>
      </div>
    </div>
  );
}

function getSignupCopy(portal: "clinic" | "patient" | "admin") {
  const copies = {
    clinic: {
      title: "Criar conta",
      subtitle: "Configure sua plataforma em minutos.",
      namePlaceholder: "Dra. Camila Andrade",
      emailPlaceholder: "voce@clinica.com.br",
    },
    patient: {
      title: "Criar acesso ao cartão",
      subtitle: "Use o mesmo e-mail informado pela clínica.",
      namePlaceholder: "Seu nome completo",
      emailPlaceholder: "voce@email.com",
    },
    admin: {
      title: "Criar operador",
      subtitle: "Cadastro interno para equipe Medyco.",
      namePlaceholder: "Nome do operador",
      emailPlaceholder: "admin@medyco.com.br",
    },
  };
  return copies[portal];
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
