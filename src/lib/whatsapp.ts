import { formatBRL, formatMoney } from "./money";
import { digitsOnly } from "./phone";
import type { DailyClosing } from "./salesReport";
import type { AppCurrency, Lang, PayMethod } from "./locale";

function payMethodLabel(lang: Lang, method: PayMethod): string {
  if (lang === "en") {
    if (method === "cash") return "Cash";
    if (method === "link") return "Link / Card";
    return "Pix";
  }
  if (lang === "es") {
    if (method === "cash") return "Efectivo";
    if (method === "link") return "Link / Tarjeta";
    return "Pix";
  }
  if (method === "cash") return "Dinheiro";
  if (method === "link") return "Link / Cartão";
  return "Pix";
}

/** NFC + drop U+FFFD so mobile wa.me does not show broken glyphs. */
function utf8SafeMessage(message: string): string {
  return message
    .normalize("NFC")
    .replace(/\uFFFD/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

/** Encode wa.me `text` once. Newlines become %0A; emojis stay UTF-8. */
export function encodeWhatsAppText(message: string): string {
  const rawMessage = utf8SafeMessage(message);
  return encodeURIComponent(rawMessage);
}

/**
 * All WhatsApp deep links go through here:
 * `https://wa.me/${phone}?text=${encodeURIComponent(rawMessage)}`
 */
export function waLink(phone: string | undefined, message: string): string {
  const rawMessage = utf8SafeMessage(message);
  const n = digitsOnly(phone ?? "");
  const whatsappUrl = `https://wa.me/${n}?text=${encodeURIComponent(rawMessage)}`;
  return whatsappUrl;
}

function receiptWhen(iso?: string): string {
  return new Date(iso || Date.now()).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function paidSaleReceiptMessage(opts: {
  storeName?: string;
  productName: string;
  quantity?: number;
  paidAt?: string;
  totalCents: number;
  sellerName?: string;
}): string {
  const storeName = opts.storeName?.trim() || "Meu Negócio";
  const itemDetails =
    (opts.quantity ?? 1) > 1
      ? `${opts.productName} (x${opts.quantity})`
      : opts.productName;
  const totalAmount = (opts.totalCents / 100).toFixed(2).replace(".", ",");
  const seller = opts.sellerName?.trim() || "Chefe";
  const dateStr = receiptWhen(opts.paidAt);
  const rawMessage =
    `*${storeName}* \n` +
    `*✅ Pagamento Confirmado!*\n` +
    `_Valeu pela compra no Pix da Confiança!_\n\n` +
    `• *${itemDetails}* — *R$ ${totalAmount}*\n` +
    `• *Atendente:* ${seller}\n` +
    `• *Data:* ${dateStr}\n\n` +
    `_Sua preferência faz a diferença! Até a próxima!_ `;
  return rawMessage;
}

export function paidSaleReceiptUrl(opts: {
  phone?: string;
  storeName?: string;
  productName: string;
  quantity?: number;
  totalCents: number;
  paidAt?: string;
  sellerName?: string;
}): string {
  const cleanPhone = digitsOnly(opts.phone ?? "");
  const rawMessage = paidSaleReceiptMessage(opts);
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(rawMessage)}`;
  return whatsappUrl;
}

let lastReceiptUrl = "";
let lastReceiptOpenAt = 0;

/** Opens WhatsApp only when a customer phone exists. Never blocks the sale save. */
export function openPaidSaleWhatsApp(opts: {
  phone?: string;
  storeName?: string;
  productName: string;
  quantity?: number;
  totalCents: number;
  paidAt?: string;
  sellerName?: string;
}): void {
  const cleanPhone = digitsOnly(opts.phone ?? "");
  if (!cleanPhone) return;
  try {
    const whatsappUrl = paidSaleReceiptUrl({ ...opts, phone: cleanPhone });
    const now = Date.now();
    if (whatsappUrl === lastReceiptUrl && now - lastReceiptOpenAt < 2000) return;
    lastReceiptUrl = whatsappUrl;
    lastReceiptOpenAt = now;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  } catch {
    /* popup blocked / ssr */
  }
}

/** Printed catalog sticker: camera scan opens WhatsApp to the seller. */
export function stickerWhatsAppLink(opts: {
  sellerPhone?: string;
  storeName?: string;
  productName: string;
  totalCents: number;
  pixKey?: string;
}): string {
  const loja = opts.storeName?.trim() || "Meu Negócio";
  const valor = (opts.totalCents / 100).toFixed(2).replace(".", ",");
  const chave = opts.pixKey?.trim() || "";
  const rawMessage = `Oi, ${loja}! Peguei ${opts.productName} (R$ ${valor}) no Pix da Confiança. Chave Pix: ${chave}`;
  return waLink(opts.sellerPhone, rawMessage);
}

export function orderReceiptMessage(opts: {
  lang: Lang;
  currency: AppCurrency;
  productName: string;
  quantity?: number;
  totalCents: number;
  method: PayMethod;
  sellerName?: string;
  pixKey?: string;
}): string {
  void opts.lang;
  void opts.method;
  const item =
    (opts.quantity ?? 1) > 1
      ? `${opts.productName} (x${opts.quantity})`
      : opts.productName;
  const total = formatMoney(opts.totalCents, opts.currency);
  const loja = opts.sellerName?.trim() || "Meu Negócio";
  const chave = opts.pixKey?.trim() || "";
  const rawMessage = chave
    ? `Oi, ${loja}! Peguei ${item} por ${total} e paguei agora pelo Pix da Confiança (${chave}). Obrigado! `
    : `Oi, ${loja}! Peguei ${item} por ${total} no Pix da Confiança. Pode me mandar sua chave Pix para eu te pagar? Valeu!`;
  return rawMessage;
}

/** Buyer-to-seller text so the customer opens WhatsApp already speaking. */
export function buyerConfirmPixMessage(opts: {
  productName: string;
  quantity?: number;
  totalCents: number;
  pixKey?: string;
  sellerName?: string;
  lang?: Lang;
  currency?: AppCurrency;
  method?: PayMethod;
}): string {
  return orderReceiptMessage({
    lang: opts.lang ?? "pt",
    currency: opts.currency ?? "BRL",
    productName: opts.productName,
    quantity: opts.quantity,
    totalCents: opts.totalCents,
    method: opts.method ?? "pix",
    sellerName: opts.sellerName,
    pixKey: opts.pixKey,
  });
}

export function pendingPixReminderMessage(opts: {
  customerName?: string;
  storeName?: string;
  totalCents: number;
  pixKey?: string;
}): string {
  const name = opts.customerName?.trim() || "cliente";
  const loja = opts.storeName?.trim() || "Meu Negócio";
  const valor = (opts.totalCents / 100).toFixed(2).replace(".", ",");
  const chave = opts.pixKey?.trim() || "";
  const rawMessage =
    `Oi, ${name}! 👋 Passando só pra lembrar do Pix pendente no valor de *R$ ${valor}* na *${loja}*. ` +
    `Quando puder, o Pix é: ${chave}. Obrigado!`;
  return rawMessage;
}

export function paymentReminderMessage(opts: {
  storeName: string;
  customerName?: string;
  productName: string;
  quantity: number;
  totalCents: number;
  pixKey?: string;
  currency?: AppCurrency;
}): string {
  void opts.storeName;
  void opts.customerName;
  void opts.currency;
  const item =
    opts.quantity > 1 ? `${opts.productName} (x${opts.quantity})` : opts.productName;
  const valor = (opts.totalCents / 100).toFixed(2).replace(".", ",");
  const chave = opts.pixKey?.trim() || "";
  const rawMessage = chave
    ? [
        `Oi! Muito obrigado(a) pela confiança!`,
        ``,
        `Passando só pra te mandar a chave Pix do *${item}* (R$ *${valor}*): *${chave}*.`,
        ``,
        `Pode pagar por aqui quando puder. Tmj! `,
      ].join("\n")
    : [
        `Oi! Passando pra confirmar seu pedido do *${item}* (R$ *${valor}*).`,
        ``,
        `Me avisa quando quiser o Pix para pagamento! Valeu! `,
      ].join("\n");
  return rawMessage;
}

export function loyaltyStampMessage(opts: {
  storeName: string;
  customerName?: string;
  stamps: number;
  required: number;
  rewardLabel: string;
}): string {
  const customerName = opts.customerName?.trim() || "cliente";
  const storeName = opts.storeName?.trim() || "Meu Negócio";
  const stampsCount = opts.stamps;
  const maxStamps = opts.required;
  const remaining = Math.max(0, maxStamps - stampsCount);
  if (remaining === 0) {
    const rawLoyaltyMsg =
      `Oi, ${customerName}! Seu cartão fidelidade da ${storeName} está completo!\n\n` +
      `Você ganhou ${opts.rewardLabel}. É só apresentar esta mensagem na hora de retirar.\n\n` +
      `Valeu pela preferência! `;
    return rawLoyaltyMsg;
  }
  const rawLoyaltyMsg =
    `Oi, ${customerName}!  Você ganhou um carimbo no cartão fidelidade da ${storeName}!\n\n` +
    `Cartão: ${stampsCount}/${maxStamps}. Faltam ${remaining} carimbos para ganhar 1 brinde grátis! \n\n` +
    `Valeu pela preferência! `;
  return rawLoyaltyMsg;
}

export function dailyClosingWhatsAppMessage(opts: {
  storeName?: string;
  closing: DailyClosing;
}): string {
  const loja = opts.storeName?.trim() || "Meu Negócio";
  const c = opts.closing;
  const helperLines =
    c.helpers.length === 0
      ? "Nenhuma venda de ajudante hoje."
      : c.helpers
          .map((h) => `• ${h.name}: *${formatBRL(h.totalCents)}* (${h.salesCount})`)
          .join("\n");
  const pendingLabel =
    c.pendingCount === 1 ? "1 pedido" : `${c.pendingCount} pedidos`;
  const rawMessage =
    `📦 *FECHAMENTO DO DIA*\n` +
    `*${loja}*\n` +
    `${c.dateLabel}\n\n` +
    `💰 *Total Geral do Dia:* ${formatBRL(c.totalPaidCents)}\n` +
    `👤 *Vendas do Chefe:* ${formatBRL(c.chefeCents)}\n\n` +
    `👥 *Ajudantes:*\n${helperLines}\n\n` +
    `⏳ *Pedidos A Receber:* ${formatBRL(c.pendingCents)} (${pendingLabel})\n\n` +
    `Enviado pelo Pix da Confiança`;
  return rawMessage;
}

export function loyaltyRewardMessage(opts: {
  storeName: string;
  customerName?: string;
  rewardLabel: string;
}): string {
  const customerName = opts.customerName?.trim() || "cliente";
  const storeName = opts.storeName?.trim() || "Meu Negócio";
  const rawMessage =
    `Oi, ${customerName}! Prêmio resgatado na ${storeName}!\n\n` +
    `${opts.rewardLabel} já foi registrado. Seu cartão zerou e você já pode começar a juntar carimbos de novo.\n\n` +
    `Obrigado! Volte sempre `;
  return rawMessage;
}
