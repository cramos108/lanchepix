"use client";

import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n";

export function PixQr({
  payload,
  size = 240,
  label,
}: {
  payload: string;
  size?: number;
  label?: string;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      toast("Código Pix copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Não deu para copiar. Selecione o texto.", "err");
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {label ? (
        <p className="text-center text-sm font-extrabold uppercase tracking-widest text-sun">
          {label}
        </p>
      ) : null}
      <div className="rounded-3xl bg-white p-4 shadow-[0_0_0_4px_#ffe500]">
        <QRCodeSVG
          value={payload}
          size={size}
          bgColor="#ffffff"
          fgColor="#000000"
          level="M"
          includeMargin={false}
        />
      </div>
      <button
        type="button"
        onClick={copy}
        className="w-full rounded-2xl border-2 border-line bg-surface2 px-3 py-3 text-left"
      >
        <p className="text-xs font-extrabold uppercase tracking-widest text-sun">
          {t("pay.copyCode")} {copied ? `· ${t("pay.copied")}` : ""}
        </p>
        <p className="mt-1 break-all font-mono text-[11px] leading-snug text-muted">
          {payload}
        </p>
      </button>
    </div>
  );
}
