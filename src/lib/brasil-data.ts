export type AddressLookup = {
  zip_code: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
};

export type CnpjLookup = AddressLookup & {
  cnpj: string;
  name: string;
  legal_name: string;
  email: string;
  phone: string;
  number: string;
  complement: string;
};

export async function lookupCnpj(value: string): Promise<CnpjLookup> {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14) throw new Error("Informe um CNPJ com 14 dígitos.");

  const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
  if (!response.ok) throw new Error("Não encontrei dados para este CNPJ.");
  const data = await response.json();

  return {
    cnpj,
    name: data.nome_fantasia || data.razao_social || "",
    legal_name: data.razao_social || data.nome_fantasia || "",
    email: data.email || "",
    phone: [data.ddd_telefone_1, data.ddd_telefone_2].filter(Boolean)[0] || "",
    zip_code: onlyDigits(data.cep || ""),
    street: data.logradouro || "",
    number: data.numero || "",
    complement: data.complemento || "",
    neighborhood: data.bairro || "",
    city: data.municipio || "",
    state: data.uf || "",
  };
}

export async function lookupCep(value: string): Promise<AddressLookup> {
  const cep = onlyDigits(value);
  if (cep.length !== 8) throw new Error("Informe um CEP com 8 dígitos.");

  const brasilApi = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`);
  if (brasilApi.ok) {
    const data = await brasilApi.json();
    return {
      zip_code: cep,
      street: data.street || "",
      neighborhood: data.neighborhood || "",
      city: data.city || "",
      state: data.state || "",
    };
  }

  const viaCep = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  if (!viaCep.ok) throw new Error("Não encontrei este CEP.");
  const data = await viaCep.json();
  if (data.erro) throw new Error("Não encontrei este CEP.");
  return {
    zip_code: cep,
    street: data.logradouro || "",
    neighborhood: data.bairro || "",
    city: data.localidade || "",
    state: data.uf || "",
  };
}

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
