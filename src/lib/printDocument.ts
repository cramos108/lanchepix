"use client";

import { toast } from "@/lib/toast";

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches
  );
}

function safePrint(target: Window | null | undefined): boolean {
  if (!target || typeof target.print !== "function") return false;
  try {
    target.focus();
    target.print();
    return true;
  } catch {
    return false;
  }
}

function waitForImages(doc: Document): Promise<void> {
  const images = Array.from(doc.images);
  if (!images.length) return Promise.resolve();
  return Promise.all(
    images.map(
      (img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.addEventListener("load", () => resolve(), { once: true });
              img.addEventListener("error", () => resolve(), { once: true });
            }),
    ),
  ).then(() => undefined);
}

function printViaIframe(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("title", "Impressão QR");
    iframe.setAttribute("aria-hidden", "true");
    iframe.setAttribute("tabindex", "-1");
    iframe.style.cssText =
      "position:fixed;left:-10000px;top:0;width:800px;height:1000px;border:0;";

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      iframe.remove();
    };

    document.body.appendChild(iframe);
    const win = iframe.contentWindow;
    const doc = iframe.contentDocument ?? win?.document;
    if (!win || !doc) {
      cleanup();
      reject(new Error("iframe document unavailable"));
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    void waitForImages(doc)
      .then(
        () =>
          new Promise<void>((done) => {
            window.setTimeout(done, 50);
          }),
      )
      .then(() => {
        if (!safePrint(win)) {
          cleanup();
          reject(new Error("iframe print unavailable"));
          return;
        }
        win.addEventListener("afterprint", cleanup, { once: true });
        window.setTimeout(cleanup, 120000);
        resolve();
      })
      .catch((err: unknown) => {
        cleanup();
        reject(err);
      });
  });
}

function printViaPopup(html: string): boolean {
  const popup = window.open("", "_blank", "width=480,height=720");
  if (!popup) return false;
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  void waitForImages(popup.document).then(() => {
    window.setTimeout(() => {
      if (!safePrint(popup)) {
        try {
          popup.close();
        } catch {
          /* ignore */
        }
        return;
      }
      popup.addEventListener("afterprint", () => popup.close(), { once: true });
      window.setTimeout(() => {
        try {
          popup.close();
        } catch {
          /* ignore */
        }
      }, 120000);
    }, 50);
  });
  return true;
}

export function printHtmlDocument(html: string): void {
  void printViaIframe(html).catch(() => {
    try {
      if (printViaPopup(html)) return;
    } catch {
      /* last-resort below */
    }
    if (isStandaloneDisplay()) {
      toast("Abra no navegador para imprimir o QR.", "err");
      return;
    }
    toast("Não foi possível abrir a impressão do QR.", "err");
  });
}

export function wrapQrCardHtml(cardHtml: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>QR Code</title>
<style>
  body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #ffffff; }
  #qr-card-only { width: 320px; border: 3px solid #000000; border-radius: 16px; padding: 24px; text-align: center; box-sizing: border-box; }
  @page { size: auto; margin: 15mm; }
  #qr-card-only {
    background: #ffffff;
    color: #000000;
    font-family: Arial, Helvetica, sans-serif;
  }
  #qr-card-only p {
    margin: 8px 0;
    color: #000000;
    font-weight: 800;
  }
  #qr-card-only canvas,
  #qr-card-only .qr-preview-only,
  #qr-card-only img:not(.printable-qr-img) {
    display: none !important;
  }
  #qr-card-only img.printable-qr-img {
    width: 250px;
    height: 250px;
    display: block;
    margin: 12px auto;
    background: #ffffff;
  }
</style>
</head>
<body>
${cardHtml}
</body>
</html>`;
}

export function printQrCardOnly(): void {
  const card = document.getElementById("qr-card-only");
  if (!card) {
    toast("Não foi possível encontrar o QR para impressão.", "err");
    return;
  }
  printHtmlDocument(wrapQrCardHtml(card.outerHTML));
}
