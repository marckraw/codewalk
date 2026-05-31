import "server-only";

import { eq } from "drizzle-orm";
import { db } from "./client";
import { users } from "./schema";

export type AuthenticatedUserInput = {
  clerkUserId: string;
  email: string | null;
  name: string | null;
};

export async function upsertAuthenticatedUser(input: AuthenticatedUserInput) {
  const [user] = await db
    .insert(users)
    .values({
      clerkUserId: input.clerkUserId,
      email: input.email,
      name: input.name,
    })
    .onConflictDoUpdate({
      set: {
        email: input.email,
        name: input.name,
        updatedAt: new Date(),
      },
      target: users.clerkUserId,
    })
    .returning();

  return user;
}

export async function getUserByClerkId(clerkUserId: string) {
  const [user] = await db.select().from(users).where(eq(users.clerkUserId, clerkUserId)).limit(1);

  return user ?? null;
}
