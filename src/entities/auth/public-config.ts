export const CLERK_OAUTH_CALLBACK_PATH = "/sso-callback";
export const AUTHENTICATED_HOME_PATH = "/";

export function isClerkClientConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
}
