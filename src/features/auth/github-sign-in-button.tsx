'use client'

import { useSignIn } from '@clerk/nextjs/legacy'
import { LogIn } from 'lucide-react'
import { useState } from 'react'
import {
  AUTHENTICATED_HOME_PATH,
  CLERK_OAUTH_CALLBACK_PATH,
} from '@/entities/auth'
import { Button } from '@/shared/ui/button'

export function GitHubSignInButton() {
  const { isLoaded, signIn } = useSignIn()
  const [error, setError] = useState<string | null>(null)

  async function signInWithGitHub() {
    if (!isLoaded || !signIn) {
      return
    }

    setError(null)

    try {
      await signIn.authenticateWithRedirect({
        redirectUrl: CLERK_OAUTH_CALLBACK_PATH,
        redirectUrlComplete: AUTHENTICATED_HOME_PATH,
        strategy: 'oauth_github',
      })
    } catch {
      setError('GitHub sign-in could not start.')
    }
  }

  return (
    <div className="grid justify-items-end gap-1">
      <Button
        disabled={!isLoaded}
        onClick={signInWithGitHub}
        type="button"
        variant="primary"
      >
        <LogIn aria-hidden="true" className="size-4" />
        Sign in with GitHub
      </Button>
      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
    </div>
  )
}
