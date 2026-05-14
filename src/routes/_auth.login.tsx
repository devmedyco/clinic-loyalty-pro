import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/login")({
  component: LoginPage,
});

function LoginPage() {
  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight text-foreground">Entrar</h1>
      <p className="mt-1 text-sm text-muted-foreground">Acesse sua plataforma Medyco.</p>
      <form className="mt-8 space-y-4" onSubmit={(e) => e.preventDefault()}>
        <Field label="E-mail" type="email" placeholder="voce@clinica.com.br" />
        <Field label="Senha" type="password" placeholder="••••••••" />
        <button className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90">
          Entrar
        </button>
      </form>
      <div className="mt-4 flex items-center justify-between text-sm">
        <Link to="/reset-password" className="text-muted-foreground hover:text-foreground transition">Esqueci a senha</Link>
        <Link to="/signup" className="text-foreground hover:text-brand transition">Criar conta</Link>
      </div>
    </div>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
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
