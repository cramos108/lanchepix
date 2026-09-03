"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Copy, MessageCircle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { PixQr } from "@/components/PixQr";
import { Price } from "@/components/Money";
import { Button, inputClass } from "@/components/ui";
import { getAttendantNameLocal, isStaffDevice } from "@/lib/account";
import { useMasterSettings } from "@/components/MasterSettingsProvider";
import { db } from "@/lib/db";
import { useLang, useT } from "@/lib/i18n";
import { normalizeCurrency, normalizeLang, type PayMethod } from "@/lib/locale";
import { centsToInput, currencySymbol, parseMoneyToCents } from "@/lib/money";
import { buildPixPayload } from "@/lib/pix";
import { markSalePaid } from "@/lib/repo";
import { refetchOwnerSettings } from "@/lib/sync";
import { toast } from "@/lib/toast";
import { orderReceiptMessage, waLink } from "@/lib/whatsapp";
import type { Sale, Settings } from "@/lib/types";

export function CheckoutPay({
  sale,
  settings: settingsProp,
  onClose,
}: {
  sale: Sale;
  settings: Settings;
  onClose: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const master = useMasterSettings();
  const live = useLiveQuery(() => db.settings.get("app"), []);
  const settings = live ?? settingsProp;

  useEffect(() => {
    if (master.isPaired) return;
    void refetchOwnerSettings().catch(() => undefined);
  }, [master.isPaired]);

  const currency = normalizeCurrency(master.currency || settings.currency);
  const pixKey = (master.isPaired ? master.pixKey : settings.pixKey)?.trim() || "";
  const paymentLink = (master.isPaired ? master.paymentLink : settings.paymentLink)?.trim() || "";
  const whatsapp = (master.isPaired ? master.whatsapp : settings.whatsapp)?.trim() || "";
  const merchantName = master.isPaired
    ? master.merchantName || settings.merchantName
    : settings.merchantName;
  const merchantCity = master.isPaired
    ? master.merchantCity || settings.merchantCity
    : settings.merchantCity;
  const [method, setMethod] = useState<PayMethod | null>(null);
  const [received, setReceived] = useState(centsToInput(sale.totalCents, currency));
  const [busy, setBusy] = useState(false);
  const activeMethod: PayMethod = method ?? (pixKey ? "pix" : paymentLink ? "link" : "cash");

  const seller =
    getAttendantNameLocal(settings) ||
    settings.attendantName?.trim() ||
    settings.storeName ||
    "—";

  const pixPayload = useMemo(() => {
    if (!pixKey) return "";
    try {
      return buildPixPayload({
        pixKey,
        merchantName: merchantName || settings.storeName,
        merchantCity: merchantCity,
        amountCents: sale.totalCents,
        description: sale.productName,
      });
    } catch {
      return "";
    }
  }, [pixKey, sale.productName, sale.totalCents, merchantCity, merchantName, settings.storeName]);

  const waUrl = whatsapp
    ? waLink(
        whatsapp,
        orderReceiptMessage({
          lang: settings.language ? normalizeLang(settings.language) : lang,
          currency,
          productName: sale.productName,
          quantity: sale.quantity,
          totalCents: sale.totalCents,
          method: activeMethod,
          sellerName: settings.storeName || seller,
          pixKey,
        }),
      )
    : "";

  const receivedCents = parseMoneyToCents(received);
  const changeCents = receivedCents - sale.totalCents;
  const staff = isStaffDevice(settings);

  async function confirmCash() {
    if (busy) return;
    setBusy(true);
    try {
      if (sale.status !== "paid") {
        await markSalePaid(sale.id);
      }
      toast(t("pay.cashConfirm"));
    } catch (err) {
      toast(err instanceof Error ? err.message : t("pay.cashConfirm"), "err");
    } finally {
      setBusy(false);
    }
  }

  const methods: PayMethod[] = ["pix", "cash", "link"];

  function ProofButton() {
    if (!waUrl || activeMethod === "cash") return null;
    return (
      <a
        href={waUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-mint bg-mint px-4 text-base font-extrabold uppercase text-sunink"
      >
        <MessageCircle className="h-5 w-5" />
        {t("pay.proof")}
      </a>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-center text-lg font-bold">
        {sale.productName} × {sale.quantity}
        <span className="block text-3xl font-black text-sun">
          <Price cents={sale.totalCents} />
        </span>
      </p>

      <div className="grid grid-cols-3 gap-2">
        {methods.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setMethod(id)}
            className={`min-h-12 rounded-2xl border-2 px-1 text-[11px] font-extrabold uppercase ${
              activeMethod === id ? "border-sun bg-sun text-sunink" : "border-line bg-surface"
            }`}
          >
            {t(`pay.${id}`)}
          </button>
        ))}
      </div>

      {activeMethod === "pix" ? (
        pixKey && pixPayload ? (
          <div className="flex flex-col gap-3">
            <PixQr payload={pixPayload} size={200} label={t("pay.scanPix")} />
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(pixKey);
                  toast(t("pay.copyPix"));
                } catch {
                  toast(pixKey);
                }
              }}
              className="w-full rounded-2xl border-2 border-sun bg-sun/10 px-4 py-3 text-left"
            >
              <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-sun">
                <Copy className="h-4 w-4" />
                {t("pay.copyPix")}
              </p>
              <p className="mt-1 break-all text-lg font-black">{pixKey}</p>
            </button>
            <ProofButton />
          </div>
        ) : staff || master.isPaired ? null : (
          <p className="text-sm font-bold text-alert">{t("warn.pixOwner")}</p>
        )
      ) : null}

      {activeMethod === "cash" ? (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-extrabold uppercase tracking-widest text-sun">
              {t("pay.received")} ({currencySymbol(currency)})
            </span>
            <input
              className={inputClass}
              inputMode="decimal"
              value={received}
              onChange={(e) => setReceived(e.target.value)}
            />
          </label>
          <p className="text-lg font-black">
            {t("pay.change")}:{" "}
            <span className={changeCents >= 0 ? "text-mint" : "text-alert"}>
              <Price cents={Math.max(0, changeCents)} />
            </span>
          </p>
          <Button variant="mint" disabled={busy || receivedCents < sale.totalCents} onClick={() => void confirmCash()}>
            {t("pay.cashConfirm")}
          </Button>
        </div>
      ) : null}

      {activeMethod === "link" ? (
        paymentLink ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-center text-sm font-extrabold uppercase tracking-widest text-sun">
              {t("pay.scanLink")}
            </p>
            <div className="rounded-3xl bg-white p-4 shadow-[0_0_0_4px_#ffe500]">
              <QRCodeSVG
                value={paymentLink}
                size={220}
                bgColor="#ffffff"
                fgColor="#000000"
                level="M"
                includeMargin={false}
              />
            </div>
            <p className="break-all text-center text-xs font-bold text-muted">{paymentLink}</p>
            <ProofButton />
          </div>
        ) : (
          <p className="text-sm font-bold text-muted">{t("pay.linkMissing")}</p>
        )
      ) : null}

      <Button variant="ghost" onClick={onClose}>
        {t("btn.close")}
      </Button>
    </div>
  );
}
