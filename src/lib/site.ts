export const APP_ORIGIN = "https://app.pixdaconfianca.com";
export const MARKETING_HOSTS = new Set([
  "pixdaconfianca.com",
  "www.pixdaconfianca.com",
]);
export const APP_HOSTS = new Set(["app.pixdaconfianca.com"]);

export function hostnameFromHost(host?: string | null): string {
  return (host ?? "").split(":")[0].trim().toLowerCase();
}

export function isMarketingHostname(hostname: string): boolean {
  return MARKETING_HOSTS.has(hostnameFromHost(hostname));
}

export function isAppHostname(hostname: string): boolean {
  return APP_HOSTS.has(hostnameFromHost(hostname));
}

export function isLegalPath(pathname: string): boolean {
  return (
    pathname === "/termos" ||
    pathname.startsWith("/termos/") ||
    pathname === "/privacidade" ||
    pathname.startsWith("/privacidade/")
  );
}

/** Public marketing site: apex/www host, or /site preview on any host. */
export function shouldShowLanding(hostname: string, pathname: string): boolean {
  if (pathname === "/site" || pathname.startsWith("/site/")) return true;
  if (isAppHostname(hostname)) return false;
  return isMarketingHostname(hostname) && !isLegalPath(pathname);
}

export function shouldShowMarketingChrome(
  hostname: string,
  pathname: string,
): boolean {
  return isMarketingHostname(hostname) && isLegalPath(pathname);
}
