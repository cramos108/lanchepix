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
import { APP_NAME } from "@/lib/brand";
import { formatMoney } from "@/lib/money";
import { getCurrency } from "@/lib/prefs";
import { printQrCardOnly } from "@/lib/printDocument";
import { toast } from "@/lib/toast";

export type ProductStickerHandle = {
  print: () => void;
};

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
  }
>(function ProductSticker(
  { name, priceCents, payload, storeName, suggested, imageData, category },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imgSrc, setImgSrc] = useState("");

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
    print() {
      const src = rasterize();
      if (src) {
        flushSync(() => setImgSrc(src));
      }
      if (!src || !src.startsWith("data:image/")) {
        toast("Não foi possível gerar o QR para impressão.", "err");
        return;
      }
      printQrCardOnly();
    },
  }));

  return (
    <div
      id="qr-card-only"
      className="printable-qr-card mx-auto w-full max-w-[320px] rounded-[28px] border-4 border-black bg-white p-5 text-center text-black"
    >
      {storeName ? (
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-black">
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
      <p className="mt-4 text-sm font-extrabold leading-snug">
        {APP_NAME} • Escaneie e fale no WhatsApp para pagar no Pix!
      </p>
    </div>
  );
});

ProductSticker.displayName = "ProductSticker";
