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

function slugFile(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "produto";
}

export function stickerFileName(productName: string): string {
  return `adesivo-qr-${slugFile(productName)}.png`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeJs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

function flattenUnsupportedColors(root: HTMLElement, view: Window | null): void {
  const nodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
  for (const node of nodes) {
    const style = view?.getComputedStyle(node);
    if (!style) continue;
    const props = [
      "color",
      "background-color",
      "border-color",
      "border-top-color",
      "border-right-color",
      "border-bottom-color",
      "border-left-color",
      "outline-color",
      "text-decoration-color",
    ] as const;
    for (const prop of props) {
      const value = style.getPropertyValue(prop);
      if (
        value &&
        (value.includes("oklch") ||
          value.includes("oklab") ||
          value.includes("lab(") ||
          value.includes("lch(") ||
          value.includes("color("))
      ) {
        const fallback = prop.includes("background") ? "#ffffff" : "#000000";
        node.style.setProperty(prop, fallback, "important");
      }
    }
    node.style.boxShadow = "none";
  }
  root.style.setProperty("background-color", "#ffffff", "important");
  root.style.setProperty("color", "#000000", "important");
  root.style.setProperty("border-color", "#000000", "important");
}

async function captureQrCard(): Promise<string> {
  const card = document.getElementById("qr-card-only");
  if (!card) {
    throw new Error("QR card not found");
  }
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(card, {
    backgroundColor: "#ffffff",
    scale: 3,
    useCORS: true,
    logging: false,
    ignoreElements: (el) =>
      el.classList.contains("qr-preview-only") ||
      Boolean(el.closest(".qr-preview-only")) ||
      el.tagName === "CANVAS",
    onclone: (doc, el) => {
      flattenUnsupportedColors(el, doc.defaultView);
      el.querySelectorAll(".qr-preview-only, canvas").forEach((node) => {
        (node as HTMLElement).style.display = "none";
      });
    },
  });
  return canvas.toDataURL("image/png");
}

function cloneQrCardHtml(): string | null {
  const card = document.getElementById("qr-card-only");
  if (!card) return null;
  const clone = card.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("canvas, .qr-preview-only").forEach((node) => node.remove());
  return clone.outerHTML;
}

export function openQrPrintWorkspace(): Window | null {
  return window.open("", "_blank", "width=420,height=720");
}

export function buildQrPrintWorkspaceHtml(
  cardHtml: string,
  fileName: string,
): string {
  const title = escapeHtml(fileName);
  const fileJs = escapeJs(fileName);
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<style>
  html, body {
    margin: 0;
    background: #ffffff;
    color: #000000;
    font-family: Arial, Helvetica, sans-serif;
  }
  .no-print {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    padding: 12px;
    background: #ffffff;
    border-bottom: 1px solid #dddddd;
  }
  .no-print button {
    min-height: 44px;
    padding: 10px 14px;
    border: 2px solid #000000;
    border-radius: 10px;
    background: #ffe500;
    color: #111111;
    font-size: 14px;
    font-weight: 800;
  }
  .no-print button.secondary {
    background: #ffffff;
  }
  #qr-card-only {
    max-width: 320px;
    margin: 20px auto;
    border: 3px solid #000;
    border-radius: 16px;
    padding: 20px;
    text-align: center;
    box-sizing: border-box;
    background: #ffffff;
    color: #000000;
  }
  #qr-card-only p {
    margin: 8px 0;
    font-weight: 800;
    color: #000000;
  }
  #qr-card-only canvas,
  #qr-card-only .qr-preview-only {
    display: none !important;
  }
  #qr-card-only img.qr-brand-logo {
    width: 72px;
    height: 72px;
    object-fit: contain;
    display: block;
    margin: 0 auto 8px;
    background: #ffffff;
  }
  #qr-card-only .qr-store-premium {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: none;
  }
  #qr-card-only .qr-instagram {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 800;
  }
  #qr-card-only img.printable-qr-img {
    width: 250px;
    height: 250px;
    display: block;
    margin: 12px auto;
    background: #ffffff;
  }
  @media print {
    .no-print { display: none !important; }
    @page { margin: 10mm; }
  }
</style>
</head>
<body>
  <div class="no-print">
    <button type="button" id="btn-print">Imprimir / Salvar PDF</button>
    <button type="button" id="btn-download" class="secondary">Baixar Imagem</button>
    <button type="button" id="btn-close" class="secondary">✖ Fechar</button>
  </div>
  ${cardHtml}
  <script>
    window.__stickerPng = "";
    document.getElementById("btn-print").onclick = function () {
      window.print();
    };
    document.getElementById("btn-close").onclick = function () {
      window.close();
    };
    document.getElementById("btn-download").onclick = function () {
      var url = window.__stickerPng;
      if (!url) {
        var img = document.querySelector("#qr-card-only img.printable-qr-img");
        url = img ? img.src : "";
      }
      if (!url) return;
      var a = document.createElement("a");
      a.href = url;
      a.download = '${fileJs}';
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    };
  </script>
</body>
</html>`;
}

export function writeQrPrintWorkspace(
  popup: Window,
  productName: string,
): boolean {
  const cardHtml = cloneQrCardHtml();
  if (!cardHtml) {
    toast("Não foi possível encontrar o QR para impressão.", "err");
    return false;
  }
  const fileName = stickerFileName(productName);
  popup.document.open();
  popup.document.write(buildQrPrintWorkspaceHtml(cardHtml, fileName));
  popup.document.close();
  popup.focus();
  void captureQrCard()
    .then((png) => {
      try {
        (popup as Window & { __stickerPng?: string }).__stickerPng = png;
      } catch {
        /* popup may already be closed */
      }
    })
    .catch(() => {
      /* download still uses the QR img already in the workspace */
    });
  return true;
}

export function fillQrPrintWorkspace(
  popup: Window | null,
  productName: string,
): void {
  if (!popup || popup.closed) {
    toast("Permita pop-ups para abrir o adesivo QR.", "err");
    return;
  }
  if (!writeQrPrintWorkspace(popup, productName)) {
    try {
      popup.close();
    } catch {
      /* ignore */
    }
  }
}
