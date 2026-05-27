import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  CreditCard,
  LogOut,
  Mail,
  ShieldCheck,
} from "lucide-react";
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
    queryKey: ["my-access", session.userId, "onboarding"],
    queryFn: () => fetchAccess(),
    enabled: session.isAuthenticated && Boolean(session.userId),
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
                      queryClient.clear();
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
              Vamos criar o primeiro painel da clínica.
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground">
              Este passo é para quem administra uma clínica. Pacientes entram pelo convite recebido
              no e-mail e não precisam criar uma clínica.
            </p>
            <div className="mt-8 grid gap-3 text-sm text-foreground">
              {[
                "Você cria o espaço da clínica e cai direto no checklist operacional",
                "Depois completa CNPJ, responsável, Asaas, rede e pacientes",
                "Paciente só entra por convite e não vê painel administrativo",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl border border-border bg-card p-4 text-sm shadow-soft">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-medium text-foreground">Sou paciente e recebi convite</div>
                  <p className="mt-1 text-muted-foreground">
                    Use o botão do e-mail da clínica. O convite já sabe seu nome, sua clínica e
                    abrirá a tela certa para criar senha.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-elegant">
            <h2 className="font-display text-2xl text-foreground">Dados da clínica</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Preencha só o essencial agora. O restante fica guiado dentro de Configurações.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <SetupPill icon={Building2} label="1. Clínica" active />
              <SetupPill icon={ShieldCheck} label="2. Operação" />
              <SetupPill icon={CreditCard} label="3. Cobrança" />
            </div>

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

                <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">
                  <div className="font-medium text-foreground">Depois de criar</div>
                  <div className="mt-2 grid gap-2">
                    <Step number="1" text="Completar CNPJ, responsável e endereço" />
                    <Step number="2" text="Configurar Asaas e gerar a mensalidade" />
                    <Step number="3" text="Cadastrar rede, serviços e paciente teste" />
                  </div>
                </div>

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

function Step({ number, text }: { number: string; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-soft text-xs font-medium text-brand">
        {number}
      </span>
      {text}
    </div>
  );
}

function SetupPill({
  icon: Icon,
  label,
  active = false,
}: {
  icon: typeof Building2;
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
        active
          ? "border-brand/30 bg-brand-soft text-brand"
          : "border-border bg-surface text-muted-foreground"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
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

function normalizeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
