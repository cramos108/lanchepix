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

function isMobileClient(): boolean {
  if (typeof navigator === "undefined") return false;
  if (isStandaloneDisplay()) return true;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
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

function stickerFileName(productName: string): string {
  return `adesivo-qr-${slugFile(productName)}.png`;
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

function imageDocumentHtml(dataUrl: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<style>
  html, body {
    margin: 0;
    min-height: 100%;
    background: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  img {
    max-width: 100%;
    height: auto;
    display: block;
    background: #ffffff;
  }
  @page { margin: 12mm; }
</style>
</head>
<body>
<img src="${dataUrl}" alt="${title}"/>
</body>
</html>`;
}

function downloadPng(dataUrl: string, fileName: string): boolean {
  try {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = fileName;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    return true;
  } catch {
    return false;
  }
}

async function downloadPngBlob(dataUrl: string, fileName: string): Promise<boolean> {
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const ok = downloadPng(url, fileName);
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    return ok;
  } catch {
    return downloadPng(dataUrl, fileName);
  }
}

function openImageWindow(
  dataUrl: string,
  title: string,
  autoPrint: boolean,
): boolean {
  const popup = window.open("", "_blank", "width=420,height=680");
  if (!popup) return false;
  popup.document.open();
  popup.document.write(imageDocumentHtml(dataUrl, title));
  popup.document.close();
  if (!autoPrint) return true;
  const img = popup.document.querySelector("img");
  const triggerPrint = () => {
    window.setTimeout(() => {
      try {
        popup.focus();
        popup.print();
      } catch {
        /* popup may block print; image remains visible */
      }
    }, 50);
  };
  if (img && !img.complete) {
    img.addEventListener("load", triggerPrint, { once: true });
    img.addEventListener("error", triggerPrint, { once: true });
  } else {
    triggerPrint();
  }
  return true;
}

export async function exportQrCardPng(productName: string): Promise<void> {
  const fileName = stickerFileName(productName);
  const dataUrl = await captureQrCard();
  if (!dataUrl.startsWith("data:image/")) {
    throw new Error("PNG capture failed");
  }

  if (isMobileClient()) {
    const opened = openImageWindow(dataUrl, fileName, false);
    if (!opened) {
      const saved = await downloadPngBlob(dataUrl, fileName);
      if (saved) {
        toast("Adesivo QR salvo como imagem.");
        return;
      }
      toast("Não foi possível abrir o adesivo QR.", "err");
    }
    return;
  }

  const printed = openImageWindow(dataUrl, fileName, true);
  if (!printed) {
    const saved = await downloadPngBlob(dataUrl, fileName);
    if (saved) {
      toast("Adesivo QR salvo como imagem.");
      return;
    }
    toast("Não foi possível abrir a impressão do QR.", "err");
  }
}
