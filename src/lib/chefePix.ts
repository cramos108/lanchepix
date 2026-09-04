"use client";

import { useEffect, useRef, useState } from "react";
import { CHEFE_PIX_KEY, getActiveOwnerId } from "./account";
import { fetchLinkedChefePixOnce } from "./sync";
import type { Settings } from "./types";

function readCachedChefePix(): string {
  try {
    return localStorage.getItem(CHEFE_PIX_KEY)?.trim() || "";
  } catch {
    return "";
  }
}

/**
 * Single mount fetch of the linked Chefe Pix key. Does not poll.
 */
export function useChefePixOnce(
  settings: Settings | null | undefined,
  enabled: boolean,
  ownerId?: string,
): string {
  const [key, setKey] = useState(readCachedChefePix);
  const started = useRef(false);
  const linked = ownerId || getActiveOwnerId(settings);

  useEffect(() => {
    if (!enabled || !linked || started.current) return;
    started.current = true;
    void fetchLinkedChefePixOnce(linked).then((fetched) => {
      if (fetched) setKey(fetched);
    });
  }, [enabled, linked]);

  return key;
}
