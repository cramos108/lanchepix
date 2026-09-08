const EMOJI: Record<string, string> = {
  Salgados: "🥟",
  "Bolo no Pote": "🍮",
  Doces: "🍰",
  Bebidas: "🥤",
  Combos: "🍱",
  Capinhas: "📱",
  Películas: "📲",
  Cabos: "🔌",
  Fones: "🎧",
  Meias: "🧦",
  Bonés: "🧢",
  "Óculos de Sol": "🕶️",
  Bijuterias: "💍",
  "Panos de Prato": "🧺",
  Tapetes: "🧶",
  Utensílios: "🍴",
  Sabonetes: "🧼",
  Perfumes: "🌸",
  Maquiagem: "💄",
  "Batons / Maquiagem": "💄",
  "Perfumes / Colônias": "🌸",
  "Kits de Sabonete / Hidratante": "🧴",
  "Potes / Utensílios Domésticos": "🫙",
  Outros: "📦",
};

export function categoryEmoji(category: string): string {
  return EMOJI[category] ?? "📦";
}

function loadImageFile(file: File): Promise<{ img: HTMLImageElement; url: string }> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Escolha uma foto."));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Foto inválida."));
    };
    img.src = url;
  });
}

function rasterizeImage(
  img: HTMLImageElement,
  maxEdge: number,
  fill: string,
  mime: "image/jpeg" | "image/png",
  quality?: number,
): string {
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Não deu para processar a foto.");
  }
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return mime === "image/png"
    ? canvas.toDataURL("image/png")
    : canvas.toDataURL("image/jpeg", quality ?? 0.72);
}

/** JPEG data URL, max edge 480px, for fast mobile loads. */
export async function compressProductImage(
  file: File,
  maxEdge = 480,
  quality = 0.72,
): Promise<string> {
  const { img, url } = await loadImageFile(file);
  try {
    return rasterizeImage(img, maxEdge, "#111", "image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** White-background JPEG for QR sticker logos. */
export async function compressLogoImage(file: File, maxEdge = 320): Promise<string> {
  const { img, url } = await loadImageFile(file);
  try {
    return rasterizeImage(img, maxEdge, "#ffffff", "image/jpeg", 0.88);
  } finally {
    URL.revokeObjectURL(url);
  }
}
