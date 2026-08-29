"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Cloud, ShieldAlert, Trash2 } from "lucide-react";
import { Button, Field, Modal, inputClass } from "@/components/ui";
import { db, ensureSettings } from "@/lib/db";
import { nowIso } from "@/lib/id";
import {
  cycleDevPlan,
  effectivePlan,
  getDevPlanOverride,
  getDevSimulateLimit,
  isNegocio,
  openUpgradeModal,
  planLabel,
  simulateFreePlanLimit,
  subscribeDevPlan,
} from "@/lib/plan";
import { detectPixKeyType } from "@/lib/pix";
import { maskPhoneInput } from "@/lib/phone";
import { deleteAccountAndAllData, saveSettings } from "@/lib/repo";
import { seedDemoProducts } from "@/lib/seed";
import { getSyncState, pushAndPull, scheduleSync, subscribeSync } from "@/lib/sync";
import { toast } from "@/lib/toast";
import {
  BUSINESS_TYPES,
  normalizeBusinessType,
  type BusinessType,
  type Settings,
} from "@/lib/types";

export default function ConfiguracoesPage() {
  const settings = useLiveQuery(async () => {
    await ensureSettings();
    return db.settings.get("app");
  }, []);

  if (!settings) {
    return <p className="text-muted">Carregando configurações…</p>;
  }

  return <SettingsForm key={settings.vendorId} settings={settings} />;
}

