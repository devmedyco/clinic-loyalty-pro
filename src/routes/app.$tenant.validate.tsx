import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, CheckCircle2, QrCode, ScanLine, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Card, PageHeader } from "@/components/portal/Shell";
import { listRecentCardValidations, validateCard } from "@/lib/card-validations.functions";

export const Route = createFileRoute("/app/$tenant/validate")({
  component: ValidatePage,
});

type ValidationResult = {
  authorized: boolean;
  outcome: "approved" | "denied";
  reason: string | null;
  patient: {
    full_name: string;
    cpf: string | null;
    status: string;
    email: string | null;
    phone: string | null;
  } | null;
  card: {
    card_number: string;
    active: boolean;
    expires_at: string | null;
  } | null;
};

type RecentValidation = {
  id: string;
  validated_at: string;
  outcome: "approved" | "denied" | string;
  reason: string | null;
  qr_token_snapshot: string | null;
  notes: string | null;
  benefit_cards?: {
    card_number: string;
    patients?: {
      full_name: string;
      cpf: string | null;
      status: string;
    } | null;
  } | null;
};

type ValidationInput = { tokenOverride?: string };

type BarcodeDetectorConstructor = new (options: { formats: string[] }) => {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
};

function ValidatePage() {
  const { tenant } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchRecent = useServerFn(listRecentCardValidations);
  const runValidation = useServerFn(validateCard);
  const [token, setToken] = useState("");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<ValidationResult | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["card-validations", tenant],
    queryFn: () => fetchRecent({ data: { tenant } }),
  });

  const mutation = useMutation({
    mutationFn: (input?: ValidationInput) =>
      runValidation({ data: { tenant, token: input?.tokenOverride ?? token, notes } }),
    onSuccess: async (response) => {
      setResult(response as ValidationResult);
      if (response.authorized) {
        toast.success("Atendimento autorizado");
        setToken("");
        setNotes("");
      } else {
        toast.error(response.reason ?? "Atendimento negado");
      }
      await queryClient.invalidateQueries({ queryKey: ["card-validations", tenant] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const validations = (data?.validations ?? []) as unknown as RecentValidation[];
  const handleQrDetected = useCallback(
    (value: string) => {
      setToken(value);
      mutation.mutate({ tokenOverride: value });
    },
    [mutation],
  );

  return (
    <>
      <PageHeader
        title="Validação de cartão"
        subtitle="Valide o cartão digital do paciente antes de autorizar o atendimento."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <div className="relative flex min-h-[320px] items-center justify-center bg-primary p-6 text-primary-foreground">
            <div className="absolute inset-0 surface-grid opacity-20" aria-hidden />
            <div className="relative w-full max-w-xl">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                <QrCode className="h-9 w-9" />
              </div>
              <div className="mt-5 text-center font-display text-2xl">Validação operacional</div>
              <p className="mt-1 text-center text-sm opacity-80">
                Informe o token ou número impresso no cartão digital do paciente.
              </p>

              <form
                className="mt-6 rounded-2xl bg-white/10 p-4 ring-1 ring-white/20"
                onSubmit={(event) => {
                  event.preventDefault();
                  mutation.mutate({});
                }}
              >
                <label className="block">
                  <span className="text-xs font-medium opacity-90">Token ou número do cartão</span>
                  <input
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    placeholder="medyco_... ou MED-..."
                    required
                    className="mt-1.5 block w-full rounded-lg border border-white/25 bg-white px-3 py-3 text-sm text-primary shadow-soft outline-none transition placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-brand/30"
                  />
                </label>
                <label className="mt-3 block">
                  <span className="text-xs font-medium opacity-90">Nota da recepção</span>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Opcional"
                    rows={2}
                    className="mt-1.5 block w-full resize-none rounded-lg border border-white/25 bg-white px-3 py-2.5 text-sm text-primary shadow-soft outline-none transition placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-brand/30"
                  />
                </label>
                <button
                  disabled={mutation.isPending || token.trim().length < 4}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-medium text-brand-foreground transition hover:opacity-90 disabled:opacity-60"
                >
                  <ScanLine className="h-4 w-4" />
                  {mutation.isPending ? "Validando..." : "Validar cartão"}
                </button>
              </form>
              <QrCameraScanner disabled={mutation.isPending} onDetected={handleQrDetected} />
            </div>
          </div>

          <div className="border-t border-border p-5">
            <ValidationResultPanel result={result} />
          </div>
        </Card>

        <Card className="p-6">
          <div className="text-sm font-medium text-foreground">Últimas validações</div>
          {isLoading ? (
            <div className="mt-4 text-sm text-muted-foreground">Carregando histórico...</div>
          ) : error ? (
            <div className="mt-4 text-sm text-destructive">{(error as Error).message}</div>
          ) : validations.length === 0 ? (
            <div className="mt-4 text-sm text-muted-foreground">
              Nenhuma validação registrada ainda.
            </div>
          ) : (
            <ul className="mt-4 space-y-3 text-sm">
              {validations.map((validation) => (
                <RecentValidationItem key={validation.id} validation={validation} />
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function QrCameraScanner({
  disabled,
  onDetected,
}: {
  disabled: boolean;
  onDetected: (value: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!scanning) return undefined;

    let cancelled = false;
    let frame = 0;

    async function start() {
      const BarcodeDetector = getBarcodeDetector();
      if (!BarcodeDetector) {
        setMessage(
          "Leitor de QR não suportado neste navegador. Use Chrome no celular ou digite o número.",
        );
        setScanning(false);
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setMessage("Câmera indisponível neste navegador.");
        setScanning(false);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const detector = new BarcodeDetector({ formats: ["qr_code"] });
        const scan = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const value = codes[0]?.rawValue?.trim();
            if (value) {
              onDetected(value);
              setScanning(false);
              return;
            }
          } catch {
            setMessage("Não foi possível ler o QR Code. Tente aproximar ou melhorar a luz.");
          }
          frame = window.requestAnimationFrame(scan);
        };
        frame = window.requestAnimationFrame(scan);
      } catch {
        setMessage("Autorize o uso da câmera para escanear o QR Code.");
        setScanning(false);
      }
    }

    start();

    return () => {
      cancelled = true;
      if (frame) window.cancelAnimationFrame(frame);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [onDetected, scanning]);

  return (
    <div className="mt-3 rounded-2xl bg-white/10 p-4 ring-1 ring-white/20">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setMessage(null);
          setScanning((value) => !value);
        }}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/25 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-60"
      >
        <Camera className="h-4 w-4" />
        {scanning ? "Parar câmera" : "Escanear QR com câmera"}
      </button>
      {scanning && (
        <video
          ref={videoRef}
          muted
          playsInline
          className="mt-3 aspect-video w-full rounded-xl bg-black object-cover"
        />
      )}
      {message && <div className="mt-3 text-xs opacity-80">{message}</div>}
    </div>
  );
}

function ValidationResultPanel({ result }: { result: ValidationResult | null }) {
  if (!result) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface p-5 text-sm text-muted-foreground">
        O resultado aparecerá aqui após a validação.
      </div>
    );
  }

  if (!result.authorized) {
    return (
      <div className="rounded-xl border border-destructive/25 bg-destructive/10 p-5">
        <div className="flex items-center gap-3 text-destructive">
          <XCircle className="h-6 w-6" />
          <div>
            <div className="font-display text-2xl">Atendimento negado</div>
            <div className="text-sm">{result.reason ?? "Cartão inválido"}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-success/25 bg-success/10 p-5">
      <div className="flex items-start gap-3 text-success">
        <CheckCircle2 className="mt-1 h-6 w-6" />
        <div>
          <div className="font-display text-2xl">Atendimento autorizado</div>
          <div className="mt-2 grid gap-1 text-sm text-foreground sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground">Paciente: </span>
              {result.patient?.full_name ?? "Paciente"}
            </div>
            <div>
              <span className="text-muted-foreground">Cartão: </span>
              {result.card?.card_number ?? "Cartão digital"}
            </div>
            <div>
              <span className="text-muted-foreground">CPF: </span>
              {formatCpf(result.patient?.cpf)}
            </div>
            <div>
              <span className="text-muted-foreground">Status: </span>
              {result.patient?.status ?? "active"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RecentValidationItem({ validation }: { validation: RecentValidation }) {
  const approved = validation.outcome === "approved";
  const patient = validation.benefit_cards?.patients;
  const title = patient?.full_name ?? "Token não encontrado";
  const subtitle = approved
    ? validation.benefit_cards?.card_number
    : validation.reason || validation.qr_token_snapshot || "Negado";

  return (
    <li className="flex items-start justify-between gap-3 border-b border-border/60 pb-3 last:border-0">
      <div className="min-w-0">
        <div className="truncate text-foreground">{title}</div>
        <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          {formatDateTime(validation.validated_at)}
        </div>
      </div>
      <span
        className={`rounded-md px-2 py-0.5 text-xs ${
          approved ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
        }`}
      >
        {approved ? "autorizado" : "negado"}
      </span>
    </li>
  );
}

function formatCpf(cpf?: string | null) {
  if (!cpf) return "Sem CPF";
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getBarcodeDetector() {
  return (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
}
