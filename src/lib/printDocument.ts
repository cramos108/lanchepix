"use client";

import { toast } from "@/lib/toast";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

export function buildQrPrintHtml(opts: {
  qrDataUrl: string;
  storeName?: string;
  productName: string;
  priceLabel: string;
  footer: string;
}): string {
  const store = opts.storeName
    ? `<p class="store">${escapeHtml(opts.storeName)}</p>`
    : "";
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(opts.productName)}</title>
<style>
  @page { margin: 12mm; }
  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #000000;
    font-family: Arial, Helvetica, sans-serif;
  }
  .sheet {
    min-height: 100vh;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 10% 16px 24px;
    box-sizing: border-box;
    background: #ffffff;
  }
  .card {
    width: 80%;
    max-width: 400px;
    text-align: center;
    background: #ffffff;
    color: #000000;
    border: 3px solid #000000;
    padding: 24px 20px;
    box-sizing: border-box;
  }
  .store {
    margin: 0;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #000000;
  }
  .name {
    margin: 12px 0 8px;
    font-size: 28px;
    font-weight: 900;
    line-height: 1.15;
    color: #000000;
  }
  .price {
    margin: 0 0 16px;
    font-size: 32px;
    font-weight: 900;
    color: #000000;
  }
  img {
    width: 250px;
    height: 250px;
    display: block;
    margin: 0 auto;
    background: #ffffff;
  }
  .foot {
    margin: 16px 0 0;
    font-size: 13px;
    font-weight: 800;
    line-height: 1.3;
    color: #000000;
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="card">
      ${store}
      <p class="name">${escapeHtml(opts.productName)}</p>
      <p class="price">${escapeHtml(opts.priceLabel)}</p>
      <img src="${opts.qrDataUrl}" width="250" height="250" alt="QR ${escapeHtml(opts.productName)}" />
      <p class="foot">${escapeHtml(opts.footer)}</p>
    </div>
  </div>
</body>
</html>`;
}
