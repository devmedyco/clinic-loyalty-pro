import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight text-foreground">Recuperar senha</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Enviaremos um link de recuperação para o seu e-mail.
      </p>
      <form className="mt-8 space-y-4" onSubmit={(e) => e.preventDefault()}>
        <label className="block">
          <span className="text-xs font-medium text-foreground">E-mail</span>
          <input
            type="email"
            placeholder="voce@clinica.com.br"
            className="mt-1.5 block w-full rounded-lg border border-input bg-surface-elevated px-3 py-2.5 text-sm shadow-soft outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </label>
        <button className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90">
          Enviar link
        </button>
      </form>
      <div className="mt-6 text-center text-sm text-muted-foreground">
        <Link to="/login" className="text-foreground hover:text-brand transition">← Voltar para login</Link>
      </div>
    </div>
  );
}
