"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Cloud, Sparkles, Trash2 } from "lucide-react";
import { Button, Field, Modal, inputClass } from "@/components/ui";
import { db, ensureSettings } from "@/lib/db";
import { nowIso } from "@/lib/id";
import { PRO_PRICE_LABEL, isPro, openUpgradeModal } from "@/lib/plan";
import { detectPixKeyType } from "@/lib/pix";
import { maskPhoneInput } from "@/lib/phone";
import { saveSettings } from "@/lib/repo";
import { seedDemoProducts } from "@/lib/seed";
import { getSyncState, pushAndPull, scheduleSync, subscribeSync } from "@/lib/sync";
import { toast } from "@/lib/toast";
import type { Settings } from "@/lib/types";

export default function ConfiguracoesPage() {
  const settings = useLiveQuery(async () => {
    await ensureSettings();
    return db.settings.get("app");
  }, []);

  if (!settings) {
    return <p className="text-muted">Carregando configurações…</p>;
  }

  return <SettingsForm settings={settings} />;
}

function SettingsForm({ settings }: { settings: Settings }) {
  const [storeName, setStoreName] = useState(settings.storeName);
  const [pixKey, setPixKey] = useState(settings.pixKey);
  const [merchantName, setMerchantName] = useState(settings.merchantName);
  const [merchantCity, setMerchantCity] = useState(settings.merchantCity);
  const [whatsapp, setWhatsapp] = useState(settings.whatsapp);
  const [rewardLabel, setRewardLabel] = useState(settings.rewardLabel);
  const [syncLabel, setSyncLabel] = useState("Sincronizar agora");
  const [wipe, setWipe] = useState<null | "day" | "week" | "month" | "all">(null);

  useEffect(() => subscribeSync(() => {
    const s = getSyncState();
    if (s.running) setSyncLabel("Sincronizando…");
    else if (s.lastError) setSyncLabel("Falhou — tocar de novo");
    else setSyncLabel("Sincronizar agora");
  }), []);

  async function save() {
    await saveSettings({
      storeName: storeName.trim() || "Meu Lanche",
      pixKey: pixKey.trim(),
      merchantName: merchantName.trim().slice(0, 25),
      merchantCity: merchantCity.trim().slice(0, 15),
      whatsapp: whatsapp.trim(),
      rewardLabel: rewardLabel.trim() || "1 lanche grátis",
    });
    toast("Configurações salvas");
  }

  const sync = getSyncState();

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-3xl border-2 border-sun bg-surface p-4">
        <p className="text-xs font-extrabold uppercase tracking-widest text-sun">
          Plano atual
        </p>
        <p className="mt-1 text-2xl font-black">
          {isPro(settings) ? "Pro" : "Gratuito"}
        </p>
        {isPro(settings) ? (
          <p className="mt-1 text-sm font-bold text-muted">
            Clientes ilimitados e relatórios MEI liberados.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm font-bold text-muted">
              Até 25 cartões fidelidade e 50 Pix Confiança. Catálogo e QR Pix
              continuam grátis.
            </p>
            <Button className="mt-3 w-full" onClick={openUpgradeModal}>
              <Sparkles className="h-5 w-5" />
              Atualizar para Pro — {PRO_PRICE_LABEL}
            </Button>
          </>
        )}
      </section>

      <Field label="Nome da lanchonete">
        <input
          className={inputClass}
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          placeholder="Barraca da Maria"
        />
      </Field>
      <Field
        label="Chave Pix"
        hint={
          pixKey
            ? detectPixKeyType(pixKey)
            : "CPF, CNPJ, e-mail, celular (+55…) ou chave aleatória"
        }
      >
        <input
          className={inputClass}
          value={pixKey}
          onChange={(e) => setPixKey(e.target.value)}
          placeholder="seu-email@banco.com"
        />
      </Field>
      <Field label="Nome no QR (máx. 25, sem acento)">
        <input
          className={inputClass}
          maxLength={25}
          value={merchantName}
          onChange={(e) => setMerchantName(e.target.value)}
          placeholder="MARIA LANCHES"
        />
      </Field>
      <Field label="Cidade no QR (máx. 15)">
        <input
          className={inputClass}
          maxLength={15}
          value={merchantCity}
          onChange={(e) => setMerchantCity(e.target.value)}
          placeholder="SAO PAULO"
        />
      </Field>
      <Field label="WhatsApp da lanchonete" hint="Usado se quiser receber cópia das cobranças.">
        <input
          className={inputClass}
          inputMode="tel"
          value={whatsapp}
          onChange={(e) => setWhatsapp(maskPhoneInput(e.target.value))}
          placeholder="(11) 99999-9999"
        />
      </Field>
      <Field label="Prêmio do cartão fidelidade">
        <input
          className={inputClass}
          value={rewardLabel}
          onChange={(e) => setRewardLabel(e.target.value)}
          placeholder="1 lanche grátis"
        />
      </Field>

      <Button onClick={() => void save()}>Salvar</Button>

      <div className="h-px bg-line" />

      <Button
        variant="line"
        onClick={async () => {
          setSyncLabel("Sincronizando…");
          await pushAndPull();
          const s = getSyncState();
          toast(s.lastError ? s.lastError : "Sincronizado com o Supabase", s.lastError ? "err" : "ok");
        }}
      >
        <Cloud className="h-5 w-5" />
        {syncLabel}
      </Button>
      {sync.lastError ? (
        <p className="text-sm font-bold text-alert">{sync.lastError}</p>
      ) : null}

      <Button
        variant="line"
        onClick={async () => {
          const n = await seedDemoProducts();
          scheduleSync();
          toast(`${n} produtos de exemplo adicionados`);
        }}
      >
        Carregar catálogo de exemplo
      </Button>

      <p className="break-all text-xs text-muted">
        ID deste aparelho (vendor): {settings.vendorId}
      </p>
      <p className="text-sm text-muted">
        Os dados ficam neste celular (IndexedDB) e sobem para o Supabase quando houver
        internet. Instale o app na tela inicial para usar como PWA.
      </p>

      <div className="h-px bg-line" />
      <h2 className="text-lg font-black">Gerenciar dados e saldo</h2>
      <p className="text-sm font-bold text-muted">
        Zerar saldo esconde o lucro do período no painel. As vendas continuam no
        histórico até você excluir.
      </p>
      <Button variant="line" onClick={() => setWipe("day")}>
        Zerar saldo de hoje
      </Button>
      <Button variant="line" onClick={() => setWipe("week")}>
        Zerar saldo da semana
      </Button>
      <Button variant="line" onClick={() => setWipe("month")}>
        Zerar vendas do mês / ano
      </Button>
      <Button variant="alert" onClick={() => setWipe("all")}>
        Limpar dados de teste (zerar tudo)
      </Button>

      <Button
        variant="alert"
        onClick={async () => {
          const ok = window.confirm(
            "Apagar TODOS os dados deste celular? Produtos, Pix Confiança e cartões somem daqui.",
          );
          if (!ok) return;
          await db.products.clear();
          await db.sales.clear();
          await db.customers.clear();
          toast("Dados locais apagados", "info");
        }}
      >
        <Trash2 className="h-5 w-5" />
        Apagar dados locais
      </Button>

      <Modal
        open={Boolean(wipe)}
        title="Confirmar"
        onClose={() => setWipe(null)}
      >
        <p className="mb-4 font-bold text-muted">
          {wipe === "day"
            ? "O lucro de HOJE some do painel. As vendas pagas continuam no histórico."
            : wipe === "week"
              ? "O lucro desta SEMANA some do painel. As vendas pagas continuam no histórico."
              : wipe === "month"
                ? "O lucro do MÊS e do ANO some do painel. As vendas pagas continuam no histórico."
                : "Apaga TODAS as vendas (pagas e Pix Confiança) e zera o painel. Produtos e cartões ficam."}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={() => setWipe(null)}>
            Cancelar
          </Button>
          <Button
            variant="alert"
            onClick={async () => {
              const now = nowIso();
              if (wipe === "day") await saveSettings({ resetDayAt: now });
              if (wipe === "week") await saveSettings({ resetWeekAt: now, resetDayAt: now });
              if (wipe === "month") {
                await saveSettings({
                  resetMonthAt: now,
                  resetYearAt: now,
                  resetWeekAt: now,
                  resetDayAt: now,
                });
              }
              if (wipe === "all") {
                await db.sales.clear();
                await saveSettings({
                  resetDayAt: now,
                  resetWeekAt: now,
                  resetMonthAt: now,
                  resetYearAt: now,
                });
              }
              setWipe(null);
              toast("Saldo atualizado", "info");
            }}
          >
            Confirmar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
