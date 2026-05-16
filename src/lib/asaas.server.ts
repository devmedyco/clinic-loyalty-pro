type AsaasEnvironment = "sandbox" | "production";

type AsaasCustomerInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  cpfCnpj?: string | null;
  apiKey?: string;
};

export type AsaasSplitInput = {
  walletId: string;
  fixedValue?: number;
  percentualValue?: number;
};

type AsaasPaymentInput = {
  customer: string;
  billingType: "PIX" | "BOLETO" | "CREDIT_CARD";
  value: number;
  dueDate: string;
  description: string;
  externalReference: string;
  split?: AsaasSplitInput[];
  apiKey?: string;
};

type AsaasSubaccountInput = {
  name: string;
  email: string;
  loginEmail?: string | null;
  cpfCnpj: string;
  birthDate?: string | null;
  companyType?: "MEI" | "LIMITED" | "INDIVIDUAL" | "ASSOCIATION" | null;
  phone?: string | null;
  mobilePhone: string;
  site?: string | null;
  incomeValue: number;
  address: string;
  addressNumber: string;
  complement?: string | null;
  province: string;
  postalCode: string;
};

export type AsaasCustomer = {
  id: string;
  name?: string;
};

export type AsaasPayment = {
  id: string;
  status?: string;
  value?: number;
  netValue?: number;
  dueDate?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  pixQrCode?: string;
  payload?: string;
  split?: Array<{
    id?: string;
    walletId?: string;
    percentualValue?: number;
    fixedValue?: number;
    status?: string;
    totalValue?: number;
    netValue?: number;
  }>;
};

export type AsaasSubaccount = {
  id: string;
  name?: string;
  email?: string;
  apiKey?: string;
  walletId?: string;
  accountNumber?: string;
};

const BASE_URLS: Record<AsaasEnvironment, string> = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  production: "https://api.asaas.com/v3",
};

export function isAsaasConfigured() {
  return Boolean(process.env.ASAAS_API_KEY);
}

export function isAsaasMarketplaceConfigured() {
  return Boolean(process.env.ASAAS_API_KEY && process.env.ASAAS_MEDYCO_WALLET_ID);
}

export async function createAsaasCustomer(input: AsaasCustomerInput) {
  const { apiKey, ...body } = input;
  return asaasRequest<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify(removeEmptyValues(body)),
    apiKey,
  });
}

export async function createAsaasPayment(input: AsaasPaymentInput) {
  const { apiKey, ...body } = input;
  return asaasRequest<AsaasPayment>("/payments", {
    method: "POST",
    body: JSON.stringify(removeEmptyValues(body)),
    apiKey,
  });
}

export async function createAsaasSubaccount(input: AsaasSubaccountInput) {
  return asaasRequest<AsaasSubaccount>("/accounts", {
    method: "POST",
    body: JSON.stringify(removeEmptyValues(input)),
  });
}

async function asaasRequest<T>(path: string, init: RequestInit & { apiKey?: string }) {
  const { apiKey: requestApiKey, ...requestInit } = init;
  const apiKey = requestApiKey || process.env.ASAAS_API_KEY;
  if (!apiKey) {
    throw new Error("Asaas ainda não configurado. Adicione ASAAS_API_KEY nos secrets.");
  }

  const environment = getEnvironment();
  const response = await fetch(`${BASE_URLS[environment]}${path}`, {
    ...requestInit,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
      ...(requestInit.headers ?? {}),
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
