export type Lang = "pt" | "en" | "es";
export type AppCurrency = "BRL" | "USD" | "EUR";
export type PayMethod = "pix" | "cash" | "link";

export function detectBrowserLang(): Lang {
  return "pt";
}

export function normalizeLang(_value?: string | null): Lang {
  return "pt";
}

export function normalizeCurrency(value?: string | null): AppCurrency {
  if (value === "USD" || value === "EUR") return value;
  return "BRL";
}
