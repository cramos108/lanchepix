"use client";

import { useSyncExternalStore } from "react";
import { currencySymbol, formatMoney } from "@/lib/money";
import { getCurrency, subscribePrefs } from "@/lib/prefs";
import { getHideBalances, subscribeHideBalances } from "@/lib/privacy";

export function useHideBalances(): boolean {
  return useSyncExternalStore(subscribeHideBalances, getHideBalances, () => true);
}

function useCurrency() {
  return useSyncExternalStore(subscribePrefs, getCurrency, () => "BRL" as const);
}

export function useMoney() {
  const hide = useHideBalances();
  const currency = useCurrency();
  return (cents: number) =>
    hide ? `${currencySymbol(currency)} ••••` : formatMoney(cents, currency);
}

/** Personal financial metric — respects the header eye toggle. */
export function Money({
  cents,
  className,
}: {
  cents: number;
  className?: string;
}) {
  const money = useMoney();
  return (
    <span className={`tabular-nums ${className ?? ""}`.trim()}>{money(cents)}</span>
  );
}

/** Catalog / tag / sticker / checkout unit prices — always visible. */
export function Price({
  cents,
  className,
}: {
  cents: number;
  className?: string;
}) {
  const currency = useCurrency();
  return (
    <span className={`tabular-nums ${className ?? ""}`.trim()}>
      {formatMoney(cents, currency)}
    </span>
  );
}
