"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  FileSpreadsheet,
  MessageCircle,
  QrCode,
  Shield,
  Smartphone,
  Users,
  WifiOff,
  Zap,
} from "lucide-react";
import { BillingToggle } from "@/components/BillingToggle";
import { APP_NAME } from "@/lib/brand";
import {
  planAnnualSaveHint,
  planPriceLabel,
  type BillingInterval,
} from "@/lib/plan";
import { APP_ORIGIN, goToApp } from "@/lib/site";

const CARD = "#1E293B";

const FEATURES = [
  {
    icon: Zap,
    title: "Pix Instantâneo na Tela",
    text: "QR Code dinâmico com chave estática configurável. O cliente aponta a câmera e paga na hora.",
  },
  {
    icon: MessageCircle,
    title: "Comprovante no WhatsApp",
    text: "Envie recibos e lembretes de cobrança em 1 clique, já com valor, loja e chave Pix.",
  },
  {
    icon: WifiOff,
    title: "Funciona 100% Offline",
    text: "Venda e cadastre sem depender do sinal da rua. Quando voltar a internet, sincroniza.",
  },
  {
    icon: Shield,
    title: "Modo Privacidade Total",
    text: "Oculte seus saldos e faturamento da tela com 1 toque para trabalhar com segurança em locais públicos.",
  },
  {
    icon: Users,
    title: "Gestão de Ajudantes",
    text: "Controle de vendas por atendente e múltiplos aparelhos no plano Negócio.",
  },
  {
    icon: FileSpreadsheet,
    title: "Relatório Fiscal MEI",
    text: "Exportação de relatórios em PDF e Excel para a DASN-SIMEI e o controle do mês.",
  },
] as const;

const FAQ = [
  {
    q: "Preciso pagar taxa por venda?",
    a: "Não. O app não cobra comissão sobre o seu Pix. O dinheiro cai direto na chave da sua conta. Você só escolhe um plano se quiser recursos extras.",
  },
  {
    q: "Funciona se acabar a internet na feira?",
    a: "Sim. O app funciona offline: anota venda, fiado e catálogo neste celular. Quando reconectar, sincroniza com a nuvem.",
  },
  {
    q: "Como funciona o relatório para MEI?",
    a: "No Histórico você gera demonstrativos prontos em PDF (Pro) e Excel (Negócio) para a declaração anual e o controle do caixa.",
  },
  {
    q: "Preciso de maquininha ou cadastro no banco?",
    a: "Não. Basta a sua chave Pix. O QR é gerado no celular e o cliente paga no app do banco dele. Pix da Confiança não processa o dinheiro.",
  },
] as const;

function AppCta({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return (
    <a
      href={APP_ORIGIN}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        goToApp();
      }}
    >
      {children}
    </a>
  );
}

function HashLink({
  hash,
  className,
  children,
}: {
  hash: "#recursos" | "#precos" | "#faq" | "#topo";
  className?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <a
      href={`/${hash}`}
      className={className}
      onClick={(e) => {
        if (pathname === "/" || pathname === "/site") {
          e.preventDefault();
          document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" });
          window.history.replaceState(null, "", hash);
        }
      }}
    >
      {children}
    </a>
  );
}

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0F172A]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <a href="/" className="flex items-center gap-2">
          <img
            src="/icons/icon-192.png"
            alt=""
            className="h-9 w-9 rounded-xl border border-[#FACC15]/40"
          />
          <span className="text-sm font-black uppercase tracking-[0.14em] text-[#FACC15]">
            {APP_NAME}
          </span>
        </a>
        <nav className="hidden items-center gap-5 text-sm font-bold text-slate-300 md:flex">
          <HashLink hash="#recursos" className="hover:text-white">
            Recursos
          </HashLink>
          <HashLink hash="#precos" className="hover:text-white">
            Planos
          </HashLink>
          <HashLink hash="#faq" className="hover:text-white">
            FAQ
          </HashLink>
        </nav>
        <AppCta className="inline-flex min-h-11 items-center rounded-2xl border-2 border-[#FACC15] bg-[#FACC15] px-4 text-sm font-black uppercase tracking-wide text-slate-950">
          Ir para o App / Entrar
        </AppCta>
      </div>
    </header>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#0B1220] px-4 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p className="text-sm font-bold text-slate-400">
          © 2026 {APP_NAME} — O parceiro do vendedor brasileiro.
        </p>
        <div className="flex flex-wrap gap-4 text-sm font-extrabold">
          <AppCta className="text-[#FACC15] hover:underline">
            Entrar no App
          </AppCta>
          <a href="/termos" className="text-slate-300 hover:text-white">
            Termos de Uso
          </a>
          <a href="/privacidade" className="text-slate-300 hover:text-white">
            Política de Privacidade
          </a>
        </div>
      </div>
    </footer>
  );
}

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#0F172A] text-white">
      <LandingHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 text-base leading-relaxed">
        {children}
      </main>
      <LandingFooter />
    </div>
  );
}

