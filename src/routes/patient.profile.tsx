import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, PageHeader } from "@/components/portal/Shell";
import { getPatientPortal, updatePatientPortalProfile } from "@/lib/patient-portal.functions";

export const Route = createFileRoute("/patient/profile")({
  component: PatientProfilePage,
});

function PatientProfilePage() {
  const queryClient = useQueryClient();
  const fetchPortal = useServerFn(getPatientPortal);
  const updateProfile = useServerFn(updatePatientPortalProfile);
  const { data, isLoading, error } = useQuery({
    queryKey: ["patient-profile"],
    queryFn: () => fetchPortal(),
  });
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (!data?.patient) return;
    setFullName(data.patient.full_name ?? "");
    setEmail(data.patient.email ?? "");
    setPhone(data.patient.phone ?? "");
  }, [data?.patient]);

  const mutation = useMutation({
    mutationFn: () => updateProfile({ data: { full_name: fullName, email, phone } }),
    onSuccess: async () => {
      toast.success("Perfil atualizado");
      await queryClient.invalidateQueries({ queryKey: ["patient-profile"] });
      await queryClient.invalidateQueries({ queryKey: ["patient-portal-shell"] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  return (
    <>
      <PageHeader title="Perfil" subtitle="Dados básicos do seu cadastro de paciente." />
      {isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground">Carregando perfil...</Card>
      ) : error ? (
        <Card className="p-6 text-sm text-destructive">{(error as Error).message}</Card>
      ) : !data?.patient ? (
        <Card className="p-8 text-sm text-muted-foreground">
          Seu cadastro de paciente ainda não foi vinculado a uma clínica.
        </Card>
      ) : (
        <Card className="max-w-2xl p-6">
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate();
            }}
          >
            <Field
              label="Nome completo"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
            />
            <Field
              label="E-mail"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Field
              label="Telefone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
            <Field label="CPF" value={data.patient.cpf ?? ""} disabled />
            <button
              disabled={mutation.isPending}
              className="mt-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {mutation.isPending ? "Salvando..." : "Salvar perfil"}
            </button>
          </form>
        </Card>
      )}
    </>
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
        className="mt-1.5 block w-full rounded-lg border border-input bg-surface-elevated px-3 py-2.5 text-sm text-foreground shadow-soft outline-none transition disabled:cursor-not-allowed disabled:bg-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
    </label>
  );
}
