export const PROTECTED_ROUTE_PATTERNS = ["/review(.*)", "/api(.*)"];

export function isProtectedAppPath(pathname: string) {
  return pathname === "/review" || pathname.startsWith("/review/") || pathname.startsWith("/api/");
}
