import { formatMoney } from "./money";
import { digitsOnly } from "./phone";
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

/** wa.me uses E.164 digits only — strip +, spaces, dashes, parentheses. */
export function waLink(phone: string | undefined, message: string): string {
  const text = encodeURIComponent(message);
  const n = digitsOnly(phone ?? "");
  if (n) return `https://wa.me/${n}?text=${text}`;
  return `https://wa.me/?text=${text}`;
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
  if (chave) {
    return `Oi, ${loja}! Peguei ${item} por ${total} e paguei agora pelo Pix da Confiança (${chave}). Obrigado! `;
  }
  return `Oi, ${loja}! Peguei ${item} por ${total} no Pix da Confiança. Pode me mandar sua chave Pix para eu te pagar? Valeu!`;
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

export function paymentReminderMessage(opts: {
  storeName: string;
  customerName?: string;
  productName: string;
  quantity: number;
  totalCents: number;
  pixKey?: string;
  currency?: AppCurrency;
}): string {
  const nome = opts.customerName?.trim() || "";
  const oi = nome ? `Olá ${nome}!` : "Olá!";
  const item =
    opts.quantity > 1 ? `${opts.productName} (x${opts.quantity})` : opts.productName;
  const pedido = `${item} / ${formatMoney(opts.totalCents, opts.currency ?? "BRL")}`;
  const chave = opts.pixKey?.trim() || "a chave combinada";
  return (
    `${oi} Passando pra lembrar do seu pedido de *${pedido}* no Pix Confiança. ` +
    `Segue minha chave Pix para pagamento quando puder: *${chave}*. Muito obrigado(a)!`
  );
}

export function loyaltyStampMessage(opts: {
  storeName: string;
  customerName?: string;
  stamps: number;
  required: number;
  rewardLabel: string;
}): string {
  const oi = opts.customerName ? `Oi, ${opts.customerName}!` : "Oi!";
  const remaining = Math.max(0, opts.required - opts.stamps);
  if (remaining === 0) {
    return (
      `${oi} 🥳 Seu cartão fidelidade da *${opts.storeName}* está completo!\n\n` +
      `Você ganhou *${opts.rewardLabel}*. É só apresentar esta mensagem na hora de retirar.\n\n` +
      `Obrigado pela preferência! 💛`
    );
  }
  const faltam =
    remaining === 1 ? "Falta *1 carimbo*" : `Faltam *${remaining} carimbos*`;
  return (
    `${oi} 🎉 Você ganhou um carimbo no cartão fidelidade da *${opts.storeName}*!\n\n` +
    `Cartão: *${opts.stamps}/${opts.required}*. ${faltam} para ganhar *${opts.rewardLabel}*.\n\n` +
    `Valeu pela preferência! 💛`
  );
}

export function loyaltyRewardMessage(opts: {
  storeName: string;
  customerName?: string;
  rewardLabel: string;
}): string {
  const oi = opts.customerName ? `Oi, ${opts.customerName}!` : "Oi!";
  return (
    `${oi} 🏆 Prêmio resgatado na *${opts.storeName}*!\n\n` +
    `*${opts.rewardLabel}* já foi registrado. Seu cartão zerou e você já pode começar a juntar carimbos de novo.\n\n` +
    `Obrigado! Volte sempre 😊`
  );
}
