export type CatalogTemplate = {
  name: string;
  priceCents: number;
  category: string;
  stock: number;
};

export type Niche = {
  id: string;
  label: string;
  categories: string[];
  templates: CatalogTemplate[];
};

export const NICHES: Niche[] = [
  {
    id: "alimentacao",
    label: "Alimentação / Lanches",
    categories: ["Salgados", "Bolo no Pote", "Doces", "Bebidas"],
    templates: [
      { name: "Coxinha", priceCents: 800, category: "Salgados", stock: 20 },
      { name: "Bolo no Pote", priceCents: 1200, category: "Bolo no Pote", stock: 8 },
      { name: "Guaraná", priceCents: 600, category: "Bebidas", stock: 20 },
      { name: "Pastel", priceCents: 1000, category: "Salgados", stock: 15 },
    ],
  },
  {
    id: "celular",
    label: "Acessórios para Celular",
    categories: ["Capinhas", "Películas", "Cabos", "Fones"],
    templates: [
      { name: "Capinha Transparente", priceCents: 2500, category: "Capinhas", stock: 15 },
      { name: "Película 3D", priceCents: 2000, category: "Películas", stock: 20 },
      { name: "Cabo USB-C", priceCents: 1800, category: "Cabos", stock: 12 },
      { name: "Fone de Ouvido", priceCents: 3500, category: "Fones", stock: 8 },
    ],
  },
  {
    id: "vestuario",
    label: "Vestuário e Acessórios",
    categories: ["Meias", "Bonés", "Óculos de Sol", "Bijuterias"],
    templates: [
      { name: "Kit Meias (3 pares)", priceCents: 1500, category: "Meias", stock: 18 },
      { name: "Boné", priceCents: 3500, category: "Bonés", stock: 10 },
      { name: "Óculos de Sol", priceCents: 2500, category: "Óculos de Sol", stock: 12 },
      { name: "Bijuterias", priceCents: 1200, category: "Bijuterias", stock: 16 },
    ],
  },
  {
    id: "lar",
    label: "Utilidades e Lar",
    categories: ["Panos de Prato", "Tapetes", "Utensílios"],
    templates: [
      { name: "Panos de Prato (Kit c/ 3)", priceCents: 1500, category: "Panos de Prato", stock: 16 },
      { name: "Tapete de Entrada", priceCents: 3000, category: "Tapetes", stock: 8 },
      { name: "Utensílio de Cozinha", priceCents: 1800, category: "Utensílios", stock: 10 },
    ],
  },
  {
    id: "cosmeticos",
    label: "Consultora / Revendedora",
    categories: [
      "Batons / Maquiagem",
      "Perfumes / Colônias",
      "Kits de Sabonete / Hidratante",
      "Potes / Utensílios Domésticos",
      "Sabonetes",
      "Perfumes",
      "Maquiagem",
    ],
    templates: [
      { name: "Batom Matte", priceCents: 2500, category: "Batons / Maquiagem", stock: 12 },
      { name: "Colônia / Perfume", priceCents: 4500, category: "Perfumes / Colônias", stock: 8 },
      { name: "Kit Sabonetes", priceCents: 3500, category: "Kits de Sabonete / Hidratante", stock: 10 },
      { name: "Pote Multiuso", priceCents: 2800, category: "Potes / Utensílios Domésticos", stock: 10 },
    ],
  },
  {
    id: "outros",
    label: "Outros / Geral",
    categories: ["Outros"],
    templates: [
      { name: "Produto Exemplo A", priceCents: 1000, category: "Outros", stock: 10 },
      { name: "Produto Exemplo B", priceCents: 2500, category: "Outros", stock: 8 },
    ],
  },
];

export const CATEGORIES = Array.from(
  new Set(NICHES.flatMap((n) => n.categories)),
);

export function nicheOfCategory(category: string): Niche | undefined {
  return NICHES.find((n) => n.categories.includes(category));
}

export function defaultNiche(): Niche {
  return NICHES[0];
}
