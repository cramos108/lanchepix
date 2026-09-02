"use client";

import { useState } from "react";
import { Button, Field, Modal, inputClass } from "@/components/ui";
import { redeemPairingCode } from "@/lib/pairing";
import { toast } from "@/lib/toast";

export function PairingJoinModal({
  open,
  initialCode,
  onClose,
}: {
  open: boolean;
  initialCode?: string;
  onClose: () => void;
}) {
  const [code, setCode] = useState(
    (initialCode ?? "").replace(/\D/g, "").slice(0, 6),
  );
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const linked = await redeemPairingCode(code, name);
      toast(
        linked.deviceRole === "gerente"
          ? "Conectado como Gerente. Você vê o time inteiro."
          : "Conectado como ajudante. Vendas vão para a conta principal.",
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não deu para conectar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title="Sou Ajudante / Conectar a uma Banca" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-sm font-bold text-muted">
          Digite o código de 6 dígitos do dono e o seu nome neste aparelho.
        </p>
        <Field label="Código de 6 dígitos">
          <input
            className={`${inputClass} tracking-[0.4em]`}
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
          />
        </Field>
        <Field label="Seu nome neste aparelho">
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="João ou Banca 2"
          />
        </Field>
        {error ? (
          <p className="text-sm font-extrabold text-alert">{error}</p>
        ) : null}
        <Button disabled={busy} onClick={() => void submit()}>
          {busy ? "Conectando…" : "Conectar"}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </Modal>
  );
}
