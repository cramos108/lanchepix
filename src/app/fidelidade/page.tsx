"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { MessageCircle, Plus, Search, Trophy } from "lucide-react";
import { LgpdConsent } from "@/components/LgpdConsent";
import { StampCard } from "@/components/StampCard";
import { Button, EmptyState, Field, inputClass } from "@/components/ui";
import { db } from "@/lib/db";
import { digitsOnly, maskWhatsAppContactInput } from "@/lib/phone";
import {
  FREE_LOYALTY_LIMIT,
  canAddLoyaltyCard,
  isPro,
  openUpgradeModal,
} from "@/lib/plan";
import { addStamp, redeemReward, upsertCustomer } from "@/lib/repo";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n";
import { loyaltyRewardMessage, loyaltyStampMessage, waLink } from "@/lib/whatsapp";
import type { Customer } from "@/lib/types";

export default function FidelidadePage() {
  const t = useT();
  const settings = useLiveQuery(() => db.settings.get("app"), []);
  const customers = useLiveQuery(
    () =>
      db.customers
        .toArray()
        .then((rows) =>
          rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        ),
    [],
  );
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [lgpdOk, setLgpdOk] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const required = settings?.stampsRequired ?? 10;
  const digits = digitsOnly(query);

  const matches = useMemo(() => {
    const list = customers ?? [];
    if (!digits) return list.slice(0, 12);
    const q = query.toLowerCase();
    return list.filter(
      (c) =>
        digitsOnly(c.phone).includes(digits) ||
        c.name.toLowerCase().includes(q),
    );
  }, [customers, digits, query]);

  const selected: Customer | undefined = (customers ?? []).find(
    (c) => c.id === selectedId,
  );

  async function openOrCreate() {
    if (digits.length < 8) {
      toast(t("loyalty.needPhone"), "err");
      return;
    }
    if (!lgpdOk) {
      toast(t("loyalty.needLgpd"), "err");
      return;
    }
    if (!(await canAddLoyaltyCard(digits))) {
      openUpgradeModal();
      return;
    }
    try {
      const customer = await upsertCustomer({ phone: digits, name });
      setSelectedId(customer.id);
      toast(
        customer.totalStamps === 0 && customer.stamps === 0
          ? t("loyalty.open")
          : t("loyalty.open"),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.startsWith("PLAN_LIMIT_")) {
        openUpgradeModal();
        return;
      }
      toast(t("loyalty.empty"), "err");
    }
  }

  async function stamp(notify: boolean) {
    if (!selected || !settings) return;
    const next = await addStamp(selected.id);
    if (!next) return;
    if (next.stamps >= required) {
      toast(t("loyalty.open"));
    } else {
      toast(`${next.stamps}/${required}`);
    }
    if (notify) {
      window.open(
        waLink(
          next.phone,
          loyaltyStampMessage({
            storeName: settings.storeName,
            customerName: next.name,
            stamps: next.stamps,
            required,
            rewardLabel: settings.rewardLabel,
          }),
        ),
        "_blank",
      );
    }
  }

  async function redeem(notify: boolean) {
    if (!selected || !settings) return;
    const next = await redeemReward(selected.id);
    if (!next) return;
    toast(t("btn.save"));
    if (notify) {
      window.open(
        waLink(
          next.phone,
          loyaltyRewardMessage({
            storeName: settings.storeName,
            customerName: next.name,
            rewardLabel: settings.rewardLabel,
          }),
        ),
        "_blank",
      );
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-bold text-muted">
        {t("loyalty.search")}. {required} ·{" "}
        <span className="text-sun">{settings?.rewardLabel ?? "1 brinde grátis"}</span>.
      </p>
      {!isPro(settings) ? (
        <p className="text-xs font-extrabold uppercase tracking-widest text-amber">
          {customers?.length ?? 0}/{FREE_LOYALTY_LIMIT}
        </p>
      ) : null}

      <Field label={t("loyalty.search")} hint={t("loyalty.phoneHint")}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <input
            className={`${inputClass} pl-12`}
            inputMode="tel"
            placeholder="5511999999999"
            value={query}
            onChange={(e) => {
              setQuery(maskWhatsAppContactInput(e.target.value));
              setSelectedId(null);
            }}
          />
        </div>
      </Field>
      <Field label={t("loyalty.name")}>
        <input
          className={inputClass}
          placeholder={t("loyalty.name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <LgpdConsent checked={lgpdOk} onChange={setLgpdOk} />
      <Button disabled={!lgpdOk} onClick={() => void openOrCreate()}>
        <Plus className="h-5 w-5" />
        {t("loyalty.open")}
      </Button>

      {selected ? (
        <section className="flex flex-col gap-3 rounded-3xl border-2 border-sun bg-surface p-4">
          <div>
            <h2 className="text-2xl font-black leading-tight">
              {selected.name || t("loyalty.clients")}
            </h2>
            <p className="font-bold text-sky">{maskWhatsAppContactInput(selected.phone)}</p>
            <p className="text-sm text-muted">
              {selected.totalStamps} · {selected.rewardsClaimed}
            </p>
          </div>
          <StampCard filled={selected.stamps} total={required} />
          <div className="grid gap-2">
            <Button
              disabled={selected.stamps >= required}
              onClick={() => void stamp(false)}
            >
              {t("loyalty.stamp")}
            </Button>
            <Button
              variant="mint"
              disabled={selected.stamps >= required}
              onClick={() => void stamp(true)}
            >
              <MessageCircle className="h-5 w-5" />
              {t("loyalty.stampWa")}
            </Button>
            {selected.stamps >= required ? (
              <>
                <Button variant="sun" onClick={() => void redeem(true)}>
                  <Trophy className="h-5 w-5" />
                  {t("btn.save")}
                </Button>
                <Button variant="line" onClick={() => void redeem(false)}>
                  {t("btn.save")}
                </Button>
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      <section>
        <h3 className="mb-2 text-xs font-extrabold uppercase tracking-widest text-sun">
          {t("loyalty.clients")}
        </h3>
        {matches.length === 0 ? (
          <EmptyState
            title={t("loyalty.empty")}
            text={t("loyalty.emptyHint")}
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {matches.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(c.id);
                    setQuery(maskWhatsAppContactInput(c.phone));
                    setName(c.name);
                  }}
                  className={`flex w-full items-center justify-between rounded-2xl border-2 px-4 py-3 text-left ${
                    c.id === selectedId
                      ? "border-sun bg-sun/10"
                      : "border-line bg-surface"
                  }`}
                >
                  <span>
                    <span className="block font-black">{c.name || "—"}</span>
                    <span className="text-sm font-bold text-muted">
                      {maskWhatsAppContactInput(c.phone)}
                    </span>
                  </span>
                  <span className="text-lg font-black text-sun">
                    {c.stamps}/{required}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
