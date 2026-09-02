import type { AppCurrency, Lang } from "./locale";
import { detectBrowserLang, normalizeCurrency, normalizeLang } from "./locale";

type Prefs = { currency: AppCurrency; language: Lang };

let prefs: Prefs = { currency: "BRL", language: "pt" };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function getCurrency(): AppCurrency {
  return prefs.currency;
}

export function getLanguage(): Lang {
  return prefs.language;
}

export function setPrefs(next: { currency?: string | null; language?: string | null }): void {
  const currency = next.currency != null ? normalizeCurrency(next.currency) : prefs.currency;
  const language = next.language != null ? normalizeLang(next.language) : prefs.language;
  if (currency === prefs.currency && language === prefs.language) return;
  prefs = { currency, language };
  emit();
}

export function bootPrefsFromBrowser(): void {
  if (prefs.language === "pt") {
    prefs = { ...prefs, language: detectBrowserLang() };
  }
}

export function subscribePrefs(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
