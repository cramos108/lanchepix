"use client";

import { Star } from "lucide-react";

export function StampCard({
  filled,
  total = 10,
}: {
  filled: number;
  total?: number;
}) {
  const slots = Math.max(1, Math.min(12, total));
  return (
    <div className="rounded-3xl border-2 border-sun bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-sun">
          Cartão fidelidade
        </p>
        <p className="text-lg font-black tabular-nums">
          {Math.min(filled, slots)}/{slots}
        </p>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: slots }, (_, index) => {
          const on = index < filled;
          return (
            <div
              key={index}
              className={`grid aspect-square place-items-center rounded-full border-4 ${
                on
                  ? "border-sunink bg-sun text-sunink"
                  : "border-sun/80 bg-ink text-sun"
              }`}
              aria-label={on ? `Carimbo ${index + 1} preenchido` : `Vazio ${index + 1}`}
            >
              {on ? (
                <Star className="h-6 w-6 fill-current" />
              ) : (
                <span className="text-sm font-black">{index + 1}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
