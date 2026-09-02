export type Lang = "pt" | "en" | "es";
export type AppCurrency = "BRL" | "USD" | "EUR";
export type PayMethod = "pix" | "cash" | "link";

export function detectBrowserLang(): Lang {
  try {
    const loc = (navigator.language || "").toLowerCase();
    if (loc.startsWith("en")) return "en";
    if (loc.startsWith("es")) return "es";
  } catch {
    /* ssr / private mode */
  }
  return "pt";
}

export function normalizeLang(value?: string | null): Lang {
  if (value === "en" || value === "es" || value === "pt") return value;
  return detectBrowserLang();
}

export function normalizeCurrency(value?: string | null): AppCurrency {
  if (value === "USD" || value === "EUR") return value;
  return "BRL";
}
