"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  getActiveOwnerId,
  isStaffDevice,
  staffRole,
  type StaffRole,
} from "@/lib/account";
import { db } from "@/lib/db";
import { setPrefs } from "@/lib/prefs";
import { refetchOwnerSettings } from "@/lib/sync";
import type { Settings } from "@/lib/types";

export type MasterSettingsValue = {
  local: Settings | null;
  master: Settings | null;
  role: StaffRole;
  ownerId: string;
  isPaired: boolean;
  ready: boolean;
  pixKey: string;
  whatsapp: string;
  currency: Settings["currency"];
  language: Settings["language"];
  storeName: string;
  merchantName: string;
  merchantCity: string;
  paymentLink: string;
};

const empty: MasterSettingsValue = {
  local: null,
  master: null,
  role: "dono",
  ownerId: "",
  isPaired: false,
  ready: true,
  pixKey: "",
  whatsapp: "",
  currency: "BRL",
  language: "pt",
  storeName: "",
  merchantName: "",
  merchantCity: "",
  paymentLink: "",
};

const MasterSettingsContext = createContext<MasterSettingsValue>(empty);

export function useMasterSettings(): MasterSettingsValue {
  return useContext(MasterSettingsContext);
}

export function MasterSettingsProvider({ children }: { children: ReactNode }) {
  const local = useLiveQuery(() => db.settings.get("app"), []) ?? null;
  const [master, setMaster] = useState<Settings | null>(null);
  const [ready, setReady] = useState(true);
  const isPaired = Boolean(local && isStaffDevice(local));
  const ownerId = local ? getActiveOwnerId(local) : "";

  useEffect(() => {
    if (!isPaired) {
      setMaster(null);
      setReady(true);
      return;
    }
    setReady(false);
    void refetchOwnerSettings()
      .then((row) => setMaster(row))
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, [isPaired, ownerId]);

  useEffect(() => {
    const src = isPaired ? master ?? local : local;
    if (!src) return;
    setPrefs({
      currency: src.currency || "BRL",
      language: src.language || "pt",
    });
  }, [isPaired, master, local]);

  const value = useMemo<MasterSettingsValue>(() => {
    const role = staffRole(local);
    const src = isPaired ? master ?? local : local;
    return {
      local,
      master,
      role,
      ownerId,
      isPaired,
      ready,
      pixKey: (src?.pixKey || "").trim(),
      whatsapp: (src?.whatsapp || "").trim(),
      currency: src?.currency || "BRL",
      language: src?.language || "pt",
      storeName: src?.storeName || local?.storeName || "",
      merchantName: src?.merchantName || "",
      merchantCity: src?.merchantCity || "",
      paymentLink: src?.paymentLink || "",
    };
  }, [local, master, isPaired, ownerId, ready]);

  return (
    <MasterSettingsContext.Provider value={value}>
      {children}
    </MasterSettingsContext.Provider>
  );
}
