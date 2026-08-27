"use client";

import Link from "next/link";

export function LgpdConsent({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border-2 border-line bg-surface2 p-3">
      <input
        type="checkbox"
        className="mt-1 h-6 w-6 shrink-0 accent-sun"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-sm font-bold leading-snug text-muted">
        Concordo com os termos da LGPD para controle de fidelidade e fiado.{" "}
        <Link href="/termos" className="text-sun underline">
          Termos
        </Link>
      </span>
    </label>
  );
}
