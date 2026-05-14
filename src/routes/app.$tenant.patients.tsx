import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHeader } from "@/components/portal/Shell";

export const Route = createFileRoute("/app/$tenant/patients")({
  component: PatientsPage,
});

const data = [
  ["Maria Eduarda Costa", "123.456.789-00", "Professional", "Ativo"],
  ["João Pedro Almeida", "987.654.321-00", "Starter", "Ativo"],
  ["Roberta Lima", "456.789.123-00", "Professional", "Inadimplente"],
  ["Clara Mendes", "321.654.987-00", "Starter", "Ativo"],
  ["Pedro Soares", "159.753.486-00", "Professional", "Ativo"],
] as const;

function PatientsPage() {
  return (
    <>
      <PageHeader
        title="Pacientes"
        subtitle="Gerencie titulares e dependentes do programa."
        action={
          <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90">
            Novo paciente
          </button>
        }
      />
      <Card className="overflow-hidden">
        <div className="border-b border-border p-4">
          <input
            placeholder="Buscar por nome ou CPF..."
            className="w-full max-w-sm rounded-lg border border-input bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3">Nome</th>
              <th className="px-5 py-3">CPF</th>
              <th className="px-5 py-3">Plano</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r[1]} className="border-t border-border">
                <td className="px-5 py-4 font-medium text-foreground">{r[0]}</td>
                <td className="px-5 py-4 text-muted-foreground">{r[1]}</td>
                <td className="px-5 py-4">{r[2]}</td>
                <td className="px-5 py-4">
                  <span className={`rounded-md px-2 py-0.5 text-xs ${r[3] === "Ativo" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>{r[3]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
