"use client";

import { QRCodeSVG } from "qrcode.react";
import { ProductThumb } from "@/components/ProductThumb";
import { APP_NAME } from "@/lib/brand";
import { formatBRL } from "@/lib/money";

export function ProductSticker({
  name,
  priceCents,
  payload,
  storeName,
  suggested,
  imageData,
  category,
}: {
  name: string;
  priceCents: number;
  payload: string;
  storeName?: string;
  suggested?: boolean;
  imageData?: string;
  category?: string;
}) {
  return (
    <div className="label-sticker mx-auto w-full max-w-[320px] rounded-[28px] border-4 border-black bg-white p-5 text-center text-black">
      {storeName ? (
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-700">
          {storeName}
        </p>
      ) : null}
      <div className="mx-auto mt-2 flex justify-center">
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
          Contribuição Sugerida: {formatBRL(priceCents)}
        </p>
      ) : (
        <p className="mt-1 text-3xl font-black tabular-nums">{formatBRL(priceCents)}</p>
      )}
      <div className="mx-auto mt-4 flex justify-center rounded-2xl bg-white p-2">
        <QRCodeSVG
          value={payload}
          size={240}
          bgColor="#ffffff"
          fgColor="#000000"
          level="H"
          includeMargin={false}
        />
      </div>
      <p className="mt-4 text-sm font-extrabold leading-snug">
        {APP_NAME} • Gostou? Pague depois pelo Pix!
      </p>
    </div>
  );
}
