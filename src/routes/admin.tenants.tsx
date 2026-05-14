import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHeader } from "@/components/portal/Shell";

export const Route = createFileRoute("/admin/tenants")({
  component: TenantsPage,
});

const rows = [
  ["Clínica Santa Vida", "santavida", "Professional", 482, "Ativo"],
  ["Odonto Premium", "odontopremium", "Starter", 96, "Ativo"],
  ["Centro Médico Sul", "cmsul", "Enterprise", 2140, "Ativo"],
  ["Estética Aurora", "aurora", "Professional", 318, "Trial"],
  ["Lab Vitalis", "vitalis", "Starter", 54, "Pausado"],
] as const;

function TenantsPage() {
  return (
    <>
      <PageHeader
        title="Tenants"
        subtitle="Clínicas operando na infraestrutura Medyco."
        action={
          <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90">
            Novo tenant
          </button>
        }
      />
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3">Nome</th>
              <th className="px-5 py-3">Slug</th>
              <th className="px-5 py-3">Plano</th>
              <th className="px-5 py-3">Pacientes</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[1]} className="border-t border-border">
                <td className="px-5 py-4 font-medium text-foreground">{r[0]}</td>
                <td className="px-5 py-4 text-muted-foreground">/{r[1]}</td>
                <td className="px-5 py-4">{r[2]}</td>
                <td className="px-5 py-4">{r[3].toLocaleString("pt-BR")}</td>
                <td className="px-5 py-4">
                  <span className={`rounded-md px-2 py-0.5 text-xs ${
                    r[4] === "Ativo" ? "bg-success/15 text-success" :
                    r[4] === "Trial" ? "bg-brand-soft text-brand" :
                    "bg-muted text-muted-foreground"
                  }`}>{r[4]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
