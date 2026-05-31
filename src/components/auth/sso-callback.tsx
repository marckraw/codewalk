"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { AUTHENTICATED_HOME_PATH } from "@/lib/auth/public-config";

export function SsoCallback() {
  return <AuthenticateWithRedirectCallback signInFallbackRedirectUrl={AUTHENTICATED_HOME_PATH} />;
}
