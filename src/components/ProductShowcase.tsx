"use client";

import type { LucideIcon } from "lucide-react";
import {
  CreditCard,
  Handshake,
  Package,
  QrCode,
  Star,
  Store,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { APP_NAME } from "@/lib/brand";
import { APP_ORIGIN, goToApp } from "@/lib/site";

const DEMO_PIX = "https://app.pixdaconfianca.com";

const NAV = [
  { label: "Vender", icon: Store, active: true },
  { label: "Catálogo", icon: Package, active: false },
  { label: "Histórico", icon: Handshake, active: false },
  { label: "Cartão", icon: CreditCard, active: false },
  { label: "Pix", icon: QrCode, active: false },
] as const;

function DeviceChrome({
  kind,
  label,
  children,
}: {
  kind: "iphone" | "android" | "ipad";
  label: string;
  children: React.ReactNode;
}) {
  const shell =
    kind === "iphone"
      ? "h-[470px] w-[230px] rounded-[2.6rem] bg-[#1c1c1e] p-[9px]"
      : kind === "android"
        ? "h-[450px] w-[210px] rounded-[1.85rem] bg-[#111111] p-[8px]"
        : "h-[380px] w-[290px] rounded-[1.5rem] bg-[#2a2a2c] p-[12px]";
  const screen =
    kind === "iphone"
      ? "rounded-[2.05rem]"
      : kind === "android"
        ? "rounded-[1.35rem]"
        : "rounded-[0.9rem]";
  return (
    <figure className="shrink-0 snap-center" aria-label={label}>
      <div
        className={`relative ${shell} shadow-[0_28px_60px_rgba(15,23,42,0.28)] ring-1 ring-black/30`}
      >
        {kind === "iphone" ? (
          <span className="absolute left-1/2 top-3 z-10 h-[22px] w-[78px] -translate-x-1/2 rounded-full bg-black" />
        ) : kind === "android" ? (
          <span className="absolute left-1/2 top-2.5 z-10 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-black ring-2 ring-[#2a2a2a]" />
        ) : (
          <span className="absolute left-1/2 top-1.5 z-10 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-black/80" />
        )}
        <div
          className={`relative h-full overflow-hidden bg-[#070707] text-white ${screen}`}
        >
          {children}
        </div>
        {kind === "iphone" ? (
          <span className="pointer-events-none absolute bottom-2 left-1/2 h-1 w-24 -translate-x-1/2 rounded-full bg-white/35" />
        ) : null}
      </div>
      <figcaption className="mt-3 text-center text-[11px] font-extrabold uppercase tracking-widest text-slate-500">
        {label}
      </figcaption>
    </figure>
  );
}

function MockNav({ active }: { active: "Vender" | "Cartão" }) {
  return (
    <div className="mt-auto grid grid-cols-5 border-t border-[#3d3d3d] bg-[#070707] px-0.5 pb-2 pt-1">
      {NAV.map((item) => {
        const Icon = item.icon;
        const on = item.label === active;
        return (
          <div
            key={item.label}
            className={`flex flex-col items-center gap-0.5 ${
              on ? "text-[#FACC15]" : "text-[#d0d0d0]/60"
            }`}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={on ? 2.6 : 2} />
            <span className="text-[6px] font-extrabold uppercase">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function DashboardScreen() {
  return (
    <div className="flex h-full flex-col bg-[#070707] pt-8">
      <div className="flex items-center justify-between px-3">
        <p className="text-[8px] font-black uppercase tracking-[0.14em] text-[#FACC15]">
          {APP_NAME}
        </p>
        <span className="rounded-full border border-[#3d3d3d] px-1.5 py-0.5 text-[7px] font-black uppercase">
          Vender
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1 px-2">
        <div className="rounded-xl border-2 border-[#FACC15] bg-[#FACC15] px-2 py-1.5 text-[#111]">
          <p className="text-[6px] font-extrabold uppercase tracking-widest">Hoje</p>
          <p className="text-[13px] font-black leading-none">R$ 186,00</p>
        </div>
        <div className="rounded-xl border-2 border-[#3d3d3d] bg-[#141414] px-2 py-1.5">
          <p className="text-[6px] font-extrabold uppercase tracking-widest text-[#FACC15]">
            Semana
          </p>
          <p className="text-[13px] font-black leading-none">R$ 940,00</p>
        </div>
      </div>
      <div className="mt-2 px-3">
        <p className="text-center text-[8px] font-black">Coxinha × 1</p>
        <p className="text-center text-[16px] font-black leading-none text-[#FACC15]">
          R$ 8,50
        </p>
      </div>
      <div className="mt-1.5 flex justify-center">
        <div className="rounded-2xl bg-white p-1.5 shadow-[0_0_0_3px_#FACC15]">
          <QRCodeSVG
            value={DEMO_PIX}
            size={92}
            bgColor="#ffffff"
            fgColor="#000000"
            level="M"
            includeMargin={false}
          />
        </div>
      </div>
      <p className="mt-1.5 text-center text-[7px] font-extrabold uppercase tracking-widest text-[#FACC15]">
        Escaneie o Pix
      </p>
      <div className="mt-2 grid grid-cols-2 gap-1 px-2">
        <span className="rounded-lg bg-amber-400 py-1.5 text-center text-[7px] font-black uppercase text-[#111]">
          Pix confiança
        </span>
        <span className="rounded-lg bg-[#FACC15] py-1.5 text-center text-[7px] font-black uppercase text-[#111]">
          Pix agora
        </span>
      </div>
      <MockNav active="Vender" />
    </div>
  );
}

function FeaturesTabletScreen({
  features,
}: {
  features: ReadonlyArray<{ title: string; icon: LucideIcon }>;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#0F172A] px-3 pt-6">
      <p className="text-[11px] font-black leading-tight">
        Tudo que a banca precisa, no bolso
      </p>
      <p className="mt-1 text-[8px] font-semibold leading-snug text-slate-300">
        Do QR na hora até o relatório do MEI. Sem maquininha, sem taxa por venda.
      </p>
      <ul className="mt-2 flex flex-1 flex-col gap-1.5 overflow-hidden">
        {features.slice(0, 4).map((f) => {
          const Icon = f.icon;
          return (
            <li key={f.title} className="flex items-start gap-1.5">
              <Icon className="mt-0.5 h-3 w-3 shrink-0 text-[#FACC15]" />
              <span className="text-[8px] font-black leading-tight">{f.title}</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-1 flex flex-col items-center pb-2">
        <img
          src="/images/celio-founder-app.jpg"
          alt=""
          className="h-[92px] w-auto object-contain"
        />
        <p className="mt-1 text-center text-[7px] font-medium tracking-wide text-slate-400">
          Celio Ramos • Criador do Pix da Confiança
        </p>
      </div>
    </div>
  );
}

function LoyaltyScreen() {
  const filled = 7;
  return (
    <div className="flex h-full flex-col bg-[#070707] pt-7">
      <p className="px-3 text-[8px] font-black uppercase tracking-[0.14em] text-[#FACC15]">
        Cartão fidelidade
      </p>
      <div className="mt-2 px-3">
        <p className="text-[13px] font-black leading-tight">Maria Silva</p>
        <p className="text-[8px] font-bold text-[#4fc3ff]">5511999887766</p>
      </div>
      <div className="mx-2 mt-2 rounded-2xl border-2 border-[#FACC15] bg-[#141414] p-2">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[7px] font-extrabold uppercase tracking-widest text-[#FACC15]">
            Cartão fidelidade
          </p>
          <p className="text-[11px] font-black tabular-nums">{filled}/10</p>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {Array.from({ length: 10 }, (_, i) => {
            const on = i < filled;
            return (
              <div
                key={i}
                className={`grid aspect-square place-items-center rounded-full border-2 ${
                  on
                    ? "border-[#111] bg-[#FACC15] text-[#111]"
                    : "border-[#FACC15]/70 bg-[#070707] text-[#FACC15]"
                }`}
              >
                {on ? (
                  <Star className="h-2.5 w-2.5 fill-current" />
                ) : (
                  <span className="text-[6px] font-black">{i + 1}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-2 px-2">
        <div className="rounded-xl bg-[#FACC15] py-1.5 text-center text-[8px] font-black uppercase text-[#111]">
          +1 carimbo
        </div>
        <div className="mt-1 rounded-xl border-2 border-[#13e67a] bg-[#13e67a] py-1.5 text-center text-[8px] font-black uppercase text-[#111]">
          Avisar no WhatsApp
        </div>
      </div>
      <p className="mt-2 px-3 text-[7px] font-bold leading-snug text-[#d0d0d0]">
        Faltam 3 carimbos para 1 brinde grátis.
      </p>
      <MockNav active="Cartão" />
    </div>
  );
}

export function ProductShowcase({
  features,
}: {
  features: ReadonlyArray<{ title: string; icon: LucideIcon }>;
}) {
  return (
    <section
      id="como-funciona"
      className="bg-[#F8FAFC] px-4 py-16 text-slate-950"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-500">
            Como funciona o app
          </p>
          <h2 className="mt-2 text-3xl font-black leading-tight tracking-tight md:text-4xl">
            Seu Negócio, Mais Profissional do que Nunca
          </h2>
          <p className="mt-3 text-base font-semibold leading-relaxed text-slate-600 md:text-lg">
            Assuma o controle total do seu caixa direto no celular. Funciona
            offline e sem maquininha.
          </p>
        </div>

        <div className="no-scrollbar mt-10 flex snap-x snap-mandatory items-end gap-6 overflow-x-auto pb-4 md:relative md:h-[560px] md:overflow-visible md:justify-center">
          <div className="snap-center md:absolute md:left-[4%] md:top-8 md:-rotate-6 md:scale-[0.92]">
            <DeviceChrome kind="ipad" label="iPad · Recursos">
              <FeaturesTabletScreen features={features} />
            </DeviceChrome>
          </div>
          <div className="snap-center md:relative md:z-20 md:-translate-y-3">
            <DeviceChrome kind="iphone" label="iPhone · Vender + Pix">
              <DashboardScreen />
            </DeviceChrome>
          </div>
          <div className="snap-center md:absolute md:right-[6%] md:top-12 md:rotate-6 md:scale-[0.92]">
            <DeviceChrome kind="android" label="Android · Fidelidade">
              <LoyaltyScreen />
            </DeviceChrome>
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <a
            href={APP_ORIGIN}
            className="inline-flex min-h-14 w-full max-w-md items-center justify-center rounded-2xl bg-[#FACC15] px-6 text-base font-black uppercase tracking-wide text-slate-950 md:w-auto"
            onClick={(e) => {
              e.preventDefault();
              goToApp();
            }}
          >
            USE GRÁTIS NO CELULAR
          </a>
        </div>
      </div>
    </section>
  );
}
