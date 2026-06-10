import type { ReactNode } from "react";
import { SiteHeader } from "@/widgets/site-header";

export function ReviewSnapshotPageShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen">
      <SiteHeader />
      {children}
    </main>
  );
}
