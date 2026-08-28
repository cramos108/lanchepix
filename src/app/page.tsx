"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { MessageCircle } from "lucide-react";
import { AmountAdjuster } from "@/components/AmountAdjuster";
import { LgpdConsent } from "@/components/LgpdConsent";
import { ProductThumb } from "@/components/ProductThumb";
import { Button, EmptyState, Modal, QuantityStepper } from "@/components/ui";
import { PixQr } from "@/components/PixQr";
import { db } from "@/lib/db";
import { createSale, upsertCustomer } from "@/lib/repo";
import { seedDemoProducts } from "@/lib/seed";
import { formatBRL } from "@/lib/money";
import {
  isAfterCut,
  isSameLocalDay,
  isSameLocalMonth,
  isSameLocalWeek,
  isSameLocalYear,
  periodCut,
} from "@/lib/id";
import { maskPhoneInput, nationalDigits } from "@/lib/phone";
import { buildPixPayload } from "@/lib/pix";
import { paymentReminderMessage, waLink } from "@/lib/whatsapp";
import { toast } from "@/lib/toast";
import { scheduleSync } from "@/lib/sync";
import {
  FREE_CONFIANCA_LIMIT,
  FREE_LOYALTY_LIMIT,
  canAddFiadoThisMonth,
  countConfiancaSales,
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
  const products = useLiveQuery(
    () =>
      db.products
        .filter((p) => p.active && !p.deleted)
        .toArray()
        .then((rows) => rows.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))),
    [],
  );
  const sales = useLiveQuery(() => db.sales.toArray(), []);
  const customerCount = useLiveQuery(() => db.customers.count(), []) ?? 0;
  const settings = useLiveQuery(() => db.settings.get("app"), []);
  const [category, setCategory] = useState<string>("Todos");
  const [qtyById, setQtyById] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState<Draft | null>(null);
  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [lgpdOk, setLgpdOk] = useState(false);
  const [extraCents, setExtraCents] = useState(0);
  const [paidSale, setPaidSale] = useState<Sale | null>(null);

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
  const pendingSales = (sales ?? []).filter((s) => s.status === "pending");
  const pendingCount = pendingSales.length;
  const pendingCents = pendingSales.reduce((sum, s) => sum + s.totalCents, 0);
  const confiancaUsed = countConfiancaSales(sales ?? []);
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
  const visible = (products ?? []).filter(
    (p) => category === "Todos" || p.category === category,
  );

  function qty(id: string) {
    return qtyById[id] ?? 1;
  }

  async function seed() {
    const n = await seedDemoProducts();
    scheduleSync();
    toast(`${n} produtos de exemplo no catálogo`);
  }

  async function openDraft(product: Product, mode: "pending" | "paid") {
    if (!settings?.pixKey && mode === "paid") {
      toast("Cadastre a chave Pix em Configurações.", "err");
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
    if (!draft) return;
    const digits = nationalDigits(phone);
    if (digits && !lgpdOk) {
      toast("Marque o consentimento LGPD para salvar o telefone.", "err");
      return;
    }
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
      }
      setDraft(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.startsWith("PLAN_LIMIT_")) {
        openUpgradeModal();
        return;
      }
      toast("Não deu para registrar a venda.", "err");
    }
  }

  let pixPayload = "";
  let pixError = "";
  if (paidSale && settings?.pixKey) {
    try {
      pixPayload = buildPixPayload({
        pixKey: settings.pixKey,
        merchantName: settings.merchantName || settings.storeName,
        merchantCity: settings.merchantCity,
        amountCents: paidSale.totalCents,
        description: paidSale.productName,
      });
    } catch (e) {
      pixError = e instanceof Error ? e.message : "Erro ao gerar Pix";
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="grid grid-cols-2 gap-2">
        <MetricCard label="Hoje" value={todayPaid} highlight />
        <MetricCard label="Esta Semana" value={weekPaid} />
        <MetricCard label="Este mês" value={monthPaid} />
        <MetricCard label="Este ano" value={yearPaid} />
      </section>

      <Link
        href="/pendentes"
        className="rounded-3xl border-2 border-amber bg-surface px-4 py-3"
      >
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-amber">
          Pix Confiança · a receber
        </p>
        <p className="text-2xl font-black tabular-nums text-sun">{formatBRL(pendingCents)}</p>
        <p className="text-sm font-bold text-muted">
          {pendingCount} {pendingCount === 1 ? "pedido aberto" : "pedidos abertos"} na rua
        </p>
      </Link>

      {todayTips > 0 || monthTips > 0 ? (
        <div className="rounded-3xl border-2 border-mint/50 bg-surface px-4 py-3">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-mint">
            Gorjetas / extra
          </p>
          <p className="text-xl font-black tabular-nums text-mint">
            {formatBRL(todayTips)} hoje
          </p>
          <p className="text-sm font-bold text-muted">
            {formatBRL(monthTips)} neste mês
          </p>
        </div>
      ) : null}

      {!isPro(settings) ? (
        <p className="text-xs font-extrabold uppercase tracking-wide text-amber">
          Uso grátis: {confiancaUsed}/{FREE_CONFIANCA_LIMIT} Pix Confiança ·{" "}
          {customerCount}/{FREE_LOYALTY_LIMIT} cartões
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
            {c}
          </button>
        ))}
      </div>

      {products && products.length === 0 ? (
        <EmptyState
          title="Nenhum produto cadastrado"
          text="Comece pelo catálogo: lanches, capinhas, meias, sabonetes…"
          action={
            <div className="flex flex-col gap-2">
              <Button onClick={() => void seed()}>Carregar catálogo de exemplo</Button>
              <Link href="/produtos" className="text-sm font-bold text-sun underline">
                Cadastrar na mão
              </Link>
            </div>
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
                    {formatBRL(product.priceCents)}
                  </span>
                  {product.priceMode === "suggested" ? (
                    <span className="text-[10px] font-extrabold uppercase text-amber">
                      Sugerida
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
                  ? "Sem estoque"
                  : `${product.stock} un. em estoque${low ? " · baixo" : ""}`}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <QuantityStepper
                  value={q}
                  onChange={(n) => setQtyById((m) => ({ ...m, [product.id]: n }))}
                />
                <p className="text-sm font-bold text-muted">
                  Total {formatBRL(product.priceCents * q)}
                </p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  variant="amber"
                  className="px-2 text-sm leading-tight"
                  onClick={() => void openDraft(product, "pending")}
                >
                  Pix Confiança
                </Button>
                <Button
                  className="px-2 text-sm leading-tight"
                  onClick={() => void openDraft(product, "paid")}
                  disabled={out}
                >
                  Pix agora
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      <Modal
        open={Boolean(draft)}
        title={draft?.mode === "paid" ? "PIX AGORA" : "PIX CONFIANÇA"}
        onClose={() => setDraft(null)}
      >
        {draft ? (
          <div className="flex flex-col gap-4">
            <p className="text-lg font-bold">
              {draft.product.name} × {draft.quantity}
              <span className="mt-1 block text-2xl font-black text-sun">
                {formatBRL(
                  Math.max(0, draft.product.priceCents * draft.quantity + extraCents),
                )}
              </span>
            </p>
            <p className="text-sm text-muted">
              {draft.mode === "paid"
                ? "O estoque baixa agora. Mostre o QR para o cliente pagar."
                : "O estoque só baixa quando você marcar como Pago na fila."}
            </p>
            <AmountAdjuster
              baseCents={draft.product.priceCents * draft.quantity}
              extraCents={extraCents}
              onChange={setExtraCents}
              suggested={draft.product.priceMode === "suggested"}
            />
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-extrabold uppercase tracking-widest text-sun">
                Telefone do cliente (opcional)
              </span>
              <input
                inputMode="tel"
                autoComplete="tel"
                className="min-h-14 w-full rounded-2xl border-2 border-line bg-surface px-4 text-lg font-semibold"
                placeholder="(11) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(maskPhoneInput(e.target.value))}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-extrabold uppercase tracking-widest text-sun">
                Nome (opcional)
              </span>
              <input
                className="min-h-14 w-full rounded-2xl border-2 border-line bg-surface px-4 text-lg font-semibold"
                placeholder="Como chama o cliente"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </label>
            <LgpdConsent checked={lgpdOk} onChange={setLgpdOk} />
            {draft.mode === "pending" ? (
              <div className="grid gap-2">
                <Button variant="amber" onClick={() => void confirmDraft(false)}>
                  Registrar Pix Confiança
                </Button>
                <Button
                  variant="mint"
                  disabled={!nationalDigits(phone) || !lgpdOk}
                  onClick={() => void confirmDraft(true)}
                >
                  <MessageCircle className="h-5 w-5" />
                  Registrar e cobrar no WhatsApp
                </Button>
              </div>
            ) : (
              <Button onClick={() => void confirmDraft(false)}>
                Gerar QR e baixar estoque
              </Button>
            )}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(paidSale)}
        title="Pagar com Pix"
        onClose={() => setPaidSale(null)}
      >
        {paidSale && settings ? (
          <div className="flex flex-col gap-4">
            <p className="text-center text-lg font-bold">
              {paidSale.productName} × {paidSale.quantity}
              <span className="block text-3xl font-black text-sun">
                {formatBRL(paidSale.totalCents)}
              </span>
            </p>
            {pixPayload ? (
              <PixQr payload={pixPayload} size={220} label="Aponte a câmera do banco" />
            ) : (
              <p className="text-alert">{pixError || "Chave Pix ausente."}</p>
            )}
            {paidSale.customerPhone ? (
              <a
                href={waLink(
                  paidSale.customerPhone,
                  paymentReminderMessage({
                    storeName: settings.storeName,
                    customerName: paidSale.customerName,
                    productName: paidSale.productName,
                    quantity: paidSale.quantity,
                    totalCents: paidSale.totalCents,
                    pixKey: settings.pixKey,
                  }),
                )}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-mint bg-mint px-4 text-base font-extrabold uppercase text-sunink"
              >
                <MessageCircle className="h-5 w-5" />
                Enviar no WhatsApp
              </a>
            ) : null}
            <Button variant="ghost" onClick={() => setPaidSale(null)}>
              Fechar
            </Button>
          </div>
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
        {formatBRL(value)}
      </p>
    </div>
  );
}
