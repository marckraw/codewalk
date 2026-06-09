import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { PROTECTED_ROUTE_PATTERNS } from "@/lib/auth/protected-routes";
import { isClerkServerConfigured } from "@/lib/auth/server-config";

const isProtectedRoute = createRouteMatcher(PROTECTED_ROUTE_PATTERNS);

const configuredClerkMiddleware = clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  if (!isClerkServerConfigured()) {
    return NextResponse.next();
  }

  return configuredClerkMiddleware(req, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
