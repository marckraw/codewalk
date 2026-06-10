'use client'

import { ClerkProvider } from '@clerk/nextjs'
import type { ReactNode } from 'react'
import {
  AUTHENTICATED_HOME_PATH,
  isClerkClientConfigured,
} from '@/entities/auth'

type AuthProviderProps = {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  if (!isClerkClientConfigured()) {
    return children
  }

  return (
    <ClerkProvider
      signInFallbackRedirectUrl={AUTHENTICATED_HOME_PATH}
      signUpFallbackRedirectUrl={AUTHENTICATED_HOME_PATH}
    >
      {children}
    </ClerkProvider>
  )
}
