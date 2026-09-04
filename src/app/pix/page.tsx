"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { MessageCircle, Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { PixQr } from "@/components/PixQr";
import { Button, EmptyState } from "@/components/ui";
import { db } from "@/lib/db";
import { sellableCatalogProducts } from "@/lib/unique";
import { formatMoney } from "@/lib/money";
import { normalizeCurrency, normalizeLang } from "@/lib/locale";
import { isOwnerDevice, isStaffDevice, readLocalPixKey } from "@/lib/account";
import { useMasterSettings } from "@/components/MasterSettingsProvider";
import { useLang, useT } from "@/lib/i18n";
import { buildPixPayload, detectPixKeyType, normalizePixKey } from "@/lib/pix";
import { refetchOwnerSettings } from "@/lib/sync";
import { orderReceiptMessage, waLink } from "@/lib/whatsapp";

export default function PixPage() {
  const t = useT();
  const lang = useLang();
  const master = useMasterSettings();
  const settings = useLiveQuery(() => db.settings.get("app"), []);
  const products = useLiveQuery(
    () => db.products.toArray().then(sellableCatalogProducts),
    [],
  );
  const [selectedId, setSelectedId] = useState<string>("livre");

  useEffect(() => {
    if (master.isPaired) return;
    void refetchOwnerSettings().catch(() => undefined);
  }, [master.isPaired]);

  const pixKey = (readLocalPixKey(settings) || master.pixKey || "").trim();
  const whatsapp = (settings?.whatsapp || master.whatsapp || "").trim();
  const merchantName =
    settings?.merchantName || master.merchantName || settings?.storeName || "";
  const merchantCity = settings?.merchantCity || master.merchantCity || "";
  const currency = normalizeCurrency(
    master.isPaired ? master.currency : settings?.currency,
  );
  const selectedProduct = products?.find((p) => p.id === selectedId);

  const payload = useMemo(() => {
    if (!pixKey) return "";
    try {
      return buildPixPayload({
        pixKey,
        merchantName,
        merchantCity,
        amountCents:
          selectedProduct?.priceMode === "suggested" ? undefined : selectedProduct?.priceCents,
        description: selectedProduct?.name ?? merchantName,
        txid: "***",
      });
    } catch {
      return "";
    }
  }, [pixKey, merchantName, merchantCity, selectedProduct]);

  const waUrl = whatsapp
    ? waLink(
        whatsapp,
        orderReceiptMessage({
          lang: normalizeLang(master.language || settings?.language || lang),
          currency,
          productName: selectedProduct?.name || merchantName || "Pix",
          quantity: 1,
          totalCents: selectedProduct?.priceCents ?? 0,
          method: "pix",
          sellerName: settings?.storeName || merchantName,
          pixKey,
        }),
      )
    : "";

  if (!settings) {
    return <p className="text-muted">{t("loading")}</p>;
  }

  const money = (cents: number) => formatMoney(cents, currency);

  if (
    !pixKey &&
    isOwnerDevice(settings) &&
    !isStaffDevice(settings) &&
    !master.isPaired
  ) {
      return (
        <EmptyState
          title="Cadastre sua chave Pix"
          text="Sem a chave não dá para gerar o QR. Leva 10 segundos nas configurações."
          action={
            <Link
              href="/configuracoes"
              className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-sun px-5 text-base font-extrabold uppercase text-sunink"
            >
              Ir para configurações
            </Link>
          }
        />
      );
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-3xl border-2 border-line bg-surface p-4">
        <p className="text-xs font-extrabold uppercase tracking-widest text-sun">
          {detectPixKeyType(pixKey)}
        </p>
        <p className="break-all text-lg font-black">{normalizePixKey(pixKey)}</p>
        <p className="text-sm font-bold text-muted">
          {merchantName} · {merchantCity}
        </p>
      </section>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        <Chip
          active={selectedId === "livre"}
          onClick={() => setSelectedId("livre")}
          label="Valor livre"
        />
        {products?.map((p) => (
          <Chip
            key={p.id}
            active={selectedId === p.id}
            onClick={() => setSelectedId(p.id)}
            label={`${p.name} ${money(p.priceCents)}`}
          />
        ))}
      </div>

      {payload ? (
        <PixQr
          payload={payload}
          size={260}
          label={
            selectedProduct
              ? `${selectedProduct.name} · ${money(selectedProduct.priceCents)}`
              : t("pay.scanPix")
          }
        />
      ) : master.isPaired || isStaffDevice(settings) ? null : (
        <p className="text-alert">{t("warn.pixOwner")}</p>
      )}

      {waUrl ? (
        <a
          href={waUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-mint bg-mint px-4 text-base font-extrabold uppercase text-sunink"
        >
          <MessageCircle className="h-5 w-5" />
          {t("pay.proof")}
        </a>
      ) : null}

      <Button onClick={() => window.print()}>
        <Printer className="h-5 w-5" />
        Imprimir etiquetas
      </Button>

      <section className="print-labels hidden print:block">
        <div className="grid grid-cols-2 gap-4 text-black">
          {(products ?? []).map((p) => {
            let code = "";
            try {
              code = buildPixPayload({
                pixKey,
                merchantName,
                merchantCity,
                amountCents: p.priceMode === "suggested" ? undefined : p.priceCents,
                description: p.name,
              });
            } catch {
              return null;
            }
            return (
              <article
                key={p.id}
                className="break-inside-avoid rounded-xl border-2 border-black bg-white p-3 text-center"
              >
                <p className="text-xs font-bold uppercase">{settings.storeName}</p>
                <p className="text-lg font-black">{p.name}</p>
                <p className="mb-2 text-xl font-black">
                  {p.priceMode === "suggested"
                    ? `Contribuição Sugerida: ${money(p.priceCents)}`
                    : money(p.priceCents)}
                </p>
                <div className="flex justify-center">
                  <QRCodeSVG value={code} size={140} bgColor="#fff" fgColor="#000" level="M" />
                </div>
                <p className="mt-2 text-[10px]">Pix · {detectPixKeyType(pixKey)}</p>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 shrink-0 rounded-full border-2 px-4 text-sm font-extrabold ${
        active ? "border-sun bg-sun text-sunink" : "border-line bg-surface text-white"
      }`}
    >
      {label}
    </button>
  );
}
