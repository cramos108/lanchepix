"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { PixQr } from "@/components/PixQr";
import { Button, EmptyState } from "@/components/ui";
import { db } from "@/lib/db";
import { sellableCatalogProducts } from "@/lib/unique";
import { formatMoney } from "@/lib/money";
import { normalizeCurrency } from "@/lib/locale";
import { isStaffDevice } from "@/lib/account";
import { useT } from "@/lib/i18n";
import { buildPixPayload, detectPixKeyType, normalizePixKey } from "@/lib/pix";
import { refetchOwnerSettings } from "@/lib/sync";

export default function PixPage() {
  const t = useT();
  const settings = useLiveQuery(() => db.settings.get("app"), []);
  const products = useLiveQuery(
    () => db.products.toArray().then(sellableCatalogProducts),
    [],
  );
  const [selectedId, setSelectedId] = useState<string>("livre");
  const [settingsReady, setSettingsReady] = useState(false);

  useEffect(() => {
    void refetchOwnerSettings()
      .catch(() => undefined)
      .finally(() => setSettingsReady(true));
  }, []);

  const selectedProduct = products?.find((p) => p.id === selectedId);

  const payload = useMemo(() => {
    if (!settings?.pixKey) return "";
    try {
      return buildPixPayload({
        pixKey: settings.pixKey,
        merchantName: settings.merchantName || settings.storeName,
        merchantCity: settings.merchantCity,
        amountCents:
          selectedProduct?.priceMode === "suggested"
            ? undefined
            : selectedProduct?.priceCents,
        description: selectedProduct?.name ?? settings.storeName,
        txid: "***",
      });
    } catch {
      return "";
    }
  }, [settings, selectedProduct]);

  if (!settings || !settingsReady) {
    return <p className="text-muted">{t("loading")}</p>;
  }

  const money = (cents: number) => formatMoney(cents, normalizeCurrency(settings.currency));

  if (!settings.pixKey) {
    if (isStaffDevice(settings)) {
      return (
        <EmptyState
          title={t("pay.pix")}
          text={t("sell.emptyStaff")}
          action={
            <Button
              onClick={() =>
                void refetchOwnerSettings().then(() => undefined)
              }
            >
              {t("btn.update")}
            </Button>
          }
        />
      );
    }
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
          {detectPixKeyType(settings.pixKey)}
        </p>
        <p className="break-all text-lg font-black">{normalizePixKey(settings.pixKey)}</p>
        <p className="text-sm font-bold text-muted">
          {settings.merchantName || settings.storeName} · {settings.merchantCity}
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
              : "QR estático · cliente digita o valor"
          }
        />
      ) : (
        <p className="text-alert">Não foi possível gerar o QR. Revise a chave Pix.</p>
      )}

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
                pixKey: settings.pixKey,
                merchantName: settings.merchantName || settings.storeName,
                merchantCity: settings.merchantCity,
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
                <p className="mt-2 text-[10px]">Pix · {detectPixKeyType(settings.pixKey)}</p>
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
