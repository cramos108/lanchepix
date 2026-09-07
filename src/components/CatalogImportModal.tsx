"use client";

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { Price } from "@/components/Money";
import {
  downloadSampleCatalogCsv,
  importCatalogProducts,
  parseCatalogFile,
  type CatalogImportRow,
} from "@/lib/catalogImport";
import { toast } from "@/lib/toast";

export function CatalogImportModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<CatalogImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setRows([]);
    setFileName("");
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function close() {
    if (busy) return;
    reset();
    onClose();
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const parsed = await parseCatalogFile(file);
      setFileName(file.name);
      setRows(parsed);
      if (!parsed.length) {
        setError("Nenhuma linha de produto encontrada.");
      }
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : "Não deu para ler o arquivo.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    const valid = rows.filter((r) => r.name.trim() && r.priceCents > 0);
    if (!valid.length) {
      setError("Informe nome e preço válido em cada linha.");
      return;
    }
    setBusy(true);
    try {
      const result = await importCatalogProducts(rows);
      toast(
        result.added
          ? `${result.added} produto${result.added === 1 ? "" : "s"} importado${result.added === 1 ? "" : "s"}`
          : "Nenhum produto válido para importar.",
      );
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não deu para importar.");
    } finally {
      setBusy(false);
    }
  }

  const ready = rows.filter((r) => r.name.trim() && r.priceCents > 0).length;

  return (
    <Modal open={open} title="Importar catálogo" onClose={close}>
      <div className="flex flex-col gap-3">
        <p className="text-sm font-bold text-muted">
          Envie um CSV ou Excel com as colunas Nome do Produto, Preço (R$) e
          Categoria. Itens atuais não são apagados — a planilha só acrescenta.
        </p>
        <Button
          variant="line"
          className="w-full"
          onClick={() => downloadSampleCatalogCsv()}
        >
          <Download className="h-5 w-5" />
          Baixar Planilha Exemplo
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button
          className="w-full"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-5 w-5" />
          {busy ? "Lendo…" : "Escolher CSV ou XLSX"}
        </Button>
        {fileName ? (
          <p className="text-xs font-bold text-muted">{fileName}</p>
        ) : null}
        {error ? (
          <p className="text-sm font-bold text-alert">{error}</p>
        ) : null}
        {rows.length ? (
          <div className="max-h-56 overflow-y-auto rounded-2xl border-2 border-line bg-ink p-3">
            <p className="text-xs font-extrabold uppercase tracking-widest text-sun">
              Prévia · {ready} válido{ready === 1 ? "" : "s"}
            </p>
            <ul className="mt-2 flex flex-col gap-2">
              {rows.slice(0, 12).map((row, i) => (
                <li key={`${row.name}-${i}`} className="text-sm font-bold">
                  <span className={row.name && row.priceCents > 0 ? "" : "text-alert"}>
                    {row.name || "(sem nome)"}
                  </span>
                  <span className="block text-xs text-muted">
                    {row.category.trim() || "Geral"} ·{" "}
                    {row.priceCents > 0 ? <Price cents={row.priceCents} /> : row.priceLabel || "preço inválido"}
                  </span>
                </li>
              ))}
            </ul>
            {rows.length > 12 ? (
              <p className="mt-2 text-xs font-bold text-muted">
                +{rows.length - 12} linha{rows.length - 12 === 1 ? "" : "s"}
              </p>
            ) : null}
          </div>
        ) : null}
        <Button disabled={busy || ready === 0} onClick={() => void confirmImport()}>
          {busy ? "Importando…" : `Importar ${ready} produto${ready === 1 ? "" : "s"}`}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={close}>
          Cancelar
        </Button>
      </div>
    </Modal>
  );
}
