import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Building2, CheckCircle2, LogOut, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { useRequireSession } from "@/hooks/use-auth-session";
import { supabase } from "@/integrations/supabase-ext/client";
import { getPostLoginRoute } from "@/lib/access-routing";
import { getMyAccess } from "@/lib/auth.functions";
import { createTenant } from "@/lib/tenants.functions";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useRequireSession();
  const fetchAccess = useServerFn(getMyAccess);
  const create = useServerFn(createTenant);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [brandColor, setBrandColor] = useState("#0ea5e9");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: access, isLoading } = useQuery({
    queryKey: ["my-access"],
    queryFn: () => fetchAccess(),
    enabled: session.isAuthenticated,
  });

  useEffect(() => {
    if (!access) return;
    const nextRoute = getPostLoginRoute(access);
    if (nextRoute !== "/onboarding") navigate({ to: nextRoute as never });
  }, [access, navigate]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await create({
        data: {
          name,
          slug: normalizeSlug(slug || name),
          brand_color: brandColor,
          plan: "starter",
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["my-access"] });
      toast.success("Clínica criada. Vamos configurar a operação.");
      navigate({ to: `/app/${result.tenant.slug}/settings` as never });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a clínica.");
    } finally {
      setLoading(false);
    }
  }

  const busy = session.isLoading || isLoading;
  const loggedEmail = access?.user.email;

  return (
    <main className="min-h-screen bg-surface">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
        <Logo />
        <section className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            {loggedEmail && (
              <div className="mb-5 rounded-xl border border-border bg-card p-4 text-sm shadow-soft">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Conta atual
                </div>
                <div className="mt-1 font-medium text-foreground">{loggedEmail}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await supabase.auth.signOut();
                      navigate({
                        to: "/login",
                        search: { portal: "admin", redirect: "/admin" } as never,
                      });
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-input px-3 py-2 text-xs font-medium text-foreground transition hover:bg-accent"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sair e entrar como admin
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/admin" })}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition hover:opacity-90"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Tentar abrir Admin
                  </button>
                </div>
              </div>
            )}
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 text-brand" />
              Primeiro acesso
            </div>
            <h1 className="mt-6 font-display text-4xl tracking-tight text-foreground md:text-5xl">
              Crie a primeira clínica para começar a operar.
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground">
              Depois disso você entra direto no painel da clínica, com pacientes, cartões, validação
              QR, serviços e assinaturas no mesmo ambiente.
            </p>
            <div className="mt-8 grid gap-3 text-sm text-foreground">
              {[
                "URL própria por slug",
                "Acesso administrativo automático",
                "Configuração de marca pronta para evoluir",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-elegant">
            <h2 className="font-display text-2xl text-foreground">Dados da clínica</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Isso cria o primeiro espaço operacional da sua plataforma.
            </p>

            {busy ? (
              <div className="mt-8 text-sm text-muted-foreground">Verificando sua conta...</div>
            ) : (
              <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
                <Field
                  label="Nome da clínica"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    if (!slug) setSlug(normalizeSlug(event.target.value));
                  }}
                  placeholder="Clínica Santa Vida"
                  required
                />
                <Field
                  label="Slug de acesso"
                  value={slug}
                  onChange={(event) => setSlug(normalizeSlug(event.target.value))}
                  placeholder="santavida"
                  pattern="[a-z0-9-]+"
                  required
                />
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <Field
                    label="Cor principal"
                    type="text"
                    value={brandColor}
                    onChange={(event) => setBrandColor(event.target.value)}
                    pattern="#[0-9a-fA-F]{6}"
                    required
                  />
                  <label className="block">
                    <span className="text-xs font-medium text-foreground">Prévia</span>
                    <input
                      type="color"
                      value={brandColor}
                      onChange={(event) => setBrandColor(event.target.value)}
                      className="mt-1.5 h-11 w-20 rounded-lg border border-input bg-surface-elevated p-1"
                    />
                  </label>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <button
                  disabled={loading}
                  className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                >
                  {loading ? "Criando clínica..." : "Criar clínica"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            )}
          </div>
        </section>
      </div>
    </main>
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

function normalizeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
