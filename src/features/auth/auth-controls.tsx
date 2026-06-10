'use client'

import { LogIn } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { isClerkClientConfigured } from '@/entities/auth'
import { ConfiguredAuthControls } from './configured-auth-controls'

export function AuthControls() {
  if (!isClerkClientConfigured()) {
    return (
      <Button
        disabled
        title="Set Clerk environment keys to enable GitHub sign-in"
        type="button"
      >
        <LogIn aria-hidden="true" className="size-4" />
        Configure Clerk
      </Button>
    )
  }

  return <ConfiguredAuthControls />
}
