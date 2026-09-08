"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { QRCodeCanvas } from "qrcode.react";
import { ProductThumb } from "@/components/ProductThumb";
import { formatMoney } from "@/lib/money";
import { getCurrency } from "@/lib/prefs";
import {
  fillQrPrintWorkspace,
  openQrPrintWorkspace,
} from "@/lib/printDocument";
import { DEFAULT_QR_FOOTER, normalizeInstagramHandle } from "@/lib/qrBrand";
import { toast } from "@/lib/toast";

export type ProductStickerHandle = {
  print: (workspace?: Window | null) => void;
};

function InstagramMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      aria-hidden
      className="inline-block"
    >
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="5"
        fill="none"
        stroke="#000"
        strokeWidth="2"
      />
      <circle cx="12" cy="12" r="4" fill="none" stroke="#000" strokeWidth="2" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="#000" />
    </svg>
  );
}

export const ProductSticker = forwardRef<
  ProductStickerHandle,
  {
    name: string;
    priceCents: number;
    payload: string;
    storeName?: string;
    suggested?: boolean;
    imageData?: string;
    category?: string;
    premium?: boolean;
    logoUrl?: string;
    instagramHandle?: string;
    customFooter?: string;
    onCustomize?: () => void;
  }
>(function ProductSticker(
  {
    name,
    priceCents,
    payload,
    storeName,
    suggested,
    imageData,
    category,
    premium,
    logoUrl,
    instagramHandle,
    customFooter,
    onCustomize,
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imgSrc, setImgSrc] = useState("");
  const handle = normalizeInstagramHandle(instagramHandle || "");
  const branded = Boolean(premium);
  const footer = branded && customFooter?.trim()
    ? customFooter.trim()
    : DEFAULT_QR_FOOTER;

  function rasterize(): string {
    const canvas = canvasRef.current;
    if (!canvas) return imgSrc;
    try {
      return canvas.toDataURL("image/png");
    } catch {
      return imgSrc;
    }
  }

  useEffect(() => {
    setImgSrc("");
    const id = window.setTimeout(() => {
      const src = rasterize();
      if (src) setImgSrc(src);
    }, 60);
    return () => window.clearTimeout(id);
  }, [payload]);

  useImperativeHandle(ref, () => ({
    print(workspace) {
      const popup =
        workspace && !workspace.closed ? workspace : openQrPrintWorkspace();
      const src = rasterize();
      if (src) {
        flushSync(() => setImgSrc(src));
      }
      if (!src || !src.startsWith("data:image/")) {
        toast("Não foi possível gerar o QR para impressão.", "err");
        try {
          popup?.close();
        } catch {
          /* ignore */
        }
        return;
      }
      fillQrPrintWorkspace(popup, name);
    },
  }));

  return (
    <div className="flex flex-col gap-3">
      <div
        id="qr-card-only"
        className="printable-qr-card mx-auto w-full max-w-[320px] rounded-[28px] border-4 border-black bg-white p-5 text-center text-black"
      >
        {branded && logoUrl ? (
          <img
            src={logoUrl}
            alt={storeName || name}
            className="qr-brand-logo mx-auto mb-2 h-[72px] w-[72px] object-contain"
          />
        ) : storeName ? (
          <p
            className={
              branded
                ? "qr-store-premium text-[18px] font-bold leading-tight text-black"
                : "text-[11px] font-black uppercase tracking-[0.18em] text-black"
            }
            style={
              branded
                ? { fontFamily: 'Georgia, "Times New Roman", serif' }
                : undefined
            }
          >
            {storeName}
          </p>
        ) : null}
        <div className="qr-preview-only mx-auto mt-2 flex justify-center">
          <ProductThumb
            imageData={imageData}
            category={category ?? "Outros"}
            name={name}
            size="sm"
          />
        </div>
        <p className="mt-2 text-2xl font-black leading-tight">{name}</p>
        {suggested ? (
          <p className="mt-1 text-lg font-black leading-tight">
            Contribuição Sugerida: {formatMoney(priceCents, getCurrency())}
          </p>
        ) : (
          <p className="mt-1 text-3xl font-black tabular-nums">
            {formatMoney(priceCents, getCurrency())}
          </p>
        )}
        {branded && handle ? (
          <p className="qr-instagram mt-2 flex items-center justify-center gap-1.5 text-sm font-extrabold text-black">
            <InstagramMark />
            {handle}
          </p>
        ) : null}
        <div className="mx-auto mt-4 flex justify-center bg-white p-2">
          <QRCodeCanvas
            ref={canvasRef}
            value={payload}
            size={250}
            bgColor="#ffffff"
            fgColor="#000000"
            level="H"
            includeMargin
            className={
              imgSrc ? "qr-print-source hidden" : "mx-auto block h-[250px] w-[250px]"
            }
          />
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={`QR ${name}`}
              width={250}
              height={250}
              className="printable-qr-img mx-auto block h-[250px] w-[250px]"
            />
          ) : null}
        </div>
        <p className="mt-4 text-sm font-extrabold leading-snug">{footer}</p>
      </div>
      {!branded && onCustomize ? (
        <button
          type="button"
          onClick={onCustomize}
          className="text-center text-xs font-bold text-muted underline decoration-sun/70 underline-offset-4 hover:text-sun"
        >
          Personalizar com minha marca/Instagram
        </button>
      ) : null}
    </div>
  );
});

ProductSticker.displayName = "ProductSticker";
