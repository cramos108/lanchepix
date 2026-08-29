"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  CircleHelp,
  CreditCard,
  Eye,
  EyeOff,
  Handshake,
  QrCode,
  Settings,
  Package,
  Store,
  WifiOff,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useHideBalances } from "@/components/Money";
import { PairingJoinModal } from "@/components/PairingJoinModal";
import { TutorialModal, useTutorial } from "@/components/TutorialModal";
import { UpgradeModal } from "@/components/UpgradeModal";
import {
  accountVendorId,
  getActiveOwnerId,
  canSeeFinances,
  isAttendantDevice,
  isStaffDevice,
  staffRole,
  staffRoleLabel,
  visibleSalesForDevice,
} from "@/lib/account";
import { toggleHideBalances } from "@/lib/privacy";
import { APP_NAME } from "@/lib/brand";
import { db, ensureSettings } from "@/lib/db";
import {
  isNegocio,
  openUpgradeModal,
  planBadge,
  subscribeDevPlan,
  getDevPlanOverride,
  getDevSimulateLimit,
  getStoredActivePlan,
} from "@/lib/plan";
import { restorePairFromLocal, subscribePairingJoinModal } from "@/lib/pairing";
import { scheduleSync, startSalesRealtime, subscribeSync, getSyncState } from "@/lib/sync";
import { subscribeToast, type Toast } from "@/lib/toast";

const NAV = [
  { href: "/", label: "Vender", icon: Store },
  { href: "/produtos", label: "Catálogo", icon: Package },
  { href: "/pendentes", label: "Confiança", icon: Handshake },
  { href: "/fidelidade", label: "Cartão", icon: CreditCard },
  { href: "/pix", label: "Pix", icon: QrCode },
] as const;

