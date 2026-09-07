"use client";

import type { BillingInterval } from "@/lib/plan";

export function BillingToggle({
  value,
  onChange,
  dark,
}: {
  value: BillingInterval;
  onChange: (next: BillingInterval) => void;
  dark?: boolean;
}) {
  const track = dark
    ? "border-white/15 bg-[#1E293B]"
    : "border-line bg-surface2";
  const on = dark ? "bg-[#FACC15] text-slate-950" : "bg-sun text-sunink";
  const off = dark ? "text-slate-300" : "text-muted";
  return (
    <div className={`flex rounded-2xl border-2 p-1 ${track}`}>
      <button
        type="button"
        onClick={() => onChange("month")}
        className={`min-h-10 flex-1 rounded-xl px-3 text-xs font-black uppercase ${
          value === "month" ? on : off
        }`}
      >
        Mensal
      </button>
      <button
        type="button"
        onClick={() => onChange("year")}
        className={`min-h-10 flex-1 rounded-xl px-3 text-xs font-black uppercase ${
          value === "year" ? on : off
        }`}
      >
        Anual (2 meses grátis)
      </button>
    </div>
  );
}
