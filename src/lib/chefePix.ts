"use client";

import { useEffect, useRef, useState } from "react";
import { CHEFE_PIX_KEY, getActiveOwnerId } from "./account";
import {
  fetchLinkedChefeProfileOnce,
  type ChefeProfile,
} from "./sync";
import type { Settings } from "./types";

function readCachedChefePix(): string {
  try {
    return (
      localStorage.getItem("ajudante_chave_pix")?.trim() ||
      localStorage.getItem(CHEFE_PIX_KEY)?.trim() ||
      localStorage.getItem("chefe_pix_key")?.trim() ||
      ""
    );
  } catch {
    return "";
  }
}

const emptyProfile = (): ChefeProfile => ({
  storeName: "",
  city: "",
  chavePix: readCachedChefePix(),
  merchantName: "",
});

/**
 * Single mount fetch of the linked Chefe store profile. Does not poll.
 */
export function useChefeProfileOnce(
  settings: Settings | null | undefined,
  enabled: boolean,
  ownerId?: string,
): ChefeProfile {
  const [profile, setProfile] = useState(emptyProfile);
  const started = useRef(false);
  const linked = ownerId || getActiveOwnerId(settings);

  useEffect(() => {
    if (!enabled || !linked || started.current) return;
    started.current = true;
    void fetchLinkedChefeProfileOnce(linked).then((fetched) => {
      if (fetched.chavePix || fetched.storeName || fetched.city) {
        setProfile(fetched);
      }
    });
  }, [enabled, linked]);

  return profile;
}

export function useChefePixOnce(
  settings: Settings | null | undefined,
  enabled: boolean,
  ownerId?: string,
): string {
  return useChefeProfileOnce(settings, enabled, ownerId).chavePix;
}
