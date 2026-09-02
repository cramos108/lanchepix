"use client";

import { Button } from "@/components/ui";
import { useMasterSettings } from "@/components/MasterSettingsProvider";
import { staffRoleLabel } from "@/lib/account";
import { useT } from "@/lib/i18n";
import { disconnectAttendant } from "@/lib/pairing";
import { LINKED_OWNER_KEY } from "@/lib/account";

export function HelperSessionView() {
  const t = useT();
  const master = useMasterSettings();
  const store = master.storeName || master.local?.storeName || "—";
  const role = staffRoleLabel(master.role);
  let linked = "";
  try {
    linked = localStorage.getItem(LINKED_OWNER_KEY)?.trim() || "";
  } catch {
    linked = "";
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-3xl border-2 border-mint bg-surface p-4">
        <p className="text-xs font-extrabold uppercase tracking-widest text-mint">
          {t("helper.session")}
        </p>
        <p className="mt-3 text-sm font-bold text-muted">{t("helper.connectedTo")}</p>
        <p className="text-2xl font-black leading-tight">{store}</p>
        <p className="mt-3 text-sm font-bold text-muted">{t("helper.yourRole")}</p>
        <p className="text-xl font-black text-sun">{role}</p>
        {master.local?.attendantName ? (
          <p className="mt-2 text-sm font-bold text-muted">
            {master.local.attendantName}
          </p>
        ) : null}
      </section>
      <Button
        variant="alert"
        className="w-full"
        onClick={async () => {
          const ok = window.confirm(t("btn.disconnectAsk"));
          if (!ok) return;
          await disconnectAttendant();
        }}
      >
        {t("btn.disconnect")}
      </Button>
      <div className="space-y-0.5 break-all text-[11px] leading-relaxed text-muted/80">
        <p>Meu ID: {master.local?.vendorId || "—"}</p>
        <p>ID do Chefe: {linked || master.ownerId || "—"}</p>
      </div>
    </div>
  );
}
