import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase-ext/client";
import { getMyAccess } from "@/lib/auth.functions";

export const Route = createFileRoute("/_auth/signup")({
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const fetchAccess = useServerFn(getMyAccess);
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
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
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
    const access = await fetchAccess();
    const firstTenant = access.tenants?.[0];
    navigate({ to: (firstTenant ? `/app/${firstTenant.slug}` : "/admin/tenants") as never });
  }

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight text-foreground">Criar conta</h1>
      <p className="mt-1 text-sm text-muted-foreground">Configure sua plataforma em minutos.</p>
      <form className="mt-8 space-y-4" onSubmit={onSubmit}>
        <Field
          label="Nome completo"
          placeholder="Dra. Camila Andrade"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
        <Field
          label="E-mail"
          type="email"
          placeholder="voce@clinica.com.br"
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
        <Link to="/login" className="text-foreground hover:text-brand transition">
          Entrar
        </Link>
      </div>
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
        className="mt-1.5 block w-full rounded-lg border border-input bg-surface-elevated px-3 py-2.5 text-sm text-foreground shadow-soft outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
    </label>
  );
}
