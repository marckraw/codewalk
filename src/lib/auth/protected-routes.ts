export const PROTECTED_ROUTE_PATTERNS = ["/review(.*)"];

export function isProtectedAppPath(pathname: string) {
  return pathname === "/review" || pathname.startsWith("/review/");
}
