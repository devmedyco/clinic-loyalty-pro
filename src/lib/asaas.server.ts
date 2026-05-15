type AsaasEnvironment = "sandbox" | "production";

type AsaasCustomerInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  cpfCnpj?: string | null;
};

type AsaasPaymentInput = {
  customer: string;
  billingType: "PIX" | "BOLETO" | "CREDIT_CARD";
  value: number;
  dueDate: string;
  description: string;
  externalReference: string;
};

export type AsaasCustomer = {
  id: string;
  name?: string;
};

export type AsaasPayment = {
  id: string;
  status?: string;
  value?: number;
  dueDate?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  pixQrCode?: string;
  payload?: string;
};

const BASE_URLS: Record<AsaasEnvironment, string> = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  production: "https://api.asaas.com/v3",
};

export function isAsaasConfigured() {
  return Boolean(process.env.ASAAS_API_KEY);
}

export async function createAsaasCustomer(input: AsaasCustomerInput) {
  return asaasRequest<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify(removeEmptyValues(input)),
  });
}

export async function createAsaasPayment(input: AsaasPaymentInput) {
  return asaasRequest<AsaasPayment>("/payments", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

async function asaasRequest<T>(path: string, init: RequestInit) {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) {
    throw new Error("Asaas ainda não configurado. Adicione ASAAS_API_KEY nos secrets.");
  }

  const environment = getEnvironment();
  const response = await fetch(`${BASE_URLS[environment]}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
      ...(init.headers ?? {}),
    },
  });

  const body = await safeJson(response);
  if (!response.ok) {
    throw new Error(formatAsaasError(body, response.status));
  }

  return body as T;
}

function getEnvironment(): AsaasEnvironment {
  return process.env.ASAAS_ENVIRONMENT === "production" ? "production" : "sandbox";
}

function removeEmptyValues<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ""),
  ) as Partial<T>;
}

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function formatAsaasError(body: unknown, status: number) {
  if (isAsaasErrorBody(body)) {
    return body.errors.map((item) => item.description).join(" ");
  }
  return `Asaas retornou erro ${status}.`;
}

function isAsaasErrorBody(body: unknown): body is { errors: Array<{ description: string }> } {
  return (
    typeof body === "object" &&
    body !== null &&
    "errors" in body &&
    Array.isArray((body as { errors?: unknown }).errors)
  );
}
