export const PROTECTED_ROUTE_PATTERNS = ["/review(.*)", "/settings(.*)"];

export function isProtectedAppPath(pathname: string) {
  return (
    pathname === "/review" ||
    pathname.startsWith("/review/") ||
    pathname === "/settings" ||
    pathname.startsWith("/settings/")
  );
}
