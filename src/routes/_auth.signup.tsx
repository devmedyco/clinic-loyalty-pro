import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/signup")({
  component: SignupPage,
});

function SignupPage() {
  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight text-foreground">Criar plataforma</h1>
      <p className="mt-1 text-sm text-muted-foreground">Configure sua clínica em minutos.</p>
      <form className="mt-8 space-y-4" onSubmit={(e) => e.preventDefault()}>
        <Field label="Nome da clínica" placeholder="Clínica Santa Vida" />
        <Field label="Subdomínio" placeholder="santavida" prefix="app.medyco.com.br/" />
        <Field label="E-mail" type="email" placeholder="voce@clinica.com.br" />
        <Field label="Senha" type="password" placeholder="••••••••" />
        <button className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90">
          Criar minha plataforma
        </button>
      </form>
      <div className="mt-6 text-center text-sm text-muted-foreground">
        Já tem conta? <Link to="/login" className="text-foreground hover:text-brand transition">Entrar</Link>
      </div>
    </div>
  );
}

function Field({ label, prefix, ...props }: { label: string; prefix?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <div className="mt-1.5 flex overflow-hidden rounded-lg border border-input bg-surface-elevated shadow-soft transition focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
        {prefix && <span className="flex items-center bg-muted px-3 text-xs text-muted-foreground">{prefix}</span>}
        <input
          {...props}
          className="block w-full bg-transparent px-3 py-2.5 text-sm text-foreground outline-none"
        />
      </div>
    </label>
  );
}
