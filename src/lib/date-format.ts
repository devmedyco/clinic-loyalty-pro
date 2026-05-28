export function formatDateOnly(value?: string | null, options?: Intl.DateTimeFormatOptions) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    ...options,
  }).format(new Date(normalizeDateOnly(value)));
}

export function formatDateTime(value?: string | null, options?: Intl.DateTimeFormatOptions) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    ...options,
  }).format(new Date(value));
}

function normalizeDateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value;
}
