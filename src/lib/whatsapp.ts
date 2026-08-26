import { formatBRL } from "./money";
import { toWhatsAppNumber } from "./phone";

export function waLink(phone: string | undefined, message: string): string {
  const text = encodeURIComponent(message);
  if (phone) {
    const n = toWhatsAppNumber(phone);
    if (n) return `https://wa.me/${n}?text=${text}`;
  }
  return `https://wa.me/?text=${text}`;
}

export function paymentReminderMessage(opts: {
  storeName: string;
  customerName?: string;
  productName: string;
  quantity: number;
  totalCents: number;
  pixKey?: string;
}): string {
  const oi = opts.customerName ? `Oi, ${opts.customerName}!` : "Oi!";
  const item =
    opts.quantity > 1 ? `${opts.productName} (x${opts.quantity})` : opts.productName;
  const pix = opts.pixKey ? `\n\nChave Pix: ${opts.pixKey}` : "";
  return (
    `${oi} 👋 Aqui é da *${opts.storeName}*.\n\n` +
    `Você tem um pedido pendente de *${item}* no valor de *${formatBRL(opts.totalCents)}*.\n\n` +
    `Pode pagar via Pix quando puder? Qualquer dúvida, é só chamar! 😊` +
    pix
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
