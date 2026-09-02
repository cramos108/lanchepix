"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { MessageCircle, RefreshCw } from "lucide-react";
import { AmountAdjuster } from "@/components/AmountAdjuster";
import { CheckoutPay } from "@/components/CheckoutPay";
import { LgpdConsent } from "@/components/LgpdConsent";
import { Money, Price } from "@/components/Money";
import { ProductThumb } from "@/components/ProductThumb";
import { Button, EmptyState, Modal, QuantityStepper } from "@/components/ui";
import { db } from "@/lib/db";
import { createSale, upsertCustomer } from "@/lib/repo";
import { seedDemoProducts } from "@/lib/seed";

import {
  isAfterCut,
  isSameLocalDay,
  isSameLocalMonth,
  isSameLocalWeek,
  isSameLocalYear,
  periodCut,
} from "@/lib/id";
import { digitsOnly, maskWhatsAppContactInput } from "@/lib/phone";
import { paymentReminderMessage, waLink } from "@/lib/whatsapp";
import { toast } from "@/lib/toast";
import { loadCartQty, saveCartQty } from "@/lib/persist";
import { refetchOwnerProducts, refetchOwnerSettings } from "@/lib/sync";
import {
  canEditPrices,
  canSeeFinances,
  isAttendantDevice,
  isStaffDevice,
  visibleSalesForDevice,
} from "@/lib/account";
import { useT } from "@/lib/i18n";
import { uniqueById, sellableCatalogProducts } from "@/lib/unique";
import {
  FREE_LOYALTY_LIMIT,
  canAddFiadoThisMonth,
  isPro,
  openUpgradeModal,
} from "@/lib/plan";
import type { Product, Sale } from "@/lib/types";

function paidInPeriod(
  sales: Sale[] | undefined,
  inPeriod: (iso: string) => boolean,
  cut?: string,
): number {
  const active = periodCut(cut, inPeriod);
  return (sales ?? [])
    .filter((s) => {
      if (s.status !== "paid") return false;
      const when = s.paidAt ?? s.createdAt;
      return inPeriod(when) && isAfterCut(when, active);
    })
    .reduce((sum, s) => sum + s.totalCents, 0);
}

function tipsInPeriod(
  sales: Sale[] | undefined,
  inPeriod: (iso: string) => boolean,
  cut?: string,
): number {
  const active = periodCut(cut, inPeriod);
  return (sales ?? [])
    .filter((s) => {
      if (s.status !== "paid" || (s.extraCents ?? 0) <= 0) return false;
      const when = s.paidAt ?? s.createdAt;
      return inPeriod(when) && isAfterCut(when, active);
    })
    .reduce((sum, s) => sum + (s.extraCents ?? 0), 0);
}

type Draft = {
  product: Product;
  quantity: number;
  mode: "pending" | "paid";
};