const TITLES: Record<string, string> = {
  "/": "Vender agora",
  "/produtos": "Produtos / Catálogo",
  "/pendentes": "Pix Confiança",
  "/fidelidade": "Cartão fidelidade",
  "/pix": "QR Code Pix",
  "/configuracoes": "Configurações",
  "/termos": "Termos de uso",
  "/pro/sucesso": "Pix da Confiança Pro",
};

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [syncTick, setSyncTick] = useState(0);
  const [pairManual, setPairManual] = useState(false);
  const [pairDismissed, setPairDismissed] = useState(false);
  const pairCodeFromUrl = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("popstate", onChange);
      return () => window.removeEventListener("popstate", onChange);
    },
    () =>
      (new URLSearchParams(window.location.search).get("pair_code") ?? "")
        .replace(/\D/g, "")
        .slice(0, 6),
    () => "",
  );
  const pairOpen = pairManual || (pairCodeFromUrl.length === 6 && !pairDismissed);

  useEffect(() => subscribePairingJoinModal(() => setPairManual(true)), []);
  const {
    open: tutorialOpen,
    openTutorial,
    closeTutorial,
    step: tutorialStep,
    setStep: setTutorialStep,
  } = useTutorial();
  const hideBalances = useHideBalances();
  const devPlanTick = useSyncExternalStore(
    subscribeDevPlan,
    () =>
      `${getDevPlanOverride() ?? ""}:${getDevSimulateLimit() ? "1" : "0"}:${getStoredActivePlan() ?? ""}`,
    () => "",
  );

  const pendingCount =
    useLiveQuery(async () => {
      const app = await db.settings.get("app");
      const rows = await db.sales.filter((s) => s.status === "pending").toArray();
      return visibleSalesForDevice(rows, app).length;
    }, []) ?? 0;
  const settings = useLiveQuery(() => db.settings.get("app"), []);

  useEffect(() => {
    void ensureSettings()
      .then(() => restorePairFromLocal())
      .then(() => scheduleSync());
  }, []);

  useEffect(() => {
    const accountId = getActiveOwnerId(settings) || accountVendorId(settings);
    if (!accountId) return;
    if (!isNegocio(settings) && !isStaffDevice(settings)) return;
    return startSalesRealtime(accountId);
  }, [settings, settings?.vendorId, settings?.plan, settings?.pairedOwnerId, devPlanTick]);



  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      scheduleSync();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => subscribeSync(() => setSyncTick((n) => n + 1)), []);

  useEffect(() => {
    return subscribeToast((t) => {
      setToasts((list) => [...list.slice(-3), t]);
      window.setTimeout(() => {
        setToasts((list) => list.filter((x) => x.id !== t.id));
      }, 2800);
    });
  }, []);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }
  }, []);

  const sync = getSyncState();
  void syncTick;

  if (pathname === "/campanha") {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-ink">
      <header className="print-hidden sticky top-0 z-30 border-b-2 border-line bg-ink/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-sun">
              {APP_NAME}
            </p>
            <h1 className="truncate text-2xl font-black leading-tight">
              {TITLES[pathname] ?? settings?.storeName ?? APP_NAME}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {isStaffDevice(settings) ? (
              <span className="rounded-full border-2 border-mint bg-mint px-2 py-1 text-[11px] font-black uppercase text-sunink">
                {staffRoleLabel(staffRole(settings))}
              </span>
            ) : planBadge(settings) ? (
              <span className="rounded-full border-2 border-sun bg-sun px-2 py-1 text-[11px] font-black uppercase text-sunink">
                {planBadge(settings)}
              </span>
            ) : (
              <button
                type="button"
                onClick={openUpgradeModal}
                className="rounded-full border-2 border-sun bg-sun px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-sunink"
              >
                Seja Pro
              </button>
            )}
            {!online ? (
              <span className="inline-flex items-center gap-1 rounded-full border-2 border-amber bg-amber px-2 py-1 text-[11px] font-black uppercase text-sunink">
                <WifiOff className="h-3.5 w-3.5" />
                Offline
              </span>
            ) : sync.running ? (
              <span className="rounded-full border-2 border-sky px-2 py-1 text-[11px] font-black uppercase text-sky">
                Sync
              </span>
            ) : planBadge(settings) ? (
              <span className="rounded-full border-2 border-mint px-2 py-1 text-[11px] font-black uppercase text-mint">
                Online
              </span>
            ) : null}
            {canSeeFinances(settings) ? (
            <button
              type="button"
              aria-label={hideBalances ? "Mostrar saldos" : "Ocultar saldos"}
              title={hideBalances ? "Saldos ocultos — toque para mostrar" : "Saldos visíveis — toque para ocultar"}
              onClick={toggleHideBalances}
              className="grid h-12 w-12 place-items-center rounded-2xl border-2 border-line bg-surface text-white"
            >
              {hideBalances ? (
                <EyeOff className="h-6 w-6" aria-hidden />
              ) : (
                <Eye className="h-6 w-6" aria-hidden />
              )}
            </button>
            ) : null}
            <button
              type="button"
              aria-label="Abrir tutorial"
              onClick={openTutorial}
              className="grid h-12 w-12 place-items-center rounded-2xl border-2 border-line bg-surface text-white"
            >
              <CircleHelp className="h-6 w-6" />
            </button>
            {isAttendantDevice(settings) ? null : (
              <Link
                href="/configuracoes"
                aria-label="Configurações"
                className={`grid h-12 w-12 place-items-center rounded-2xl border-2 ${
                  pathname === "/configuracoes"
                    ? "border-sun bg-sun text-sunink"
                    : "border-line bg-surface text-white"
                }`}
              >
                <Settings className="h-6 w-6" />
              </Link>
            )}
          </div>
        </div>
      </header>

      {!online ? (
        <div className="print-hidden border-b-2 border-amber bg-amber px-4 py-2 text-center text-sm font-extrabold text-sunink">
          Sem internet — tudo continua salvo neste celular.
        </div>
      ) : null}

      {installEvent ? (
        <div className="print-hidden mx-4 mt-3 flex items-center justify-between gap-3 rounded-2xl border-2 border-sun bg-surface px-3 py-2">
          <p className="text-sm font-bold">Instale o app na tela inicial.</p>
          <button
            type="button"
            className="rounded-xl bg-sun px-3 py-2 text-xs font-black uppercase text-sunink"
            onClick={async () => {
              await installEvent.prompt();
              setInstallEvent(null);
            }}
          >
            Instalar
          </button>
        </div>
      ) : null}

      <main className="flex-1 px-4 pb-28 pt-4">
        {children}
        <p className="print-hidden mt-8 pb-2 text-center text-xs font-bold text-muted">
          <Link href="/termos" className="underline decoration-sun/60 underline-offset-2">
            Termos de uso
          </Link>
          {" · "}
          {APP_NAME} não é um serviço financeiro.
        </p>
      </main>

      <nav className="print-hidden fixed bottom-0 left-1/2 z-30 w-full max-w-lg -translate-x-1/2 border-t-2 border-line bg-ink/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
        <ul className="grid grid-cols-5 px-1">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`relative flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl ${
                    active ? "text-sun" : "text-muted"
                  }`}
                >
                  <span className="relative">
                    <Icon className="h-6 w-6" strokeWidth={active ? 2.6 : 2} />
                    {item.href === "/pendentes" && pendingCount > 0 ? (
                      <span className="absolute -right-3 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-alert px-1 text-[10px] font-black text-white">
                        {pendingCount > 9 ? "9+" : pendingCount}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-[10px] font-extrabold uppercase tracking-wide">
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <TutorialModal
        open={tutorialOpen}
        onClose={closeTutorial}
        step={tutorialStep}
        setStep={setTutorialStep}
        onConnectHelper={() => setPairManual(true)}
      />
      <PairingJoinModal
        key={`${pairOpen ? "open" : "shut"}-${pairCodeFromUrl}`}
        open={pairOpen}
        initialCode={pairCodeFromUrl}
        onClose={() => {
          setPairManual(false);
          setPairDismissed(true);
        }}
      />
      <UpgradeModal />

      <div className="print-hidden pointer-events-none fixed inset-x-0 bottom-24 z-40 mx-auto flex w-full max-w-lg flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto w-full rounded-2xl border-2 px-4 py-3 text-center text-sm font-extrabold ${
              t.kind === "err"
                ? "border-alert bg-alert text-white"
                : t.kind === "info"
                  ? "border-sky bg-sky text-sunink"
                  : "border-sun bg-sun text-sunink"
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
