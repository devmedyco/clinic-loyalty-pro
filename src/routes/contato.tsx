import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Mail, MessageCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PublicPage } from "@/components/public/PublicPage";
import { sendContactLead } from "@/lib/public-contact.functions";

export const Route = createFileRoute("/contato")({
  component: ContactPage,
});

function ContactPage() {
  const sendLead = useServerFn(sendContactLead);
  const [form, setForm] = useState({
    name: "",
    clinic: "",
    email: "",
    phone: "",
    message: "",
    website: "",
  });
  const mutation = useMutation({
    mutationFn: () => sendLead({ data: form }),
    onSuccess: () => {
      toast.success("Mensagem enviada. A equipe Medyco vai retornar o contato.");
      setForm({ name: "", clinic: "", email: "", phone: "", message: "", website: "" });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  return (
    <PublicPage
      eyebrow="Contato"
      title="Fale com a Medyco"
      subtitle="Para clínicas que querem operar recorrência, benefícios e cartão digital com uma estrutura moderna."
    >
      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <form
          className="rounded-2xl border border-border bg-card p-6 shadow-soft"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Seu nome"
              value={form.name}
              onChange={(value) => setForm({ ...form, name: value })}
              required
            />
            <Field
              label="Clínica"
              value={form.clinic}
              onChange={(value) => setForm({ ...form, clinic: value })}
              required
            />
            <Field
              label="E-mail"
              type="email"
              value={form.email}
              onChange={(value) => setForm({ ...form, email: value })}
              required
            />
            <Field
              label="Telefone"
              value={form.phone}
              onChange={(value) => setForm({ ...form, phone: value })}
            />
            <input
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={(event) => setForm({ ...form, website: event.target.value })}
              className="hidden"
              aria-hidden="true"
            />
            <label className="sm:col-span-2">
              <span className="text-xs font-medium text-foreground">Mensagem</span>
              <textarea
                value={form.message}
                onChange={(event) => setForm({ ...form, message: event.target.value })}
                rows={5}
                className="mt-1.5 block w-full resize-none rounded-lg border border-input bg-surface-elevated px-3 py-2.5 text-sm text-foreground shadow-soft outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                placeholder="Conte rapidamente sobre a operação da clínica."
              />
            </label>
          </div>
          <button
            disabled={mutation.isPending}
            className="mt-5 w-full rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {mutation.isPending ? "Enviando..." : "Solicitar contato"}
          </button>
        </form>

        <div className="grid gap-4">
          <a
            href="mailto:contato@medyco.com.br"
            className="rounded-2xl border border-border bg-card p-6 transition hover:border-brand/40 hover:shadow-elevated"
          >
            <Mail className="h-6 w-6 text-brand" />
            <h2 className="mt-4 font-display text-2xl text-foreground">E-mail</h2>
            <p className="mt-2 text-sm text-muted-foreground">contato@medyco.com.br</p>
          </a>
          <a
            href="/signup"
            className="rounded-2xl border border-border bg-card p-6 transition hover:border-brand/40 hover:shadow-elevated"
          >
            <MessageCircle className="h-6 w-6 text-brand" />
            <h2 className="mt-4 font-display text-2xl text-foreground">Criar acesso</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Comece criando sua primeira clínica na plataforma.
            </p>
          </a>
        </div>
      </div>
    </PublicPage>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label>
      <span className="text-xs font-medium text-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="mt-1.5 block w-full rounded-lg border border-input bg-surface-elevated px-3 py-2.5 text-sm text-foreground shadow-soft outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
    </label>
  );
}
