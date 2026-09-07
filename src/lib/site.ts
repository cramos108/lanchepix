export const APP_ORIGIN = "https://app.pixdaconfianca.com";

const MARKETING_HOSTS = new Set([
  "pixdaconfianca.com",
  "www.pixdaconfianca.com",
]);

const APP_HOSTS = new Set(["app.pixdaconfianca.com", "app.localhost"]);

const LOCAL_DEV_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function hostnameFromHost(host?: string | null): string {
  return (host ?? "").split(":")[0].trim().toLowerCase();
}

export function isAppHostname(hostname: string): boolean {
  return APP_HOSTS.has(hostnameFromHost(hostname));
}

export function isLocalDevHostname(hostname: string): boolean {
  const host = hostnameFromHost(hostname);
  return LOCAL_DEV_HOSTS.has(host) || host.endsWith(".localhost");
}

export function isMarketingHostname(hostname: string): boolean {
  const host = hostnameFromHost(hostname);
  if (isAppHostname(host)) return false;
  return MARKETING_HOSTS.has(host) || isLocalDevHostname(host);
}

export function isLegalPath(pathname: string): boolean {
  return (
    pathname === "/termos" ||
    pathname.startsWith("/termos/") ||
    pathname === "/privacidade" ||
    pathname.startsWith("/privacidade/")
  );
}

/** POS only on the app host (and non-marketing hosts like Vercel previews). Never on apex/www/localhost. */
export function showPosWorkspace(hostname: string): boolean {
  if (isMarketingHostname(hostname)) return false;
  return true;
}

export function goToApp(): void {
  if (typeof window === "undefined") return;
  window.location.assign(APP_ORIGIN);
}