export default function VenderPage() {
  const t = useT();
  const products = useLiveQuery(
    () => db.products.toArray().then(sellableCatalogProducts),
    [],
  );
  const sales = useLiveQuery(() => db.sales.toArray(), []);
  const customerCount = useLiveQuery(() => db.customers.count(), []) ?? 0;
  const settings = useLiveQuery(() => db.settings.get("app"), []);
  const [category, setCategory] = useState<string>("Todos");
  const [qtyById, setQtyById] = useState<Record<string, number>>(() => loadCartQty());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [lgpdOk, setLgpdOk] = useState(false);
  const [extraCents, setExtraCents] = useState(0);
  const [paidSale, setPaidSale] = useState<Sale | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    saveCartQty(qtyById);
  }, [qtyById]);

  const todayPaid = useMemo(
    () => paidInPeriod(sales, isSameLocalDay, settings?.resetDayAt),
    [sales, settings?.resetDayAt],
  );
  const weekPaid = useMemo(
    () => paidInPeriod(sales, isSameLocalWeek, settings?.resetWeekAt),
    [sales, settings?.resetWeekAt],
  );
  const monthPaid = useMemo(
    () => paidInPeriod(sales, isSameLocalMonth, settings?.resetMonthAt),
    [sales, settings?.resetMonthAt],
  );
  const yearPaid = useMemo(
    () => paidInPeriod(sales, isSameLocalYear, settings?.resetYearAt),
    [sales, settings?.resetYearAt],
  );
  const scopedSales = visibleSalesForDevice(sales, settings);
  const hideStore = !canSeeFinances(settings);
  const pendingSales = scopedSales.filter((s) => s.status === "pending");
  const pendingCount = pendingSales.length;
  const pendingCents = pendingSales.reduce((sum, s) => sum + s.totalCents, 0);
  const todayTips = useMemo(
    () => tipsInPeriod(sales, isSameLocalDay, settings?.resetDayAt),
    [sales, settings?.resetDayAt],
  );
  const monthTips = useMemo(
    () => tipsInPeriod(sales, isSameLocalMonth, settings?.resetMonthAt),
    [sales, settings?.resetMonthAt],
  );

  const categoryChips = [
    "Todos",
    ...[...new Set((products ?? []).map((p) => p.category))],
  ];
  const visible = uniqueById(products).filter(
    (p) => category === "Todos" || p.category === category,
  );

  function qty(id: string) {
    return qtyById[id] ?? 1;
  }

  async function refreshCatalog() {
    setRefreshing(true);
    try {
      await refetchOwnerSettings().catch(() => undefined);
      const n = await refetchOwnerProducts();
      setCatalogError(null);
      toast(n ? `Catálogo atualizado · ${n} itens` : "Catálogo vazio na banca principal");
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message ?? "").trim()
          : "";
      setCatalogError(message);
      toast(message || "Não deu pra atualizar o catálogo.", "err");
    } finally {
      setRefreshing(false);
    }
  }

  async function seed() {
    try {
      const n = await seedDemoProducts(settings?.businessType);
      toast(`${n} produtos de exemplo no catálogo`);
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Não deu pra gravar os exemplos.",
        "err",
      );
    }
  }

  async function openDraft(product: Product, mode: "pending" | "paid") {
    if (isAttendantDevice(settings)) {
      await refetchOwnerSettings().catch(() => undefined);
    } else if (!settings?.pixKey && mode === "paid") {
      toast(t("warn.pixOwner"), "err");
      return;
    }
    if (mode === "pending" && !(await canAddFiadoThisMonth())) {
      openUpgradeModal();
      return;
    }
    setDraft({ product, quantity: qty(product.id), mode });
    setPhone("");
    setCustomerName("");
    setLgpdOk(false);
    setExtraCents(0);
  }

  async function confirmDraft(withWhatsApp: boolean) {
    if (!draft || registering) return;
    const digits = digitsOnly(phone);
    if (digits && !lgpdOk) {
      toast("Marque o consentimento LGPD para salvar o telefone.", "err");
      return;
    }
    setRegistering(true);
    let customer;
    try {
      if (digits) {
        customer = await upsertCustomer({ phone: digits, name: customerName });
      }
      const sale = await createSale({
        product: draft.product,
        quantity: draft.quantity,
        status: draft.mode,
        extraCents,
        customerPhone: digits || undefined,
        customerName: customer?.name || customerName || undefined,
      });
      if (draft.mode === "paid") {
        setPaidSale(sale);
        toast("Venda paga. Estoque baixado.");
        setDraft(null);
      } else {
        toast("Pix Confiança registrado. Estoque baixa quando marcar Pago.");
        if (withWhatsApp && digits && settings) {
          const url = waLink(
            digits,
            paymentReminderMessage({
              storeName: settings.storeName,
              customerName: customer?.name || customerName,
              productName: draft.product.name,
              quantity: draft.quantity,
              totalCents: sale.totalCents,
              pixKey: settings.pixKey,
            }),
          );
          window.open(url, "_blank");
        }
        setPaidSale(sale);
        setDraft(null);
        setPhone("");
        setCustomerName("");
        setLgpdOk(false);
        setExtraCents(0);
        setQtyById({});
        saveCartQty({});
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.startsWith("PLAN_LIMIT_")) {
        openUpgradeModal();
        return;
      }
      toast(message || "Não deu para registrar a venda.", "err");
    } finally {
      setRegistering(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {isStaffDevice(settings) ? (
        <div className="flex flex-col gap-2">
          <p className="text-center text-xs font-extrabold uppercase tracking-wide text-mint">
            {`${settings?.deviceRole === "gerente" ? "Gerente" : "Ajudante"}: ${
              settings?.attendantName || "conectado"
            }`}
          </p>
          {isAttendantDevice(settings) ? (
            <Button
              variant="line"
              className="w-full text-sm"
              disabled={refreshing}
              onClick={() => void refreshCatalog()}
            >
              <RefreshCw className="h-4 w-4" />
              {refreshing ? "…" : t("btn.update")}
            </Button>
          ) : null}
          {catalogError ? (
            <p className="break-all rounded-2xl border-2 border-alert bg-surface px-3 py-2 text-left text-xs font-bold text-alert">
              {catalogError}
            </p>
          ) : null}
        </div>
      ) : null}

      {hideStore ? null : (
        <section className="grid grid-cols-2 gap-2">
          <MetricCard label={t("metric.today")} value={todayPaid} highlight />
          <MetricCard label={t("metric.week")} value={weekPaid} />
          <MetricCard label={t("metric.month")} value={monthPaid} />
          <MetricCard label={t("metric.year")} value={yearPaid} />
        </section>
      )}

      <Link
        href="/pendentes"
        className="rounded-3xl border-2 border-amber bg-surface px-4 py-3"
      >
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-amber">
          {hideStore ? t("sell.pendingMine") : t("sell.pending")}
        </p>
        {hideStore ? (
          <p className="text-2xl font-black">{pendingCount} abertos</p>
        ) : (
          <p className="text-2xl font-black tabular-nums text-sun">
            <Money cents={pendingCents} />
          </p>
        )}
        <p className="text-sm font-bold text-muted">
          {pendingCount} {pendingCount === 1 ? t("sell.openOne") : t("sell.openMany")}
        </p>
      </Link>

      {!hideStore && (todayTips > 0 || monthTips > 0) ? (
        <div className="rounded-3xl border-2 border-mint/50 bg-surface px-4 py-3">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-mint">
            Gorjetas / extra
          </p>
          <p className="text-xl font-black tabular-nums text-mint">
            <Money cents={todayTips} /> hoje
          </p>
          <p className="text-sm font-bold text-muted">
            <Money cents={monthTips} /> neste mês
          </p>
        </div>
      ) : null}

      {!isPro(settings) ? (
        <p className="text-xs font-extrabold uppercase tracking-wide text-amber">
          Grátis: Pix Confiança ilimitado · {customerCount}/{FREE_LOYALTY_LIMIT}{" "}
          cartões fidelidade
        </p>
      ) : null}

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {categoryChips.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`min-h-11 shrink-0 rounded-full border-2 px-4 text-sm font-extrabold ${
              category === c
                ? "border-sun bg-sun text-sunink"
                : "border-line bg-surface text-white"
            }`}
          >
            {c === "Todos" ? t("filter.all") : c}
          </button>
        ))}
      </div>

      {products && products.length === 0 ? (
        <EmptyState
          title={t("sell.empty")}
          text={
            isStaffDevice(settings)
              ? catalogError || t("sell.emptyStaff")
              : t("sell.emptyHint")
          }
          action={
            isStaffDevice(settings) ? (
              <Button
                variant="line"
                disabled={refreshing}
                onClick={() => void refreshCatalog()}
              >
                <RefreshCw className="h-4 w-4" />
                {refreshing ? "…" : t("btn.update")}
              </Button>
            ) : (
            <div className="flex flex-col gap-2">
              <Button onClick={() => void seed()}>Carregar catálogo de exemplo</Button>
              <Link href="/produtos" className="text-sm font-bold text-sun underline">
                Cadastrar na mão
              </Link>
            </div>
            )
          }
        />
      ) : null}

      <div className="grid grid-cols-1 gap-3">
        {visible.map((product) => {
          const q = qty(product.id);
          const out = product.stock <= 0;
          const low = product.stock > 0 && product.stock <= 3;
          return (
            <article
              key={product.id}
              className="rounded-3xl border-2 border-line bg-surface p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <ProductThumb
                    imageData={product.imageData}
                    category={product.category}
                    name={product.name}
                    size="md"
                  />
                  <div>
                    <h2 className="text-xl font-black leading-tight">{product.name}</h2>
                    <p className="text-sm font-bold text-muted">{product.category}</p>
                  </div>
                </div>
                <p className="text-right">
                  <span className="block text-2xl font-black tabular-nums text-sun">
                    <Price cents={product.priceCents} />
                  </span>
                  {product.priceMode === "suggested" ? (
                    <span className="text-[10px] font-extrabold uppercase text-amber">
                      {t("sell.suggested")}
                    </span>
                  ) : null}
                </p>
              </div>
              <p
                className={`mt-1 text-sm font-extrabold ${
                  out ? "text-alert" : low ? "text-amber" : "text-muted"
                }`}
              >
                {out
                  ? t("sell.out")
                  : `${product.stock} ${t("sell.stock")}${low ? ` · ${t("sell.low")}` : ""}`}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <QuantityStepper
                  value={q}
                  onChange={(n) => setQtyById((m) => ({ ...m, [product.id]: n }))}
                />
                <p className="text-sm font-bold text-muted">
                  {t("sell.total")} <Price cents={product.priceCents * q} />
                </p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  variant="amber"
                  className="px-2 text-sm leading-tight"
                  onClick={() => void openDraft(product, "pending")}
                >
                  {t("btn.pixLater")}
                </Button>
                <Button
                  className="px-2 text-sm leading-tight"
                  onClick={() => void openDraft(product, "paid")}
                  disabled={out}
                >
                  {t("btn.pixNow")}
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      <Modal
        open={Boolean(draft)}
        title={draft?.mode === "paid" ? "PIX AGORA" : "PIX CONFIANÇA"}
        onClose={() => {
          if (!registering) setDraft(null);
        }}
      >
        {draft ? (
          <div className="flex flex-col gap-4">
            <p className="text-lg font-bold">
              {draft.product.name} × {draft.quantity}
              <span className="mt-1 block text-2xl font-black text-sun">
                <Price
                  cents={Math.max(
                    0,
                    draft.product.priceCents * draft.quantity + extraCents,
                  )}
                />
              </span>
            </p>
            <p className="text-sm text-muted">
              {draft.mode === "paid" ? t("sell.paidHint") : t("sell.pendingHint")}
            </p>
            <AmountAdjuster
              baseCents={draft.product.priceCents * draft.quantity}
              extraCents={extraCents}
              onChange={setExtraCents}
              suggested={draft.product.priceMode === "suggested"}
              locked={!canEditPrices(settings)}
            />
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-extrabold uppercase tracking-widest text-sun">
                {t("sell.phone")}
              </span>
              <input
                inputMode="tel"
                autoComplete="tel"
                className="min-h-14 w-full rounded-2xl border-2 border-line bg-surface px-4 text-lg font-semibold"
                placeholder="5511999999999"
                value={phone}
                onChange={(e) => setPhone(maskWhatsAppContactInput(e.target.value))}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-extrabold uppercase tracking-widest text-sun">
                {t("sell.name")}
              </span>
              <input
                className="min-h-14 w-full rounded-2xl border-2 border-line bg-surface px-4 text-lg font-semibold"
                placeholder={t("sell.name")}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </label>
            <LgpdConsent checked={lgpdOk} onChange={setLgpdOk} />
            {draft.mode === "pending" ? (
              <div className="grid gap-2">
                <Button
                  variant="amber"
                  disabled={registering}
                  onClick={() => void confirmDraft(false)}
                >
                  {registering ? "…" : t("btn.registerSale")}
                </Button>
                <Button
                  variant="mint"
                  disabled={registering || !digitsOnly(phone) || !lgpdOk}
                  onClick={() => void confirmDraft(true)}
                >
                  <MessageCircle className="h-5 w-5" />
                  {registering ? "…" : t("btn.registerSale")}
                </Button>
              </div>
            ) : (
              <Button disabled={registering} onClick={() => void confirmDraft(false)}>
                {registering ? "…" : t("btn.registerSale")}
              </Button>
            )}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(paidSale)}
        title={t("pay.title")}
        onClose={() => setPaidSale(null)}
      >
        {paidSale && settings ? (
          <CheckoutPay sale={paidSale} settings={settings} onClose={() => setPaidSale(null)} />
        ) : null}
      </Modal>
    </div>
  );
}

function MetricCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border-2 px-3 py-3 ${
        highlight ? "border-sun bg-sun text-sunink" : "border-sun/70 bg-surface"
      }`}
    >
      <p
        className={`text-[10px] font-extrabold uppercase tracking-widest ${
          highlight ? "" : "text-sun"
        }`}
      >
        {label}
      </p>
      <p className="text-lg font-black tabular-nums leading-tight sm:text-xl">
        <Money cents={value} />
      </p>
    </div>
  );
}
