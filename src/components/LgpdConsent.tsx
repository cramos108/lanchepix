"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";

export function LgpdConsent({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const t = useT();
  return (
    <label className="flex items-start gap-3 rounded-2xl border-2 border-line bg-surface2 p-3">
      <input
        type="checkbox"
        className="mt-1 h-6 w-6 shrink-0 accent-sun"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-sm font-bold leading-snug text-muted">
        {t("lgpd")}{" "}
        <Link href="/termos" className="text-sun underline">
          {t("lgpd.terms")}
        </Link>
      </span>
    </label>
  );
}