function SettingsForm({ settings }: { settings: Settings }) {
  const [storeName, setStoreName] = useState(settings.storeName);
  const [pixKey, setPixKey] = useState(settings.pixKey);
  const [merchantName, setMerchantName] = useState(settings.merchantName);
  const [merchantCity, setMerchantCity] = useState(settings.merchantCity);
  const [whatsapp, setWhatsapp] = useState(settings.whatsapp);
  const [rewardLabel, setRewardLabel] = useState(settings.rewardLabel);
  const [attendantName, setAttendantName] = useState(settings.attendantName ?? "");
  const [businessType, setBusinessType] = useState<BusinessType>(
    normalizeBusinessType(settings.businessType),
  );
  const [syncLabel, setSyncLabel] = useState("Sincronizar agora");
  const [wipe, setWipe] = useState<null | "day" | "week" | "month" | "year" | "all">(
    null,
  );
  const [deleteAccount, setDeleteAccount] = useState(false);
  const activePlan = useSyncExternalStore(
    subscribeDevPlan,
    () => effectivePlan(settings),
    () => settings.plan,
  );
  const devQuery = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("popstate", onStoreChange);
      return () => window.removeEventListener("popstate", onStoreChange);
    },
    () => new URLSearchParams(window.location.search).get("dev") === "true",
    () => false,
  );
  const showDevTools = process.env.NODE_ENV === "development" || devQuery;

  useEffect(() => subscribeSync(() => {
    const s = getSyncState();
    if (s.running) setSyncLabel("Sincronizando…");
    else if (s.lastError) setSyncLabel("Falhou — tocar de novo");
    else setSyncLabel("Sincronizar agora");
  }), []);

  async function save() {
    await saveSettings({
      storeName: storeName.trim() || "Meu negócio",
      pixKey: pixKey.trim(),
      merchantName: merchantName.trim().slice(0, 25),
      merchantCity: merchantCity.trim().slice(0, 15),
      whatsapp: whatsapp.trim(),
      rewardLabel: rewardLabel.trim() || "1 brinde grátis",
      businessType,
      attendantName: attendantName.trim(),
    });
    toast("Configurações salvas");
  }

  const sync = getSyncState();

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-3xl border-2 border-sun bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-widest text-sun">
              Plano
            </p>
            <p className="mt-1 text-xl font-black leading-tight">
              Plano Atual: {planLabel(activePlan)}
            </p>
          </div>
          <button
            type="button"
            onClick={openUpgradeModal}
            className="shrink-0 pt-1 text-sm font-extrabold text-sun underline decoration-sun/60 underline-offset-4"
          >
            Mudar Plano
          </button>
        </div>
        <p className="mt-2 text-sm font-bold text-muted">
          {activePlan === "equipe"
            ? "Tudo do Pro + multi-dispositivo e relatório por ajudante."
            : activePlan === "pro"
              ? "Cartões ilimitados, cobrança em lote e relatórios MEI."
              : "Pix Confiança ilimitado e até 100 cartões fidelidade. Catálogo e QR Pix continuam grátis."}
        </p>
      </section>

      <Field label="Tipo de negócio">
        <div className="flex flex-col gap-2">
          {BUSINESS_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setBusinessType(t.id)}
              className={`min-h-12 rounded-2xl border-2 px-3 text-left text-sm font-extrabold ${
                businessType === t.id
                  ? "border-sun bg-sun text-sunink"
                  : "border-line bg-surface text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Nome do Negócio / Banca">
        <input
          className={inputClass}
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          placeholder="Banca da Maria"
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
          placeholder="MARIA BANCA"
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
      <Field
        label="WhatsApp de Contato"
        hint="Para cobranças e recados. Vale para lanches, capinhas, roupa, utilidades…"
      >
        <input
          className={inputClass}
          inputMode="tel"
          value={whatsapp}
          onChange={(e) => setWhatsapp(maskPhoneInput(e.target.value))}
          placeholder="(11) 99999-9999"
        />
      </Field>
      {isNegocio(settings) || activePlan === "equipe" ? (
        <Field
          label="Nome do atendente / aparelho"
          hint="Usado no relatório Desempenho por Ajudante (plano Negócio). Cada celular pode ter um nome."
        >
          <input
            className={inputClass}
            value={attendantName}
            onChange={(e) => setAttendantName(e.target.value)}
            placeholder="Ex.: Maria, Banca 2"
          />
        </Field>
      ) : null}
      <Field label="Prêmio do cartão fidelidade">
        <input
          className={inputClass}
          value={rewardLabel}
          onChange={(e) => setRewardLabel(e.target.value)}
          placeholder="1 brinde grátis"
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
          const n = await seedDemoProducts(businessType);
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

      {showDevTools ? (
        <>
          <div className="h-px bg-line" />
          <h2 className="text-lg font-black">Dados e Testes</h2>
          <p className="text-xs font-bold text-muted">
            Ferramentas locais (localStorage). Não criam 100 vendas de verdade.
            Só aparece em desenvolvimento ou com ?dev=true.
          </p>
          <Button
            variant="line"
            className="min-h-12 text-sm"
            onClick={() => {
              simulateFreePlanLimit();
              toast("Paywall do plano grátis (simulado)", "info");
            }}
          >
            Simular Limite do Plano Grátis (100 Vendas)
          </Button>
          <Button
            variant="line"
            className="min-h-12 text-sm"
            onClick={() => {
              const next = cycleDevPlan(settings.plan);
              toast(`Modo Dev: ${planLabel(next)}`, "info");
            }}
          >
            Alternar Modo Dev: Simulador de Planos (Grátis / Pro / Negócio)
          </Button>
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted">
            Simulador: {planLabel(activePlan)}
            {getDevPlanOverride() ? " · override local" : ""}
            {getDevSimulateLimit() ? " · limite grátis ligado" : ""}
          </p>
        </>
      ) : null}

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
        Zerar saldo do mês
      </Button>
      <Button variant="line" onClick={() => setWipe("year")}>
        Zerar saldo do ano
      </Button>
      <Button variant="alert" onClick={() => setWipe("all")}>
        Limpar Dados de Teste (Zerar Saldo)
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

      <div className="h-px bg-line" />
      <h2 className="text-lg font-black">Privacidade e Dados (LGPD)</h2>
      <p className="text-sm font-bold text-muted">
        Guardamos apenas o necessário para o app funcionar. Você pode excluir
        perfil, Chave Pix, catálogo e histórico quando quiser.
      </p>
      <Button variant="alert" onClick={() => setDeleteAccount(true)}>
        <ShieldAlert className="h-5 w-5" />
        Excluir Minha Conta e Todos os Dados
      </Button>

      <Modal
        open={Boolean(wipe)}
        title="Confirmar"
        onClose={() => setWipe(null)}
      >
        <p className="mb-4 font-bold text-muted">
          {wipe === "day"
            ? "Tem certeza que deseja zerar apenas as vendas de HOJE? Semana, mês e ano serão mantidos."
            : wipe === "week"
              ? "Tem certeza que deseja zerar apenas as vendas da SEMANA? Hoje, mês e ano serão mantidos."
              : wipe === "month"
                ? "Tem certeza que deseja zerar apenas as vendas do MÊS? As vendas do ano serão mantidas."
                : wipe === "year"
                  ? "Tem certeza que deseja zerar apenas as vendas do ANO? Hoje, semana e mês serão mantidos."
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
              if (wipe === "week") await saveSettings({ resetWeekAt: now });
              if (wipe === "month") await saveSettings({ resetMonthAt: now });
              if (wipe === "year") await saveSettings({ resetYearAt: now });
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

      <Modal
        open={deleteAccount}
        title="Excluir conta"
        onClose={() => setDeleteAccount(false)}
      >
        <p className="mb-4 font-bold text-muted">
          Esta ação apagará permanentemente seu perfil, Chave Pix, catálogo e
          histórico de vendas em conformidade com a LGPD. Deseja continuar?
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={() => setDeleteAccount(false)}>
            Cancelar
          </Button>
          <Button
            variant="alert"
            onClick={async () => {
              await deleteAccountAndAllData();
              setDeleteAccount(false);
              toast("Conta e dados excluídos", "info");
            }}
          >
            Excluir tudo
          </Button>
        </div>
      </Modal>
    </div>
  );
}
