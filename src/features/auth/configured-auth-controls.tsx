"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { LogIn } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { GitHubSignInButton } from "./github-sign-in-button";

export function ConfiguredAuthControls() {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) {
    return (
      <Button disabled type="button" variant="primary">
        <LogIn aria-hidden="true" className="size-4" />
        Loading auth
      </Button>
    );
  }

  if (isSignedIn) {
    return <UserButton />;
  }

  return <GitHubSignInButton />;
}
