import { Link } from "@tanstack/react-router";

const problems = [
  {
    t: "Dependência de convênios",
    d: "Margens cada vez mais apertadas e regras impostas por terceiros.",
  },
  { t: "Receita imprevisível", d: "Caixa que oscila com a agenda e gera estresse operacional." },
  { t: "Agenda ociosa", d: "Horários vagos sem ferramenta para reativar pacientes." },
  { t: "Baixa fidelização", d: "Sem recorrência, o paciente vira uma transação única." },
  { t: "Inadimplência", d: "Cobranças manuais que se perdem no dia a dia." },
  { t: "Operação fragmentada", d: "Planilhas, papéis e sistemas que não conversam entre si." },
];

const benefitsClinic = [
  { t: "Receita recorrente", d: "Assinatura mensal automática via Asaas." },
  { t: "Previsibilidade", d: "MRR claro, churn medido e crescimento composto." },
  { t: "Independência", d: "Sua marca, suas regras, seus pacientes." },
  { t: "Gestão moderna", d: "Dashboards, financeiro e atendimentos em um só lugar." },
];

const benefitsPatient = [
  { t: "Cartão digital", d: "Disponível no celular a qualquer hora." },
  { t: "Descontos reais", d: "Tabela própria da clínica, sem letras miúdas." },
  { t: "Validação rápida", d: "QR Code lido em segundos pela recepção." },
  { t: "Histórico completo", d: "Todos os atendimentos e a economia gerada." },
];

const modules = [
  { t: "Portal Clínica", d: "Pacientes, equipe, serviços, rede, billing, contratos e relatórios." },
  { t: "Portal Paciente", d: "Cartão digital, assinatura, histórico, perfil e rede credenciada." },
  { t: "Validação por QR", d: "Recepção autoriza atendimentos em tempo real." },
  {
    t: "Assinaturas + split",
    d: "Recorrência via Asaas com participação automática por paciente pago.",
  },
  { t: "Multi-tenant", d: "White-label nativo, com slug, domínio e branding próprios." },
  { t: "Admin global", d: "Tenants, billing, métricas, auditoria, notificações e operação SaaS." },
  {
    t: "Cadastro inteligente",
    d: "CNPJ e CEP preenchem dados automaticamente para reduzir atrito.",
  },
  { t: "Contratos e LGPD", d: "Termos, aceite digital e histórico jurídico por paciente." },
  { t: "Relatórios", d: "Gráficos, CSV e PDF para pacientes, pagamentos e atendimentos." },
];

const platformMetrics = [
  { k: "Mensalidade clínica", v: "R$ 197" },
  { k: "Split Medyco", v: "10%" },
  { k: "Paciente sugerido", v: "R$ 39,90" },
  { k: "Tempo de ativação", v: "dias" },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-brand" />
      {children}
    </div>
  );
}

