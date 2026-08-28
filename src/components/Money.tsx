"use client";

import { useSyncExternalStore } from "react";
import { formatBRL } from "@/lib/money";
import { getHideBalances, subscribeHideBalances } from "@/lib/privacy";

export function useHideBalances(): boolean {
  return useSyncExternalStore(subscribeHideBalances, getHideBalances, () => true);
}

export function useMoney() {
  const hide = useHideBalances();
  return (cents: number) => (hide ? "R$ ••••" : formatBRL(cents));
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
  return (
    <span className={`tabular-nums ${className ?? ""}`.trim()}>{formatBRL(cents)}</span>
  );
}
