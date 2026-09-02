import type { AppCurrency } from "./locale";

export type { AppCurrency };

const LOCALE: Record<AppCurrency, string> = {
  BRL: "pt-BR",
  USD: "en-US",
  EUR: "de-DE",
};

export function formatMoney(cents: number, currency: AppCurrency = "BRL"): string {
  return (cents / 100).toLocaleString(LOCALE[currency], {
    style: "currency",
    currency,
  });
}

export function formatBRL(cents: number): string {
  return formatMoney(cents, "BRL");
}

export function currencySymbol(currency: AppCurrency = "BRL"): string {
  if (currency === "USD") return "$";
  if (currency === "EUR") return "€";
  return "R$";
}

/** Converte texto como "8,50", "R$ 8.50" ou "8" em centavos. */
export function parseMoneyToCents(input: string): number {
  const raw = input.trim().replace(/[^\d,.-]/g, "");
  if (!raw) return 0;
  let normalized = raw;
  if (raw.includes(",")) {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if ((raw.match(/\./g) ?? []).length > 1) {
    normalized = raw.replace(/\./g, "");
  }
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 100);
}

export function parseBRLToCents(input: string): number {
  return parseMoneyToCents(input);
}

export function centsToInput(cents: number, currency: AppCurrency = "BRL"): string {
  const n = (cents / 100).toFixed(2);
  return currency === "BRL" ? n.replace(".", ",") : n;
}

export function formatPixAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}
