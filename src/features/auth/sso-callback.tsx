'use client'

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs'
import { AUTHENTICATED_HOME_PATH } from '@/entities/auth'

export function SsoCallback() {
  return (
    <AuthenticateWithRedirectCallback
      signInFallbackRedirectUrl={AUTHENTICATED_HOME_PATH}
    />
  )
}
