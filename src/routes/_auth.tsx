import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden border-r border-border bg-primary p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-30 surface-grid" aria-hidden />
        <div className="relative">
          <Logo />
        </div>
        <div className="relative">
          <p className="font-display text-3xl leading-tight">
            "Triplicamos a recorrência da clínica em três meses. A Medyco virou
            a espinha dorsal da nossa operação."
          </p>
          <div className="mt-4 text-sm opacity-80">
            Dra. Camila Andrade · Clínica Vitta
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8"><Logo /></div>
          <Outlet />
          <div className="mt-10 text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition">← Voltar ao site</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
