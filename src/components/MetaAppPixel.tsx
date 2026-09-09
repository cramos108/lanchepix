"use client";

import { useEffect } from "react";

const APP_PIXEL_ID = "1630461501768785";

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  push?: Fbq;
  loaded?: boolean;
  version?: string;
};

function ensureFbq(): Fbq | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as Window & { fbq?: Fbq; _fbq?: Fbq };
  if (w.fbq) return w.fbq;

  const fbq: Fbq = function (...args: unknown[]) {
    if (fbq.callMethod) {
      fbq.callMethod(...args);
    } else {
      (fbq.queue ??= []).push(args);
    }
  };
  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.push = fbq;
  w.fbq = fbq;
  w._fbq = fbq;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  const first = document.getElementsByTagName("script")[0];
  first?.parentNode?.insertBefore(script, first);
  return fbq;
}

export function MetaAppPixel() {
  useEffect(() => {
    const fbq = ensureFbq();
    if (!fbq) return;
    fbq("init", APP_PIXEL_ID);
    fbq("track", "PageView");
    fbq("trackCustom", "AppLoaded");
  }, []);

  return (
    <noscript>
      <img
        height="1"
        width="1"
        style={{ display: "none" }}
        src={`https://www.facebook.com/tr?id=${APP_PIXEL_ID}&ev=PageView&noscript=1`}
        alt=""
      />
      <img
        height="1"
        width="1"
        style={{ display: "none" }}
        src={`https://www.facebook.com/tr?id=${APP_PIXEL_ID}&ev=AppLoaded&noscript=1`}
        alt=""
      />
    </noscript>
  );
}
