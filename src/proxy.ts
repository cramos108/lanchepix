import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const hostname = (request.headers.get("host") ?? "")
    .split(":")[0]
    .trim()
    .toLowerCase();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-hostname", hostname);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|ads/|sw.js|manifest.json).*)",
  ],
};