export function Problems() {
  return (
    <section className="border-b border-border/60 bg-surface">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <div className="max-w-2xl">
          <Eyebrow>O problema</Eyebrow>
          <h2 className="mt-4 font-display text-4xl tracking-tight text-foreground md:text-5xl">
            Sua clínica vive presa ao convênio.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Operar sem recorrência é operar no susto. Cada mês começa do zero.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
          {problems.map((p) => (
            <div key={p.t} className="bg-surface-elevated p-6">
              <div className="font-medium text-foreground">{p.t}</div>
              <p className="mt-2 text-sm text-muted-foreground">{p.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Solution() {
  return (
    <section id="solucao" className="border-b border-border/60">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <div className="grid items-start gap-16 md:grid-cols-2">
          <div>
            <Eyebrow>A solução Medyco</Eyebrow>
            <h2 className="mt-4 font-display text-4xl tracking-tight text-foreground md:text-5xl">
              Uma infraestrutura completa de
              <span className="italic gradient-text"> benefícios recorrentes</span>.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Assinatura mensal, cartão digital, validação por QR e gestão clínica — tudo em uma
              única plataforma white-label.
            </p>
            <div className="mt-8 space-y-4">
              {[
                "Assinatura recorrente automatizada",
                "Cartão digital com QR Code único",
                "Validação operacional em tempo real",
                "Pagamentos integrados via Asaas",
                "Multi-tenant com sua marca",
              ].map((s) => (
                <div key={s} className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-soft text-brand">
                    <svg
                      viewBox="0 0 16 16"
                      className="h-3 w-3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <path d="m4 8 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="text-foreground">{s}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Visual: cartão + QR */}
          <div className="relative">
            <div
              className="absolute -inset-8 -z-10 bg-gradient-to-br from-brand/15 to-transparent blur-3xl"
              aria-hidden
            />
            <div className="relative aspect-[1.6/1] overflow-hidden rounded-2xl gradient-brand p-6 text-white shadow-elevated">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-widest opacity-80">
                    Clínica Santa Vida
                  </div>
                  <div className="mt-1 font-display text-2xl">Cartão Benefícios</div>
                </div>
                <div className="rounded-md bg-white/15 px-2 py-1 text-[10px] uppercase tracking-wider">
                  Ativo
                </div>
              </div>
              <div className="mt-10">
                <div className="text-[10px] uppercase tracking-widest opacity-80">Titular</div>
                <div className="mt-0.5 font-medium">Maria Eduarda Costa</div>
              </div>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-widest opacity-80">Modelo</div>
                  <div className="font-medium">Base + split · mensal</div>
                </div>
                <div className="grid h-16 w-16 grid-cols-5 grid-rows-5 gap-px rounded bg-white p-1">
                  {Array.from({ length: 25 }).map((_, i) => (
                    <span
                      key={i}
                      className={`${[0, 2, 3, 5, 7, 8, 11, 13, 16, 17, 19, 20, 22, 24].includes(i) ? "bg-primary" : "bg-transparent"}`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-success/15 text-success">
                  <svg
                    viewBox="0 0 16 16"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="m4 8 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div>
                  <div className="text-sm font-medium text-foreground">Atendimento autorizado</div>
                  <div className="text-xs text-muted-foreground">
                    Consulta clínica geral · desconto de 40% aplicado
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Benefits() {
  return (
    <section className="border-b border-border/60 bg-surface">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <div className="grid gap-16 md:grid-cols-2">
          <div>
            <Eyebrow>Para a clínica</Eyebrow>
            <h3 className="mt-4 font-display text-3xl tracking-tight text-foreground md:text-4xl">
              Receita previsível, sem depender de convênio.
            </h3>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {benefitsClinic.map((b) => (
                <div key={b.t} className="rounded-xl border border-border bg-surface-elevated p-5">
                  <div className="font-medium text-foreground">{b.t}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{b.d}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Eyebrow>Para o paciente</Eyebrow>
            <h3 className="mt-4 font-display text-3xl tracking-tight text-foreground md:text-4xl">
              Saúde acessível, na palma da mão.
            </h3>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {benefitsPatient.map((b) => (
                <div key={b.t} className="rounded-xl border border-border bg-surface-elevated p-5">
                  <div className="font-medium text-foreground">{b.t}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{b.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Modules() {
  return (
    <section id="modulos" className="border-b border-border/60">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <div className="max-w-2xl">
          <Eyebrow>A plataforma</Eyebrow>
          <h2 className="mt-4 font-display text-4xl tracking-tight text-foreground md:text-5xl">
            Tudo que sua operação precisa.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Três portais distintos, dezenas de módulos, uma arquitetura unificada.
          </p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {modules.map((m, i) => (
            <div
              key={m.t}
              className="group rounded-2xl border border-border bg-card p-6 transition hover:border-brand/40 hover:shadow-elevated"
            >
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <span className="font-display text-sm">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <div className="mt-4 font-medium text-foreground">{m.t}</div>
              <p className="mt-1 text-sm text-muted-foreground">{m.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ProductShowcase() {
  return (
    <section className="border-b border-border/60 bg-surface">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <div className="max-w-2xl">
          <Eyebrow>Produto real</Eyebrow>
          <h2 className="mt-4 font-display text-4xl tracking-tight text-foreground md:text-5xl">
            A Medyco já nasce como operação, não como apresentação.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Painéis separados, fluxos completos e dados que fazem sentido para a clínica, para o
            paciente e para a plataforma mãe.
          </p>
        </div>
        <div className="mt-12 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-elevated">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <div className="text-sm font-medium text-foreground">Portal Clínica</div>
                <div className="text-xs text-muted-foreground">Relatórios · últimos 30 dias</div>
              </div>
              <div className="rounded-lg bg-brand-soft px-3 py-1 text-xs text-brand">
                Base + split
              </div>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-3">
              {[
                ["Receita final", "R$ 48.290"],
                ["Economia gerada", "R$ 19.420"],
                ["Validações", "1.284"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-border bg-card p-4">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="mt-1 font-display text-3xl text-foreground">{value}</div>
                </div>
              ))}
            </div>
            <div className="px-5 pb-5">
              <div className="flex h-44 items-end gap-2 rounded-xl border border-border bg-card p-5">
                {[36, 58, 44, 72, 64, 84, 52, 90, 76, 96, 70, 88].map((height, index) => (
                  <span
                    key={index}
                    className="flex-1 rounded-t-md gradient-brand transition duration-500 hover:opacity-80"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="grid gap-5">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-foreground">Validação QR</div>
                  <div className="text-xs text-muted-foreground">Recepção em tempo real</div>
                </div>
                <span className="rounded-full bg-success/15 px-3 py-1 text-xs text-success">
                  Autorizado
                </span>
              </div>
              <div className="mt-5 rounded-xl border border-border bg-surface p-4">
                <div className="font-medium text-foreground">Maria Eduarda Costa</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Termo aceito · assinatura ativa · cartão válido
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="text-sm font-medium text-foreground">Portal Paciente</div>
              <div className="mt-4 overflow-hidden rounded-xl gradient-brand p-5 text-white">
                <div className="text-xs uppercase tracking-widest opacity-80">Cartão digital</div>
                <div className="mt-8 font-display text-2xl">Santa Vida Benefits</div>
                <div className="mt-2 text-sm opacity-80">MED-8AF2-91</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Plans() {
  return (
    <section id="planos" className="border-b border-border/60 bg-surface">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>Modelo comercial</Eyebrow>
          <h2 className="mt-4 font-display text-4xl tracking-tight text-foreground md:text-5xl">
            Mensalidade baixa. Crescimento compartilhado.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            A clínica paga uma mensalidade única para usar a plataforma e a Medyco participa de cada
            paciente pagante via split.
          </p>
        </div>
        <div className="mt-12 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-brand bg-surface-elevated p-6 shadow-elevated">
            <div className="inline-flex rounded-full gradient-brand px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-white">
              Modelo padrão
            </div>
            <div className="mt-6 font-display text-5xl text-foreground">R$ 197</div>
            <p className="mt-1 text-sm text-muted-foreground">por mês por clínica</p>
            <div className="mt-6 rounded-xl border border-border bg-surface p-4">
              <div className="text-sm font-medium text-foreground">+ 10% via split</div>
              <p className="mt-1 text-sm text-muted-foreground">
                aplicado somente quando o paciente paga a assinatura do cartão.
              </p>
            </div>
            <ul className="mt-6 space-y-2.5 border-t border-border pt-6">
              {[
                "Sem cobrança por paciente inativo",
                "Cartão digital, QR e portal paciente inclusos",
                "Rede credenciada, contratos, billing e relatórios",
                "Cadastro inteligente com CNPJ e CEP",
                "Condição customizada para redes e franquias",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-foreground">
                  <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-brand-soft text-brand">
                    <svg
                      viewBox="0 0 16 16"
                      className="h-2.5 w-2.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <path d="m4 8 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              to="/signup"
              className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              Criar plataforma
            </Link>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="font-display text-2xl text-foreground">Exemplo prático</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Clínica com 100 pacientes pagando R$ 39,90 por mês.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {platformMetrics.map((metric) => (
                <div key={metric.k} className="rounded-xl border border-border bg-surface p-4">
                  <div className="text-xs text-muted-foreground">{metric.k}</div>
                  <div className="mt-1 font-display text-3xl text-foreground">{metric.v}</div>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-xl border border-border bg-surface p-5">
              <div className="text-sm text-muted-foreground">Receita estimada Medyco</div>
              <div className="mt-1 font-display text-4xl text-foreground">R$ 596/mês</div>
              <p className="mt-2 text-sm text-muted-foreground">
                R$ 197 de mensalidade + R$ 399 de split sobre assinaturas pagas.
              </p>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link
                to="/signup"
                className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-accent"
              >
                Começar agora
              </Link>
              <a
                href="mailto:contato@medyco.com.br"
                className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
              >
                Falar com vendas
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CTA() {
  return (
    <section id="contato" className="border-b border-border/60">
      <div className="mx-auto max-w-7xl px-6 py-28">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-primary p-12 text-center text-primary-foreground md:p-20">
          <div className="absolute inset-0 opacity-30 surface-grid" aria-hidden />
          <div className="relative">
            <h2 className="mx-auto max-w-3xl font-display text-4xl tracking-tight md:text-6xl">
              Transforme sua clínica em uma
              <span className="italic"> operação recorrente.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg opacity-80">
              Comece em minutos. Configure sua marca, importe pacientes e ative o cartão.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-medium text-brand-foreground transition hover:opacity-90"
              >
                Criar minha plataforma
              </Link>
              <a
                href="mailto:contato@medyco.com.br"
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-5 py-3 text-sm font-medium transition hover:bg-white/10"
              >
                Falar com vendas
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="bg-background">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 md:grid-cols-4">
        <div>
          <div className="font-display text-xl text-foreground">Medyco</div>
          <p className="mt-3 text-sm text-muted-foreground">
            Infraestrutura de benefícios em saúde para clínicas modernas.
          </p>
        </div>
        {[
          { t: "Plataforma", l: ["Solução", "Módulos", "Modelo", "Demonstração"] },
          { t: "Empresa", l: ["Sobre", "Blog", "Contato", "Carreiras"] },
          { t: "Legal", l: ["Termos", "Privacidade", "LGPD", "Status"] },
        ].map((g) => (
          <div key={g.t}>
            <div className="text-sm font-medium text-foreground">{g.t}</div>
            <ul className="mt-3 space-y-2">
              {g.l.map((i) => (
                <li key={i}>
                  <a
                    className="text-sm text-muted-foreground transition hover:text-foreground"
                    href="#"
                  >
                    {i}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
          <span className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Medyco. Todos os direitos reservados.
          </span>
          <span className="text-xs text-muted-foreground">
            Feito para clínicas que querem crescer.
          </span>
        </div>
      </div>
    </footer>
  );
}