export function LandingPage() {
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [hide, setHide] = useState(true);
  const [picked, setPicked] = useState(0);
  const products = [
    { name: "Coxinha", price: "R$ 8,50" },
    { name: "Guaraná", price: "R$ 6,00" },
    { name: "Pastel", price: "R$ 10,00" },
  ];

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    window.requestAnimationFrame(() => {
      document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" });
    });
  }, []);

  return (
    <div id="topo" className="min-h-dvh bg-[#0F172A] text-white">
      <LandingHeader />

      <section
        className="relative flex min-h-[85vh] items-center bg-[#0F172A] px-4 py-12 md:py-16"
        style={{
          background:
            "linear-gradient(180deg, rgba(15, 23, 42, 0.75) 0%, rgba(15, 23, 42, 0.85) 100%), url('/images/hero-street-vendor.jpg') center/cover no-repeat",
        }}
      >
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 md:grid-cols-2">
          <div className="text-center md:text-left">
            <p className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[#FACC15]">
              <Smartphone className="h-4 w-4" />
              PDV no celular · Pix · MEI
            </p>
            <h1 className="mt-3 text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl md:text-6xl">
              O App do Microempreendedor
            </h1>
            <p className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-base font-semibold leading-relaxed text-white sm:text-lg md:justify-start md:text-xl">
              <span>Controle de Estoque</span>
              <span aria-hidden className="text-[#FACC15]">
                •
              </span>
              <span>Fidelidade Digital</span>
              <span aria-hidden className="text-[#FACC15]">
                •
              </span>
              <span>Cobrança Fiado no Zap</span>
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row md:items-stretch">
              <AppCta className="inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#FACC15] px-6 text-base font-black uppercase tracking-wide text-slate-950 sm:w-auto">
                USE GRÁTIS NO CELULAR
              </AppCta>
              <HashLink
                hash="#precos"
                className="inline-flex min-h-14 w-full items-center justify-center rounded-2xl border-2 border-white/30 bg-black/20 px-6 text-base font-black uppercase tracking-wide text-white backdrop-blur-sm hover:border-[#FACC15] hover:text-[#FACC15] sm:w-auto"
              >
                Ver Planos
              </HashLink>
            </div>
            <p className="mt-4 text-sm font-bold text-white">
              pixdaconfianca.com • Sem baixar nada!
            </p>
          </div>

          <div className="mx-auto w-full max-w-sm md:justify-self-end">
            <div className="relative">
              <div
                aria-hidden
                className="absolute -inset-6 rounded-[2.75rem] bg-[#FACC15]/15 blur-2xl"
              />
              <div
                className="relative rounded-[2rem] border-2 border-white/15 p-3 shadow-[0_0_0_1px_rgba(250,204,21,0.18),0_28px_80px_rgba(0,0,0,0.55)] md:-rotate-1"
                style={{ background: CARD }}
              >
                <div className="flex items-center justify-between px-2 py-2">
                  <p className="text-[11px] font-extrabold uppercase tracking-widest text-[#FACC15]">
                    {APP_NAME}
                  </p>
                  <button
                    type="button"
                    onClick={() => setHide((v) => !v)}
                    className="rounded-full border border-white/15 px-3 py-1 text-[10px] font-black uppercase text-slate-200"
                  >
                    {hide ? "Mostrar saldo" : "Ocultar saldo"}
                  </button>
                </div>
                <div className="rounded-3xl bg-[#0F172A] p-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                    Hoje
                  </p>
                  <p className="text-3xl font-black tabular-nums text-[#FACC15]">
                    {hide ? "R$ ●●●●" : "R$ 186,00"}
                  </p>
                  <p className="text-xs font-bold text-[#10B981]">3 vendas · Pix</p>
                </div>
                <ul className="mt-3 flex flex-col gap-2">
                  {products.map((p, i) => (
                    <li key={p.name}>
                      <button
                        type="button"
                        onClick={() => setPicked(i)}
                        className={`flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left ${
                          picked === i
                            ? "border-[#FACC15] bg-[#FACC15]/10"
                            : "border-white/10 bg-[#0F172A]"
                        }`}
                      >
                        <span className="font-black">{p.name}</span>
                        <span className="font-black text-[#FACC15]">{p.price}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <span className="rounded-2xl bg-amber-400/90 py-3 text-center text-xs font-black uppercase text-slate-950">
                    Pix confiança
                  </span>
                  <span className="inline-flex items-center justify-center gap-1 rounded-2xl bg-[#FACC15] py-3 text-center text-xs font-black uppercase text-slate-950">
                    <QrCode className="h-3.5 w-3.5" />
                    Pix agora
                  </span>
                </div>
                <p className="mt-3 text-center text-[11px] font-bold text-slate-400">
                  Preview interativo · toque nos itens e no saldo
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="recursos" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16">
        <h2 className="text-3xl font-black">Tudo que a banca precisa, no bolso</h2>
        <p className="mt-2 max-w-2xl font-semibold text-slate-300">
          Do QR na hora até o relatório do MEI. Sem maquininha, sem taxa por
          venda.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <article
                key={f.title}
                className="rounded-3xl border border-white/10 p-5"
                style={{ background: CARD }}
              >
                <Icon className="h-8 w-8 text-[#FACC15]" />
                <h3 className="mt-3 text-lg font-black">{f.title}</h3>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-300">
                  {f.text}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="precos" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h2 className="text-3xl font-black">Planos claros, sem surpresa</h2>
            <p className="mt-2 font-semibold text-slate-300">
              Comece grátis. Suba de plano só quando a banca pedir.
            </p>
          </div>
          <div className="w-full max-w-md">
            <BillingToggle value={interval} onChange={setInterval} dark />
          </div>
        </div>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <PlanCard
            name="GRÁTIS"
            price={planPriceLabel("free", interval)}
            points={[
              "Vendas ilimitadas",
              "QR Code Pix",
              "Até 100 clientes no fidelidade",
            ]}
            cta="Usar Grátis"
          />
          <PlanCard
            name="PRO"
            price={planPriceLabel("pro", interval)}
            hint={interval === "year" ? planAnnualSaveHint("pro") : undefined}
            points={[
              "Relatórios em PDF",
              "Cobrança via WhatsApp",
              "Backup na nuvem",
            ]}
            cta="Testar Pro"
          />
          <PlanCard
            name="NEGÓCIO"
            price={planPriceLabel("equipe", interval)}
            hint={
              interval === "year"
                ? `Mais Popular · ${planAnnualSaveHint("equipe")}`
                : "Mais Popular"
            }
            popular
            points={[
              "Multi-dispositivo (Ajudantes)",
              "Exportação em Excel (.xlsx)",
              "Relatórios por Vendedor",
            ]}
            cta="Assinar Negócio"
          />
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl scroll-mt-24 px-4 py-16">
        <h2 className="text-3xl font-black">Perguntas rápidas</h2>
        <div className="mt-6 flex flex-col gap-2">
          {FAQ.map((item, i) => {
            const open = openFaq === i;
            return (
              <article
                key={item.q}
                className="overflow-hidden rounded-2xl border border-white/10"
                style={{ background: CARD }}
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                  onClick={() => setOpenFaq(open ? null : i)}
                  aria-expanded={open}
                >
                  <span className="font-black">{item.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-[#FACC15] transition ${
                      open ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {open ? (
                  <p className="border-t border-white/10 px-4 py-3 text-sm font-semibold leading-relaxed text-slate-300">
                    {item.a}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}

function PlanCard({
  name,
  price,
  hint,
  points,
  cta,
  popular,
}: {
  name: string;
  price: string;
  hint?: string;
  points: string[];
  cta: string;
  popular?: boolean;
}) {
  return (
    <article
      className={`flex flex-col rounded-3xl border-2 p-5 ${
        popular ? "border-[#FACC15]" : "border-white/10"
      }`}
      style={{ background: CARD }}
    >
      {hint ? (
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-[#FACC15]">
          {hint}
        </p>
      ) : (
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500">
          Plano
        </p>
      )}
      <h3 className="mt-1 text-2xl font-black">{name}</h3>
      <p className="mt-2 text-3xl font-black text-[#FACC15]">{price}</p>
      <ul className="mt-4 flex flex-1 flex-col gap-2 text-sm font-semibold text-slate-300">
        {points.map((p) => (
          <li key={p} className="flex gap-2">
            <span className="text-[#10B981]">✓</span>
            {p}
          </li>
        ))}
      </ul>
      <AppCta
        className={`mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl px-4 text-sm font-black uppercase ${
          popular
            ? "bg-[#FACC15] text-slate-950"
            : "border-2 border-white/20 text-white"
        }`}
      >
        {cta}
      </AppCta>
    </article>
  );
}


