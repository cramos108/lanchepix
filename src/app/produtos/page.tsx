"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button, EmptyState, Field, Modal, inputClass } from "@/components/ui";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { centsToInput, formatBRL, parseBRLToCents } from "@/lib/money";
import { removeProduct, saveProduct } from "@/lib/repo";
import { seedDemoProducts } from "@/lib/seed";
import { scheduleSync } from "@/lib/sync";
import { toast } from "@/lib/toast";
import { CATEGORIES, type Category, type Product } from "@/lib/types";

const emptyForm = {
  name: "",
  price: "",
  category: "Salgados" as Category | string,
  stock: "0",
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
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  function startCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function startEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      price: centsToInput(p.priceCents),
      category: p.category,
      stock: String(p.stock),
    });
    setOpen(true);
  }

  async function submit() {
    const name = form.name.trim();
    const priceCents = parseBRLToCents(form.price);
    const stock = Number.parseInt(form.stock, 10);
    if (!name) {
      toast("Informe o nome do lanche.", "err");
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
      category: form.category,
      stock: Number.isFinite(stock) ? stock : 0,
      active: editing?.active ?? true,
    });
    toast(editing ? "Produto atualizado" : "Produto cadastrado");
    setOpen(false);
  }

  async function seed() {
    const n = await seedDemoProducts();
    scheduleSync();
    toast(`${n} lanches de exemplo adicionados`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button className="flex-1" onClick={startCreate}>
          <Plus className="h-5 w-5" />
          Novo lanche
        </Button>
      </div>

      {products && products.length === 0 ? (
        <EmptyState
          title="Cardápio vazio"
          text="Cadastre coxinha, pastel, refri… ou carregue um exemplo."
          action={<Button onClick={() => void seed()}>Cardápio de exemplo</Button>}
        />
      ) : null}

      <ul className="flex flex-col gap-3">
        {products?.map((p) => (
          <li key={p.id} className="rounded-3xl border-2 border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xl font-black leading-tight">{p.name}</p>
                <p className="text-sm font-bold text-muted">{p.category}</p>
              </div>
              <p className="text-xl font-black text-sun">{formatBRL(p.priceCents)}</p>
            </div>
            <p
              className={`mt-1 text-sm font-extrabold ${
                p.stock <= 0 ? "text-alert" : p.stock <= 3 ? "text-amber" : "text-muted"
              }`}
            >
              Estoque: {p.stock} un.
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                variant="line"
                className="flex-1 min-h-12"
                onClick={() => startEdit(p)}
              >
                <Pencil className="h-4 w-4" />
                Editar
              </Button>
              <Button
                variant="alert"
                className="min-h-12 px-3"
                onClick={() => setConfirmId(p.id)}
                aria-label="Excluir"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Modal
        open={open}
        title={editing ? "Editar lanche" : "Novo lanche"}
        onClose={() => setOpen(false)}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Field label="Nome">
            <input
              className={inputClass}
              placeholder="Coxinha"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </Field>
          <Field label="Preço (R$)" hint="Use vírgula: 8,50">
            <input
              className={inputClass}
              inputMode="decimal"
              placeholder="8,50"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            />
          </Field>
          <Field label="Categoria">
            <select
              className={inputClass}
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            >
              {CATEGORIES.map((c) => (
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
        open={Boolean(confirmId)}
        title="Excluir lanche?"
        onClose={() => setConfirmId(null)}
      >
        <p className="mb-4 text-muted">Ele some do cardápio, mas o histórico de vendas fica.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={() => setConfirmId(null)}>
            Cancelar
          </Button>
          <Button
            variant="alert"
            onClick={async () => {
              if (confirmId) await removeProduct(confirmId);
              setConfirmId(null);
              toast("Lanche removido");
            }}
          >
            Excluir
          </Button>
        </div>
      </Modal>
    </div>
  );
}
