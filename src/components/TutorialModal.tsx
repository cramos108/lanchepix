"use client";

import { useCallback, useRef, useState, useSyncExternalStore, type TouchEvent } from "react";
import { KeyRound, MessageCircle, Printer, Zap } from "lucide-react";
import { Button } from "@/components/ui";

const STORAGE_KEY = "has_seen_tutorial";

const SLIDES = [
  {
    icon: KeyRound,
    title: "1. Cadastre sua Chave Pix",
    body: "Coloque sua chave Pix nas configurações para receber os pagamentos direto na sua conta.",
  },
  {
    icon: Printer,
    title: "2. Imprima Adesivos QR Code",
    body: "Gere adesivos com QR Code para colar nos seus produtos (lanches, capinhas, embalagens). O cliente leva na hora e paga pelo Pix Confiança!",
  },
  {
    icon: Zap,
    title: "⚡ 3. Venda Rápida e Controle Total",
    body: "Use 'PIX AGORA' ou 'PIX CONFIANÇA'. O app controla seu estoque e soma seu lucro do dia, mês e ano automaticamente!",
  },
  {
    icon: MessageCircle,
    title: "4. Dinheiro na Rua e no Zap",
    body: "Acompanhe no painel exatamente quanto dinheiro você tem a receber e envie cobranças pelo WhatsApp em 1 toque.",
  },
] as const;

function readSeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function subscribeSeen(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

export function TutorialModal({
  open,
  onClose,
  step,
  setStep,
}: {
  open: boolean;
  onClose: () => void;
  step: number;
  setStep: (value: number | ((s: number) => number)) => void;
}) {
  const touchX = useRef<number | null>(null);
  const last = step === SLIDES.length - 1;
  const SlideIcon = SLIDES[step].icon;

  const finish = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      /* ignore quota / private mode */
    }
    onClose();
  }, [onClose]);

  function next() {
    if (last) finish();
    else setStep((s) => s + 1);
  }

  function onTouchStart(event: TouchEvent) {
    touchX.current = event.touches[0]?.clientX ?? null;
  }

  function onTouchEnd(event: TouchEvent) {
    if (touchX.current == null) return;
    const dx = (event.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
    touchX.current = null;
    if (dx < -48 && !last) setStep((s) => s + 1);
    if (dx > 48 && step > 0) setStep((s) => s - 1);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Fechar tutorial"
        className="absolute inset-0 bg-black/80"
        onClick={finish}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
        className="relative z-10 w-full overflow-hidden rounded-t-3xl border-2 border-sun bg-ink p-5 sm:max-w-md sm:rounded-3xl"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-sun">
            Como usar
          </p>
          <button
            type="button"
            onClick={finish}
            className="text-sm font-extrabold uppercase tracking-wide text-muted"
          >
            Pular
          </button>
        </div>

        <div className="flex flex-col items-center px-2 py-4 text-center">
          <div className="mb-5 grid h-20 w-20 place-items-center rounded-3xl border-4 border-sunink bg-sun text-sunink">
            <SlideIcon className="h-10 w-10" strokeWidth={2.4} />
          </div>
          <h2 id="tutorial-title" className="text-2xl font-black leading-tight">
            {SLIDES[step].title}
          </h2>
          <p className="mt-3 text-base font-bold leading-snug text-muted">
            {SLIDES[step].body}
          </p>
        </div>

        <div className="mb-5 flex items-center justify-center gap-2">
          {SLIDES.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Passo ${index + 1}`}
              onClick={() => setStep(index)}
              className={`h-3 rounded-full ${
                index === step ? "w-8 bg-sun" : "w-3 bg-line"
              }`}
            />
          ))}
        </div>

        {last ? (
          <Button className="w-full text-lg" onClick={finish}>
            Começar a Usar de Graça
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={finish}>
              Pular
            </Button>
            <Button onClick={next}>Próximo</Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function useTutorial() {
  const hasSeen = useSyncExternalStore(subscribeSeen, readSeen, () => true);
  const [forced, setForced] = useState<boolean | null>(null);
  const [step, setStep] = useState(0);
  const open = forced ?? !hasSeen;

  return {
    open,
    step,
    setStep,
    openTutorial: () => {
      setStep(0);
      setForced(true);
    },
    closeTutorial: () => setForced(false),
  };
}
