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
  Outros: "📦",
};

export function categoryEmoji(category: string): string {
  return EMOJI[category] ?? "📦";
}

/** JPEG data URL, max edge 480px, for fast mobile loads. */
export function compressProductImage(file: File, maxEdge = 480, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Escolha uma foto."));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Não deu para processar a foto."));
        return;
      }
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Foto inválida."));
    };
    img.src = url;
  });
}
