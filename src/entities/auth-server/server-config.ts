export function isClerkServerConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.CLERK_SECRET_KEY,
  )
}

export function getMissingClerkEnvironmentKeys() {
  return [
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
      ? null
      : 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    process.env.CLERK_SECRET_KEY ? null : 'CLERK_SECRET_KEY',
  ].filter((key): key is string => Boolean(key))
}
