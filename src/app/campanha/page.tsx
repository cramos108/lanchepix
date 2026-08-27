"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { MessageCircle, QrCode, Smartphone, Zap } from "lucide-react";

const WA = process.env.NEXT_PUBLIC_ADS_WHATSAPP ?? "";

function waHref() {
  const text = encodeURIComponent(
    "Oi! Vi o anúncio do Pix da Confiança. Quero anotar Pix Confiança e cobrar no Zap.",
  );
  if (!WA) return `https://wa.me/?text=${text}`;
  const digits = WA.replace(/\D/g, "");
  const n = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${n}?text=${text}`;
}

export default function CampanhaPage() {
  return (
    <div className="min-h-dvh bg-ink text-white">
      <div className="relative mx-auto max-w-lg">
        <img
          src="/ads/street.jpg"
          alt="Barraca de lanche"
          className="h-[52vh] w-full object-cover object-[55%_40%]"
        />
        <div className="absolute inset-x-0 top-0 h-[52vh] bg-gradient-to-b from-black/50 via-transparent to-ink" />
        <div className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] flex items-center gap-2">
          <img
            src="/icons/icon-192.png"
            alt=""
            className="h-11 w-11 rounded-xl border-2 border-sun"
          />
          <span className="text-sm font-black uppercase tracking-[0.16em] text-sun">
            Pix da Confiança
          </span>
        </div>
      </div>

      <main className="relative z-10 mx-auto -mt-16 max-w-lg px-5 pb-16">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-sun">
          Pra quem vende lanche no Brasil
        </p>
        <h1 className="mt-2 text-5xl font-black leading-[0.92] tracking-tight">
          O Pix Confiança
          <span className="block text-sun">não some mais.</span>
        </h1>
        <p className="mt-4 text-lg font-bold text-muted">
          Anota quem levou. Cobra no WhatsApp já escrito. Só baixa o estoque
          quando o Pix cair.
        </p>

        <div className="mt-6 grid gap-3">
          <Step
            n="1"
            icon={<Zap className="h-5 w-5" />}
            title="Anota em 1 toque"
            text="Pix Agora ou Pix Confiança. Sem caderninho, sem esquecer."
          />
          <Step
            n="2"
            icon={<MessageCircle className="h-5 w-5" />}
            title="Cobra no Zap"
            text="Mensagem pronta. Você só aperta e manda."
          />
          <Step
            n="3"
            icon={<QrCode className="h-5 w-5" />}
            title="Confirma o Pix"
            text="Marca pago. Aí sim o estoque baixa."
          />
        </div>

        <div className="mt-8 grid gap-3">
          <Link
            href="/"
            className="inline-flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-sun px-5 text-lg font-black uppercase tracking-wide text-sunink"
          >
            <Smartphone className="h-6 w-6" />
            Usar agora
          </Link>
          <a
            href={waHref()}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-16 items-center justify-center gap-2 rounded-2xl border-2 border-mint bg-mint px-5 text-lg font-black uppercase tracking-wide text-sunink"
          >
            <MessageCircle className="h-6 w-6" />
            Quero no WhatsApp
          </a>
        </div>
        <p className="mt-4 text-center text-sm font-bold text-muted">
          Grátis. Funciona sem internet. Sem baixar loja.
        </p>
        <p className="mt-6 pb-6 text-center text-xs font-bold text-muted">
          <Link href="/termos" className="underline decoration-sun/60 underline-offset-2">
            Termos de uso
          </Link>
          {" · "}
          Pix da Confiança não é um serviço financeiro.
        </p>
      </main>
    </div>
  );
}

function Step({
  n,
  icon,
  title,
  text,
}: {
  n: string;
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3 rounded-2xl border-2 border-line bg-surface p-4">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-sun text-sunink">
        {icon}
      </div>
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-sun">
          Passo {n}
        </p>
        <p className="text-lg font-black leading-tight">{title}</p>
        <p className="text-sm font-bold text-muted">{text}</p>
      </div>
    </div>
  );
}
