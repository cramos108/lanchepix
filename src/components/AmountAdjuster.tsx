"use client";

import { useSyncExternalStore } from "react";
import { Price } from "@/components/Money";
import { centsToInput, currencySymbol, parseMoneyToCents } from "@/lib/money";
import { getCurrency, subscribePrefs } from "@/lib/prefs";
import { inputClass } from "@/components/ui";

export function AmountAdjuster({
  baseCents,
  extraCents,
  onChange,
  suggested,
  locked,
}: {
  baseCents: number;
  extraCents: number;
  onChange: (extraCents: number) => void;
  suggested?: boolean;
  locked?: boolean;
}) {
  const currency = useSyncExternalStore(subscribePrefs, getCurrency, () => "BRL" as const);
  const total = Math.max(0, baseCents + extraCents);
  const symbol = currencySymbol(currency);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-bold text-muted">
        {suggested ? "Contribuição sugerida" : "Valor"}{" "}
        <span className="text-white">
          <Price cents={baseCents} />
        </span>
      </p>
      <p className="text-xs font-extrabold uppercase tracking-widest text-sun">
        Ajuste rápido
      </p>
      <div className="grid grid-cols-3 gap-2">
        {[100, 200, 500].map((n) => (
          <button
            key={n}
            type="button"
            disabled={locked}
            onClick={() => onChange(extraCents + n)}
            className={`min-h-12 rounded-2xl border-2 border-sun bg-sun/15 text-sm font-black text-sun ${
              locked ? "opacity-50" : ""
            }`}
          >
            +{symbol} {n / 100}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-extrabold uppercase tracking-widest text-sun">
          {symbol}
        </span>
        <input
          className={inputClass}
          inputMode="decimal"
          value={centsToInput(total, currency)}
          disabled={locked}
          onChange={(e) => onChange(parseMoneyToCents(e.target.value) - baseCents)}
        />
      </label>
      {extraCents !== 0 ? (
        <p className={`text-sm font-extrabold ${extraCents > 0 ? "text-mint" : "text-amber"}`}>
          Gorjeta / extra: {extraCents > 0 ? "+" : ""}
          <Price cents={extraCents} />
        </p>
      ) : null}
    </div>
  );
}
