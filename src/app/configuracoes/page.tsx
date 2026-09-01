"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { QRCodeSVG } from "qrcode.react";
import { Cloud, Copy, ShieldAlert, Trash2 } from "lucide-react";
import { Button, Field, Modal, inputClass } from "@/components/ui";
import { db, ensureSettings } from "@/lib/db";
import { nowIso } from "@/lib/id";
import {
  LINKED_OWNER_KEY,
  canEditBilling,
  canPairDevices,
  isAttendantDevice,
  isManagerDevice,
  isOwnerDevice,
  isStaffDevice,
  staffRole,
  staffRoleLabel,
  type StaffRole,
} from "@/lib/account";
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
import {
  createPairingCode,
  disconnectAttendant,
  inviteUrl,
} from "@/lib/pairing";
import { detectPixKeyType } from "@/lib/pix";
import { maskPhoneInput } from "@/lib/phone";
import { deleteAccountAndAllData, saveSettings } from "@/lib/repo";
import { seedDemoProducts } from "@/lib/seed";
import { getSyncState, pushAndPull, subscribeSync } from "@/lib/sync";
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

function DiagnosticIds({ vendorId }: { vendorId?: string }) {
  const linked = useSyncExternalStore(
    () => () => undefined,
    () => {
      try {
        return localStorage.getItem(LINKED_OWNER_KEY)?.trim() || "Nenhum";
      } catch {
        return "Nenhum";
      }
    },
    () => "Nenhum",
  );
  return (
    <div className="mt-6 space-y-0.5 break-all text-[11px] leading-relaxed text-muted/80">
      <p>Meu ID: {vendorId || "Deslogado"}</p>
      <p>ID do Chefe (Linked): {linked}</p>
    </div>
  );
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
  const [pairCode, setPairCode] = useState("");
  const [pairExpires, setPairExpires] = useState("");
  const [pairBusy, setPairBusy] = useState(false);
  const [pairRole, setPairRole] = useState<StaffRole>("ajudante");
  const [allowHelperTotals, setAllowHelperTotals] = useState(
    settings.hideStoreTotals === false,
  );
  const [allowHelperEditPrices, setAllowHelperEditPrices] = useState(
    settings.allowHelperEditPrices === true,
  );
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
      hideStoreTotals: !allowHelperTotals,
      allowHelperEditPrices,
    });
    toast("Configurações salvas");
  }

  const sync = getSyncState();

  if (isAttendantDevice(settings)) {
    return (
      <div className="flex flex-col gap-4">
        <section className="rounded-3xl border-2 border-mint bg-surface p-4">
          <p className="text-xs font-extrabold uppercase tracking-widest text-mint">
            {staffRoleLabel(staffRole(settings))}
          </p>
          <p className="mt-1 text-lg font-black">{settings.attendantName || "Equipe"}</p>
          <p className="text-sm font-bold text-muted">
            Conectado à banca. Pix, cobrança e totais da loja ficam só com o dono.
          </p>
        </section>
        <Field label="Seu nome neste aparelho">
          <input
            className={inputClass}
            value={attendantName}
            onChange={(e) => setAttendantName(e.target.value)}
          />
        </Field>
        <Button
          onClick={async () => {
            await saveSettings({ attendantName: attendantName.trim() });
          }}
        >
          Salvar nome
        </Button>
        <Button
          variant="alert"
          onClick={async () => {
            const ok = window.confirm(
              "Sair da banca? Este aparelho volta ao modo grátis e apaga o catálogo local da banca.",
            );
            if (!ok) return;
            await disconnectAttendant();
          }}
        >
          Desconectar / Sair da Banca
        </Button>
        <DiagnosticIds vendorId={settings.vendorId} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {canEditBilling(settings) ? (
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
      ) : (
        <p className="text-sm font-bold text-muted">
          Perfil {staffRoleLabel(staffRole(settings))}: catálogo e conexão de
          aparelhos liberados. Totais, Pix e planos só o dono vê.
        </p>
      )}

      <Field label="Tipo de negócio">
        <select
          className={inputClass}
          value={businessType}
          onChange={(e) => setBusinessType(e.target.value as BusinessType)}
        >
          {BUSINESS_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Nome do Negócio / Banca">
        <input
          className={inputClass}
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          placeholder="Banca da Maria"
        />
      </Field>
      {canEditBilling(settings) ? (
      <>
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
      </>
      ) : null}
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
      {isAttendantDevice(settings) ? (
        <section className="rounded-3xl border-2 border-mint bg-surface p-4">
          <p className="text-xs font-extrabold uppercase tracking-widest text-mint">
            Aparelho de ajudante
          </p>
          <p className="mt-1 text-sm font-bold text-muted">
            Conectado à banca principal. Vendas entram com o nome{" "}
            <span className="text-white">{settings.attendantName || "sem nome"}</span>.
          </p>
          <Button
            variant="alert"
            className="mt-3 w-full"
            onClick={async () => {
              const ok = window.confirm(
                "Sair da banca? Este aparelho volta ao modo grátis e apaga o catálogo local da banca.",
              );
              if (!ok) return;
              await disconnectAttendant();
            }}
          >
            Desconectar / Sair da Banca
          </Button>
        </section>
      ) : null}

      {canPairDevices(settings) && (isNegocio(settings) || isManagerDevice(settings)) ? (
        <section className="rounded-3xl border-2 border-sun bg-surface p-4">
          <h2 className="text-lg font-black">Conectar Novo Aparelho / Ajudante</h2>
          <p className="mt-1 text-sm font-bold text-muted">
            Gere um código de 6 dígitos (válido por 24 horas) ou um QR. O ajudante
            entra sem login da conta principal.
          </p>
          {isOwnerDevice(settings) ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(["ajudante", "gerente"] as const).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setPairRole(role)}
                className={`min-h-12 rounded-2xl border-2 text-sm font-extrabold uppercase ${
                  pairRole === role
                    ? "border-sun bg-sun text-sunink"
                    : "border-line bg-surface2 text-white"
                }`}
              >
                {role === "gerente" ? "Gerente" : "Ajudante"}
              </button>
            ))}
          </div>
          ) : (
            <p className="mt-2 text-xs font-bold text-muted">
              Gerente só pode conectar novos aparelhos como Ajudante.
            </p>
          )}
          {isOwnerDevice(settings) ? (
          <>
          <label className="mt-3 flex items-start gap-3 rounded-2xl border-2 border-line bg-surface2 p-3">
            <input
              type="checkbox"
              className="mt-1 h-6 w-6 shrink-0 accent-sun"
              checked={allowHelperTotals}
              onChange={(e) => setAllowHelperTotals(e.target.checked)}
            />
            <span className="text-sm font-bold leading-snug">
              Permitir que ajudantes vejam o total geral da banca
              <span className="mt-1 block text-xs font-bold text-muted">
                Não se aplica a Gerente (sem acesso a totais da loja).
              </span>
            </span>
          </label>
          <label className="mt-3 flex items-start gap-3 rounded-2xl border-2 border-line bg-surface2 p-3">
            <input
              type="checkbox"
              className="mt-1 h-6 w-6 shrink-0 accent-sun"
              checked={allowHelperEditPrices}
              onChange={(e) => setAllowHelperEditPrices(e.target.checked)}
            />
            <span className="text-sm font-bold leading-snug">
              Permitir que o Ajudante edite preços
              <span className="mt-1 block text-xs font-bold text-muted">
                Desligado: o Ajudante não altera preço no catálogo nem no carrinho.
              </span>
            </span>
          </label>
          </>
          ) : null}
          <Button
            className="mt-3 w-full"
            disabled={pairBusy}
            onClick={async () => {
              setPairBusy(true);
              try {
                await saveSettings({
                  hideStoreTotals: !allowHelperTotals,
                  allowHelperEditPrices,
                });
                const created = await createPairingCode(
                  isOwnerDevice(settings) ? pairRole : "ajudante",
                );
                setPairCode(created.code);
                setPairExpires(created.expiresAt);
                toast("Código de conexão gerado");
              } catch (err) {
                toast(
                  err instanceof Error ? err.message : "Não deu para gerar o código.",
                  "err",
                );
              } finally {
                setPairBusy(false);
              }
            }}
          >
            {pairBusy ? "Gerando…" : "Gerar Código de Conexão"}
          </Button>
          {pairCode ? (
            <div className="mt-4 flex flex-col items-center gap-3">
              <p className="text-4xl font-black tracking-[0.28em] text-sun">{pairCode}</p>
              <p className="text-center text-xs font-bold text-muted">
                Expira em {new Date(pairExpires).toLocaleString("pt-BR")}
              </p>
              <div className="rounded-2xl bg-white p-3">
                <QRCodeSVG
                  value={inviteUrl(pairCode)}
                  size={180}
                  bgColor="#ffffff"
                  fgColor="#000000"
                  level="M"
                />
              </div>
              <p className="break-all text-center text-xs font-bold text-muted">
                {inviteUrl(pairCode)}
              </p>
              <Button
                variant="line"
                className="w-full"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(inviteUrl(pairCode));
                    toast("Link copiado");
                  } catch {
                    toast("Não deu para copiar.", "err");
                  }
                }}
              >
                <Copy className="h-5 w-5" />
                Copiar link do convite
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      {isNegocio(settings) || activePlan === "equipe" || isAttendantDevice(settings) ? (
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

      {isStaffDevice(settings) ? (
        <Button
          variant="alert"
          onClick={async () => {
            const ok = window.confirm(
              "Sair da banca? Este aparelho volta ao modo grátis e apaga o catálogo local da banca.",
            );
            if (!ok) return;
            await disconnectAttendant();
          }}
        >
          Desconectar / Sair da Banca
        </Button>
      ) : null}

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
          try {
            const n = await seedDemoProducts(businessType);
            toast(`${n} produtos de exemplo adicionados`);
          } catch (err) {
            toast(
              err instanceof Error ? err.message : "Não deu pra gravar os exemplos.",
              "err",
            );
          }
        }}
      >
        Carregar catálogo de exemplo
      </Button>

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

      {canEditBilling(settings) ? (
      <>
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
      </>
      ) : null}

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

      <DiagnosticIds vendorId={settings.vendorId} />
    </div>
  );
}
