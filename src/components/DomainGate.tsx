"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { LandingPage, MarketingShell } from "@/components/LandingPage";
import {
  hostnameFromHost,
  isLegalPath,
  isMarketingHostname,
  showPosWorkspace,
} from "@/lib/site";

function subscribeEmpty() {
  return () => undefined;
}

export function DomainGate({
  children,
  serverHostname,
}: {
  children: ReactNode;
  serverHostname: string;
}) {
  const pathname = usePathname() || "/";
  const hostname = useSyncExternalStore(
    subscribeEmpty,
    () => hostnameFromHost(window.location.hostname),
    () => hostnameFromHost(serverHostname),
  );

  if (showPosWorkspace(hostname)) {
    return <AppShell>{children}</AppShell>;
  }

  if (isMarketingHostname(hostname) && isLegalPath(pathname)) {
    return <MarketingShell>{children}</MarketingShell>;
  }

  return <LandingPage />;
}
