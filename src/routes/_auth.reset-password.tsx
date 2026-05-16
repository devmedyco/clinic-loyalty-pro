import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase-ext/client";

export const Route = createFileRoute("/_auth/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const authSearch = getAuthSearch();
  const [mode, setMode] = useState<"request" | "update">("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      (window.location.hash.includes("type=recovery") ||
        new URLSearchParams(window.location.search).get("mode") === "update")
    ) {
      setMode("update");
    }
  }, []);

  async function onRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
        "/reset-password?mode=update",
      )}`,
    });
    setLoading(false);
    if (error) return setError(error.message);
    setInfo("Link de recuperação enviado. Verifique seu e-mail.");
  }

  async function onUpdate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return setError(error.message);
    setInfo("Senha atualizada com sucesso. Você já pode entrar.");
  }

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight text-foreground">
        {mode === "request" ? "Recuperar senha" : "Definir nova senha"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {mode === "request"
          ? "Enviaremos um link de recuperação para o seu e-mail."
          : "Escolha uma nova senha para sua conta."}
      </p>
      <form className="mt-8 space-y-4" onSubmit={mode === "request" ? onRequest : onUpdate}>
        {mode === "request" ? (
          <Field
            label="E-mail"
            type="email"
            placeholder="voce@clinica.com.br"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        ) : (
          <Field
            label="Nova senha"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {info && <p className="text-sm text-foreground">{info}</p>}
        <button
          disabled={loading}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Enviando..." : mode === "request" ? "Enviar link" : "Atualizar senha"}
        </button>
      </form>
      <div className="mt-6 text-center text-sm text-muted-foreground">
        <Link
          to="/login"
          search={authSearch as never}
          className="text-foreground hover:text-brand transition"
        >
          ← Voltar para login
        </Link>
      </div>
    </div>
  );
}

function getAuthSearch() {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const portal = params.get("portal");
  const redirect = params.get("redirect");
  return {
    ...(portal ? { portal } : {}),
    ...(redirect && redirect.startsWith("/") && !redirect.startsWith("//") ? { redirect } : {}),
  };
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
