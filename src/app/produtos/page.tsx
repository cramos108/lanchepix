"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Camera, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { ProductSticker } from "@/components/ProductSticker";
import { ProductThumb } from "@/components/ProductThumb";
import { Button, EmptyState, Field, Modal, inputClass } from "@/components/ui";
import { NICHES, defaultNiche, nicheOfCategory, type CatalogTemplate } from "@/lib/catalog";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { centsToInput, formatBRL, parseBRLToCents } from "@/lib/money";
import { buildPixPayload } from "@/lib/pix";
import { removeProduct, saveProduct } from "@/lib/repo";
import { seedNiche } from "@/lib/seed";
import { scheduleSync } from "@/lib/sync";
import { compressProductImage } from "@/lib/productImage";
import { toast } from "@/lib/toast";
import type { Product } from "@/lib/types";

const emptyForm = {
  name: "",
  price: "",
  category: defaultNiche().categories[0],
  stock: "10",
  priceMode: "fixed" as "fixed" | "suggested",
  imageData: "" as string,
};

export default function ProdutosPage() {
  const products = useLiveQuery(
    () =>
      db.products
        .filter((p) => !p.deleted)
        .toArray()
        .then((rows) =>
          rows.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
        ),
    [],
  );
  const settings = useLiveQuery(() => db.settings.get("app"), []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [nicheId, setNicheId] = useState(defaultNiche().id);
  const [form, setForm] = useState(emptyForm);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [sticker, setSticker] = useState<Product | null>(null);
  const [filter, setFilter] = useState("Todos");

  const niche = NICHES.find((n) => n.id === nicheId) ?? defaultNiche();
  const chips = useMemo(() => {
    const cats = [...new Set((products ?? []).map((p) => p.category))];
    return ["Todos", ...cats];
  }, [products]);
  const visible = (products ?? []).filter(
    (p) => filter === "Todos" || p.category === filter,
  );

  function stickerPayload(product: Product): string {
    if (!settings?.pixKey) return "";
    try {
      return buildPixPayload({
        pixKey: settings.pixKey,
        merchantName: settings.merchantName || settings.storeName,
        merchantCity: settings.merchantCity,
        amountCents:
          product.priceMode === "suggested" ? undefined : product.priceCents,
        description: product.name,
      });
    } catch {
      return "";
    }
  }

  function openSticker(product: Product) {
    if (!settings?.pixKey) {
      toast("Cadastre a chave Pix em Configurações.", "err");
      return;
    }
    setSticker(product);
  }

  function selectNiche(id: string) {
    const next = NICHES.find((n) => n.id === id) ?? defaultNiche();
    setNicheId(next.id);
    setForm((f) => ({
      ...f,
      category: next.categories.includes(f.category) ? f.category : next.categories[0],
    }));
  }

  function startCreate() {
    setEditing(null);
    setNicheId(defaultNiche().id);
    setForm(emptyForm);
    setOpen(true);
  }

  function startEdit(p: Product) {
    setEditing(p);
    const found = nicheOfCategory(p.category);
    setNicheId(found?.id ?? "outros");
    setForm({
      name: p.name,
      price: centsToInput(p.priceCents),
      category: p.category,
      stock: String(p.stock),
      priceMode: p.priceMode === "suggested" ? "suggested" : "fixed",
      imageData: p.imageData ?? "",
    });
    setOpen(true);
  }

  function applyTemplate(t: CatalogTemplate) {
    setForm({
      name: t.name,
      price: centsToInput(t.priceCents),
      category: t.category,
      stock: String(t.stock),
      priceMode: "fixed",
      imageData: form.imageData,
    });
  }

  async function addTemplateNow(t: CatalogTemplate) {
    await saveProduct({
      id: newId(),
      name: t.name,
      priceCents: t.priceCents,
      priceMode: "fixed",
      category: t.category,
      stock: t.stock,
      active: true,
    });
    toast(`${t.name} no catálogo`);
  }

  async function submit() {
    const name = form.name.trim();
    const priceCents = parseBRLToCents(form.price);
    const stock = Number.parseInt(form.stock, 10);
    if (!name) {
      toast("Informe o nome do produto.", "err");
      return;
    }
    if (priceCents <= 0) {
      toast("Informe um preço válido.", "err");
      return;
    }
    await saveProduct({
      id: editing?.id ?? newId(),
      name,
      priceCents,
      priceMode: form.priceMode,
      imageData: form.imageData,
      category: form.category,
      stock: Number.isFinite(stock) ? stock : 0,
      active: editing?.active ?? true,
    });
    toast(editing ? "Produto atualizado" : "Produto cadastrado");
    setOpen(false);
  }

  async function onPickPhoto(file: File | undefined) {
    if (!file) return;
    try {
      const data = await compressProductImage(file);
      setForm((f) => ({ ...f, imageData: data }));
      toast("Foto pronta");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Não deu para usar a foto.", "err");
    }
  }

  async function seedThisNiche() {
    const n = await seedNiche(nicheId);
    scheduleSync();
    toast(`${n} itens de exemplo em ${niche.label}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button className="flex-1" onClick={startCreate}>
          <Plus className="h-5 w-5" />
          Novo produto
        </Button>
      </div>

      {products && products.length > 0 ? (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {chips.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setFilter(c)}
              className={`min-h-11 shrink-0 rounded-full border-2 px-4 text-sm font-extrabold ${
                filter === c
                  ? "border-sun bg-sun text-sunink"
                  : "border-line bg-surface text-white"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      ) : null}

      {products && products.length === 0 ? (
        <EmptyState
          title="Catálogo vazio"
          text="Escolha o nicho e cadastre lanches, capinhas, meias, sabonetes…"
          action={
            <Button onClick={startCreate}>Começar pelo nicho</Button>
          }
        />
      ) : null}

      <ul className="grid grid-cols-2 gap-3">
        {visible.map((p) => (
          <li key={p.id} className="flex flex-col rounded-3xl border-2 border-line bg-surface p-3">
            <ProductThumb
              imageData={p.imageData}
              category={p.category}
              name={p.name}
              size="lg"
            />
            <div className="mt-2 min-w-0">
              <p className="text-base font-black leading-tight">{p.name}</p>
              <p className="text-xs font-bold text-muted">{p.category}</p>
              <p className="mt-1 text-lg font-black text-sun">{formatBRL(p.priceCents)}</p>
              {p.priceMode === "suggested" ? (
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-amber">
                  Sugerida
                </p>
              ) : null}
            </div>
            <p
              className={`mt-1 text-sm font-extrabold ${
                p.stock <= 0 ? "text-alert" : p.stock <= 3 ? "text-amber" : "text-muted"
              }`}
            >
              Estoque: {p.stock} un.
            </p>
            <div className="mt-auto flex flex-col gap-2 pt-2">
              <Button
                variant="line"
                className="min-h-11 w-full text-xs"
                onClick={() => startEdit(p)}
              >
                <Pencil className="h-4 w-4" />
                Editar
              </Button>
              <Button
                variant="sun"
                className="min-h-11 w-full px-2 text-xs leading-tight"
                onClick={() => openSticker(p)}
              >
                <Printer className="h-4 w-4" />
                Imprimir QR
              </Button>
              <Button
                variant="alert"
                className="min-h-11 w-full text-xs"
                onClick={() => setConfirmId(p.id)}
              >
                <Trash2 className="h-4 w-4" />
                Excluir
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Modal
        open={open}
        title={editing ? "Editar produto" : "Novo produto"}
        onClose={() => setOpen(false)}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Field label="Selecionar categoria / nicho">
            <div className="flex flex-col gap-2">
              {NICHES.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => selectNiche(n.id)}
                  className={`min-h-12 rounded-2xl border-2 px-3 text-left text-sm font-extrabold ${
                    nicheId === n.id
                      ? "border-sun bg-sun text-sunink"
                      : "border-line bg-surface text-white"
                  }`}
                >
                  {n.label}
                </button>
              ))}
            </div>
          </Field>

          {!editing ? (
            <div>
              <p className="mb-2 text-xs font-extrabold uppercase tracking-widest text-sun">
                Adicionar rápido
              </p>
              <div className="grid grid-cols-2 gap-2">
                {niche.templates.map((t) => (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    onDoubleClick={() => void addTemplateNow(t)}
                    className="rounded-2xl border-2 border-line bg-surface2 px-3 py-3 text-left"
                  >
                    <span className="block text-sm font-black leading-tight">{t.name}</span>
                    <span className="text-xs font-bold text-sun">
                      {formatBRL(t.priceCents)}
                    </span>
                  </button>
                ))}
              </div>
              <Button
                type="button"
                variant="line"
                className="mt-2 min-h-12 w-full text-sm"
                onClick={() => void seedThisNiche()}
              >
                Incluir os {niche.templates.length} exemplos
              </Button>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-sun">
              Foto do produto
            </span>
            <div className="flex items-center gap-3">
              <ProductThumb
                imageData={form.imageData || undefined}
                category={form.category}
                name={form.name || "Produto"}
                size="md"
              />
              <div className="flex flex-1 flex-col gap-2">
                <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-sun bg-sun/10 px-3 text-xs font-extrabold uppercase text-sun">
                  <Camera className="h-4 w-4" />
                  Câmera
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      void onPickPhoto(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-line bg-surface px-3 text-xs font-extrabold uppercase">
                  Galeria
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      void onPickPhoto(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
            {form.imageData ? (
              <button
                type="button"
                className="text-left text-sm font-bold text-alert underline"
                onClick={() => setForm((f) => ({ ...f, imageData: "" }))}
              >
                Remover foto
              </button>
            ) : (
              <span className="text-sm text-muted">Compactamos a foto para a rede móvel.</span>
            )}
          </div>
          <Field label="Nome">
            <input
              className={inputClass}
              placeholder="Nome do produto"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, priceMode: "fixed" }))}
              className={`min-h-14 rounded-2xl border-2 px-3 text-sm font-extrabold ${
                form.priceMode === "fixed"
                  ? "border-sun bg-sun text-sunink"
                  : "border-line bg-surface text-white"
              }`}
            >
              Preço fixado
            </button>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, priceMode: "suggested" }))}
              className={`min-h-14 rounded-2xl border-2 px-3 text-sm font-extrabold ${
                form.priceMode === "suggested"
                  ? "border-sun bg-sun text-sunink"
                  : "border-line bg-surface text-white"
              }`}
            >
              Contribuição sugerida
            </button>
          </div>
          <Field
            label={form.priceMode === "suggested" ? "Contribuição sugerida (R$)" : "Preço (R$)"}
            hint="Use vírgula: 8,50"
          >
            <input
              className={inputClass}
              inputMode="decimal"
              placeholder="8,50"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            />
          </Field>
          <Field label="Subcategoria">
            <select
              className={inputClass}
              value={
                niche.categories.includes(form.category)
                  ? form.category
                  : niche.categories[0]
              }
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            >
              {niche.categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Estoque (unidades)">
            <input
              className={inputClass}
              inputMode="numeric"
              value={form.stock}
              onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
            />
          </Field>
          <Button type="submit">Salvar</Button>
        </form>
      </Modal>

      <Modal
        open={Boolean(sticker)}
        title="Adesivo QR Code"
        onClose={() => setSticker(null)}
      >
        {sticker ? (
          <div className="flex flex-col gap-4">
            {stickerPayload(sticker) ? (
              <ProductSticker
                name={sticker.name}
                priceCents={sticker.priceCents}
                payload={stickerPayload(sticker)}
                storeName={settings?.storeName}
                suggested={sticker.priceMode === "suggested"}
                imageData={sticker.imageData}
                category={sticker.category}
              />
            ) : (
              <p className="text-alert">
                Não foi possível gerar o QR.{" "}
                <Link href="/configuracoes" className="underline">
                  Revise a chave Pix
                </Link>
                .
              </p>
            )}
            <Button
              onClick={() => window.print()}
              disabled={!stickerPayload(sticker)}
            >
              <Printer className="h-5 w-5" />
              Imprimir / Salvar PDF
            </Button>
            <p className="text-center text-xs font-bold text-muted">
              Na impressão, escolha Salvar como PDF se quiser o arquivo.
            </p>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(confirmId)}
        title="Excluir produto?"
        onClose={() => setConfirmId(null)}
      >
        <p className="mb-4 text-muted">Ele some do catálogo, mas o histórico de vendas fica.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={() => setConfirmId(null)}>
            Cancelar
          </Button>
          <Button
            variant="alert"
            onClick={async () => {
              if (confirmId) await removeProduct(confirmId);
              setConfirmId(null);
              toast("Produto removido");
            }}
          >
            Excluir
          </Button>
        </div>
      </Modal>
    </div>
  );
}
