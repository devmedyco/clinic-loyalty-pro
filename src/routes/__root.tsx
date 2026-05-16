import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl gradient-brand text-white font-display text-xl">
          M
        </div>
        <h1 className="text-7xl font-display tracking-tight text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-medium text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O endereço acessado não existe ou foi movido.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-medium tracking-tight text-foreground">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ocorreu um erro ao carregar esta página. Tente novamente.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-accent"
          >
            Início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Medyco — Infraestrutura de benefícios em saúde para clínicas" },
      {
        name: "description",
        content:
          "Crie seu próprio cartão de benefícios em saúde com assinatura recorrente, QR Code, portal do paciente e gestão completa para clínicas.",
      },
      { name: "author", content: "Medyco" },
      { name: "robots", content: "index, follow" },
      {
        property: "og:title",
        content: "Medyco — Infraestrutura de benefícios em saúde para clínicas",
      },
      {
        property: "og:description",
        content:
          "Transforme sua clínica em uma operação recorrente com assinatura, cartão digital e validação inteligente.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://medyco.com.br" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: "Medyco — Infraestrutura de benefícios em saúde para clínicas",
      },
      {
        property: "og:description",
        content:
          "Crie seu próprio cartão de benefícios em saúde com assinatura recorrente, QR Code, portal do paciente e gestão completa para clínicas.",
      },
      {
        name: "twitter:description",
        content:
          "Crie seu próprio cartão de benefícios em saúde com assinatura recorrente, QR Code, portal do paciente e gestão completa para clínicas.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/1794a497-7ca4-4194-a92b-8941311a0e0c/id-preview-93ff27db--31741fd0-8a9d-4d91-8bbb-48d015e17fd5.lovable.app-1778804429135.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/1794a497-7ca4-4194-a92b-8941311a0e0c/id-preview-93ff27db--31741fd0-8a9d-4d91-8bbb-48d015e17fd5.lovable.app-1778804429135.png",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "canonical", href: "https://medyco.com.br" },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster position="top-right" richColors />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
