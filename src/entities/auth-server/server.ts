import { auth, currentUser } from '@clerk/nextjs/server'
import {
  getMissingClerkEnvironmentKeys,
  isClerkServerConfigured,
} from './server-config'

export type CurrentCodewalkUser =
  | {
      status: 'authenticated'
      email: string | null
      name: string | null
      userId: string
    }
  | {
      missingKeys: string[]
      status: 'misconfigured'
    }
  | {
      status: 'signed-out'
    }

export async function getCurrentCodewalkUser(): Promise<CurrentCodewalkUser> {
  if (!isClerkServerConfigured()) {
    return {
      missingKeys: getMissingClerkEnvironmentKeys(),
      status: 'misconfigured',
    }
  }

  const { isAuthenticated, userId } = await auth()

  if (!isAuthenticated || !userId) {
    return { status: 'signed-out' }
  }

  const user = await currentUser()

  return {
    email: user?.primaryEmailAddress?.emailAddress ?? null,
    name: user?.fullName ?? user?.username ?? null,
    status: 'authenticated',
    userId,
  }
}
