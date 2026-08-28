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
      { name: "Bolo no pote", priceCents: 1200, category: "Bolo no Pote", stock: 8 },
      { name: "Brigadeiro", priceCents: 400, category: "Doces", stock: 24 },
      { name: "Refrigerante lata", priceCents: 600, category: "Bebidas", stock: 20 },
    ],
  },
  {
    id: "celular",
    label: "Acessórios para Celular",
    categories: ["Capinhas", "Películas", "Cabos", "Fones"],
    templates: [
      { name: "Capinha silicone", priceCents: 2500, category: "Capinhas", stock: 15 },
      { name: "Película de vidro", priceCents: 1500, category: "Películas", stock: 20 },
      { name: "Cabo USB-C", priceCents: 1800, category: "Cabos", stock: 12 },
      { name: "Fone bluetooth", priceCents: 4500, category: "Fones", stock: 8 },
    ],
  },
  {
    id: "vestuario",
    label: "Vestuário e Acessórios",
    categories: ["Meias", "Bonés", "Óculos de Sol", "Bijuterias"],
    templates: [
      { name: "Meia soquete", priceCents: 800, category: "Meias", stock: 24 },
      { name: "Boné liso", priceCents: 3500, category: "Bonés", stock: 10 },
      { name: "Óculos de sol", priceCents: 2500, category: "Óculos de Sol", stock: 12 },
      { name: "Brinco", priceCents: 1200, category: "Bijuterias", stock: 16 },
    ],
  },
  {
    id: "lar",
    label: "Utilidades e Lar",
    categories: ["Panos de Prato", "Tapetes", "Utensílios"],
    templates: [
      { name: "Pano de prato", priceCents: 1000, category: "Panos de Prato", stock: 20 },
      { name: "Tapete pequeno", priceCents: 2500, category: "Tapetes", stock: 8 },
      { name: "Escorredor", priceCents: 1800, category: "Utensílios", stock: 6 },
      { name: "Pote plástico", priceCents: 1200, category: "Utensílios", stock: 15 },
    ],
  },
  {
    id: "cosmeticos",
    label: "Cosméticos e Perfumaria",
    categories: ["Sabonetes", "Perfumes", "Maquiagem"],
    templates: [
      { name: "Sabonete artesanal", priceCents: 1200, category: "Sabonetes", stock: 18 },
      { name: "Perfume 15ml", priceCents: 2500, category: "Perfumes", stock: 10 },
      { name: "Batom", priceCents: 1500, category: "Maquiagem", stock: 14 },
      { name: "Creme de mão", priceCents: 1800, category: "Sabonetes", stock: 12 },
    ],
  },
  {
    id: "outros",
    label: "Outros / Geral",
    categories: ["Outros"],
    templates: [
      { name: "Produto avulso", priceCents: 1000, category: "Outros", stock: 10 },
      { name: "Kit promocional", priceCents: 2500, category: "Outros", stock: 8 },
      { name: "Brinde", priceCents: 500, category: "Outros", stock: 20 },
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
