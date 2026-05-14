import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHeader } from "@/components/portal/Shell";

export const Route = createFileRoute("/patient/history")({
  component: HistoryPage,
});

const data = [
  ["12 mai", "Consulta clínica geral", "R$ 220", "R$ 88", "60%"],
  ["28 abr", "Limpeza dental", "R$ 180", "R$ 72", "60%"],
  ["14 mar", "Ultrassom abdominal", "R$ 320", "R$ 160", "50%"],
  ["02 fev", "Exame de sangue", "R$ 120", "R$ 48", "60%"],
];

function HistoryPage() {
  return (
    <>
      <PageHeader title="Histórico de atendimentos" subtitle="Tudo que você economizou usando seu cartão." />
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3">Data</th>
              <th className="px-5 py-3">Serviço</th>
              <th className="px-5 py-3">Valor original</th>
              <th className="px-5 py-3">Você pagou</th>
              <th className="px-5 py-3">Desconto</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r[0] + r[1]} className="border-t border-border">
                <td className="px-5 py-4 text-muted-foreground">{r[0]}</td>
                <td className="px-5 py-4 font-medium text-foreground">{r[1]}</td>
                <td className="px-5 py-4 text-muted-foreground line-through">{r[2]}</td>
                <td className="px-5 py-4 text-foreground">{r[3]}</td>
                <td className="px-5 py-4"><span className="rounded-md bg-brand-soft px-2 py-0.5 text-xs text-brand">-{r[4]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
