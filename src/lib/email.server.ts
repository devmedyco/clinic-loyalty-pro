type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

type SendEmailResult =
  | { sent: true; providerId?: string }
  | { sent: false; reason: "missing_resend_api_key" | "resend_error"; error?: string };

const RESEND_API_URL = "https://api.resend.com/emails";

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = getEnv("RESEND_API_KEY");
  const from = getEnv("EMAIL_FROM") || "Medyco <no-reply@medyco.com.br>";

  if (!apiKey) return { sent: false, reason: "missing_resend_api_key" };

  let response: Response;
  try {
    response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
  } catch (error) {
    return {
      sent: false,
      reason: "resend_error",
      error: error instanceof Error ? error.message : "Falha de conexão com Resend",
    };
  }

  const payload = (await response.json().catch(() => null)) as {
    id?: string;
    message?: string;
    name?: string;
  } | null;

  if (!response.ok) {
    return {
      sent: false,
      reason: "resend_error",
      error: payload?.message ?? payload?.name ?? `HTTP ${response.status}`,
    };
  }

  return { sent: true, providerId: payload?.id };
}

function getEnv(name: string) {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[
    name
  ];
}
