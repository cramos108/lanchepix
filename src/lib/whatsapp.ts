import { formatBRL } from "./money";
import { cleanWhatsAppNumber } from "./phone";

export function waLink(phone: string | undefined, message: string): string {
  const text = encodeURIComponent(message);
  if (phone) {
    const n = cleanWhatsAppNumber(phone);
    if (n) return `https://wa.me/${n}?text=${text}`;
  }
  return `https://wa.me/?text=${text}`;
}

/** Buyer-to-seller text so the customer opens WhatsApp already speaking. */
export function buyerConfirmPixMessage(opts: {
  productName: string;
  quantity?: number;
  totalCents: number;
  pixKey?: string;
  sellerName?: string;
}): string {
  const item =
    (opts.quantity ?? 1) > 1
      ? `${opts.productName} (x${opts.quantity})`
      : opts.productName;
  const chave = opts.pixKey?.trim() || "";
  const vendedor = opts.sellerName?.trim() || "a banca";
  return (
    `Olá! Realizei o pagamento via Pix da Confiança no valor de ${formatBRL(opts.totalCents)} ` +
    `para o produto ${item}. Chave Pix: ${chave}. Vendedor: ${vendedor}.`
  );
}

export function paymentReminderMessage(opts: {
  storeName: string;
  customerName?: string;
  productName: string;
  quantity: number;
  totalCents: number;
  pixKey?: string;
}): string {
  const nome = opts.customerName?.trim() || "";
  const oi = nome ? `Olá ${nome}!` : "Olá!";
  const item =
    opts.quantity > 1 ? `${opts.productName} (x${opts.quantity})` : opts.productName;
  const pedido = `${item} / ${formatBRL(opts.totalCents)}`;
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
