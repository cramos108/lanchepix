"use client";

import { useEffect, useState } from "react";
import { Share, Smartphone, X } from "lucide-react";
import { Button, Modal } from "@/components/ui";

const DISMISS_KEY = "pwa_banner_dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  return window.matchMedia("(display-mode: standalone)").matches;
}

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua);
  const webkit = /WebKit/.test(ua);
  const crios = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return ios && webkit && !crios;
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "true";
  } catch {
    return false;
  }
}

function writeDismissed(): void {
  try {
    localStorage.setItem(DISMISS_KEY, "true");
  } catch {
    /* private mode */
  }
}

export function PwaInstallBanner() {
  const [ready, setReady] = useState(false);
  const [androidPrompt, setAndroidPrompt] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [showIos, setShowIos] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    if (isStandalone() || readDismissed()) {
      setReady(true);
      return;
    }
    setShowIos(isIosSafari());
    setReady(true);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      if (readDismissed() || isStandalone()) return;
      setAndroidPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    writeDismissed();
    setAndroidPrompt(null);
    setShowIos(false);
    setIosHelp(false);
  }

  async function installAndroid() {
    if (!androidPrompt) return;
    try {
      await androidPrompt.prompt();
      await androidPrompt.userChoice;
    } catch {
      /* user closed sheet */
    }
    dismiss();
  }

  if (!ready || isStandalone()) return null;

  const showAndroid = Boolean(androidPrompt);
  if (!showAndroid && !showIos) return null;

  return (
    <>
      <div className="print-hidden border-b-2 border-sun bg-surface px-3 py-3">
        <div className="flex items-start gap-2">
          <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-sun" />
          <p className="flex-1 text-sm font-bold leading-snug">
            {showAndroid
              ? "Instale o Pix da Confiança no celular para acesso rápido e offline!"
              : "Adicione o app à sua Tela de Início para usar como um aplicativo real!"}
          </p>
          <button
            type="button"
            aria-label="Fechar"
            className="p-1 text-muted"
            onClick={dismiss}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-2">
          {showAndroid ? (
            <Button className="w-full min-h-11 text-sm" onClick={() => void installAndroid()}>
              Instalar App
            </Button>
          ) : (
            <Button className="w-full min-h-11 text-sm" onClick={() => setIosHelp(true)}>
              Ver como instalar
            </Button>
          )}
        </div>
      </div>

      <Modal
        open={iosHelp}
        title="Instalar no iPhone"
        onClose={() => setIosHelp(false)}
      >
        <ol className="flex flex-col gap-4 text-sm font-bold leading-relaxed">
          <li className="rounded-2xl border-2 border-line bg-surface2 p-3">
            <p className="text-xs font-extrabold uppercase tracking-widest text-sun">
              Passo 1
            </p>
            <p className="mt-1">
              Toque no ícone de Compartilhar (no rodapé do Safari){" "}
              <Share className="inline h-4 w-4 text-sun" />
            </p>
          </li>
          <li className="rounded-2xl border-2 border-line bg-surface2 p-3">
            <p className="text-xs font-extrabold uppercase tracking-widest text-sun">
              Passo 2
            </p>
            <p className="mt-1">
              Role para baixo e selecione &quot;Adicionar à Tela de Início&quot; ➕
            </p>
          </li>
        </ol>
        <Button className="mt-4 w-full" variant="line" onClick={dismiss}>
          Entendi
        </Button>
      </Modal>
    </>
  );
}
