const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT === "production" ? "production" : "sandbox";
const CONFIRM = process.env.CONFIRM_DELETE_ASAAS_SUBACCOUNTS === "SIM";

const BASE_URLS = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  production: "https://api.asaas.com/v3",
};

const BASE_URL = BASE_URLS[ASAAS_ENVIRONMENT];
const USER_AGENT =
  process.env.ASAAS_USER_AGENT || "Medyco/1.0 (+https://medyco.com.br; contato@medyco.com.br)";

if (!ASAAS_API_KEY) {
  console.error("Defina ASAAS_API_KEY com a chave da conta mae Asaas.");
  process.exit(1);
}

if (!CONFIRM) {
  console.error(
    "Por seguranca, defina CONFIRM_DELETE_ASAAS_SUBACCOUNTS=SIM para solicitar exclusao das subcontas.",
  );
  process.exit(1);
}

if (ASAAS_ENVIRONMENT === "production") {
  console.error("Este script foi feito para limpeza de sandbox. Nao execute em production.");
  process.exit(1);
}

const subaccounts = await listAllSubaccounts();
if (subaccounts.length === 0) {
  console.log("Nenhuma subconta encontrada no sandbox Asaas.");
  process.exit(0);
}

console.log(`Subcontas encontradas: ${subaccounts.length}`);

for (const account of subaccounts) {
  const accountId = account.id;
  const label = account.name || account.email || account.walletId || accountId;
  if (!accountId) {
    console.warn("Subconta sem id retornada pelo Asaas, pulando:", account);
    continue;
  }

  console.log(`Gerando chave temporaria para ${label} (${accountId})...`);
  const accessToken = await createSubaccountAccessToken(accountId);
  if (!accessToken) {
    throw new Error(`Asaas nao retornou a chave temporaria da subconta ${accountId}.`);
  }

  console.log(`Solicitando exclusao de ${label}...`);
  await deleteCurrentSubaccount(accessToken);
  console.log(`Exclusao solicitada para ${label}.`);
}

console.log("Processo concluido. Confira o painel sandbox do Asaas para confirmar a remocao.");

async function listAllSubaccounts() {
  const results = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const page = await asaasRequest(`/accounts?limit=${limit}&offset=${offset}`, {
      method: "GET",
      apiKey: ASAAS_API_KEY,
    });

    const data = Array.isArray(page?.data) ? page.data : [];
    results.push(...data);

    if (!page?.hasMore || data.length === 0) break;
    offset += limit;
  }

  return results;
}

async function createSubaccountAccessToken(accountId) {
  const expires = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const response = await asaasRequest(`/accounts/${accountId}/accessTokens`, {
    method: "POST",
    apiKey: ASAAS_API_KEY,
    body: JSON.stringify({
      name: `Medyco reset ${new Date().toISOString()}`,
      expirationDate: expires,
    }),
  });

  return (
    response?.accessToken ||
    response?.access_token ||
    response?.apiKey ||
    response?.token ||
    response?.key ||
    null
  );
}

async function deleteCurrentSubaccount(subaccountApiKey) {
  await asaasRequest("/myAccount/?removeReason=Reset%20de%20testes%20Medyco%20sandbox", {
    method: "DELETE",
    apiKey: subaccountApiKey,
  });
}

async function asaasRequest(path, init) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: init.method,
    body: init.body,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
      access_token: init.apiKey,
    },
  });

  const responseText = await response.text();
  const body = responseText ? safeJson(responseText) : null;

  if (!response.ok) {
    const detail = formatAsaasError(body) || responseText || `HTTP ${response.status}`;
    throw new Error(detail);
  }

  return body;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function formatAsaasError(body) {
  if (body && typeof body === "object" && Array.isArray(body.errors)) {
    return body.errors
      .map((item) => item.description || item.code)
      .filter(Boolean)
      .join(" ");
  }
  return null;
}
