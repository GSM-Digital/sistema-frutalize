export function quantity(value: number, unit?: string) {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 6 }).format(value)}${unit ? ` ${unit}` : ""}`;
}
export function shortDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value));
}
export function dateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
export function money(value: number, digits = 2) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  }).format(value);
}
