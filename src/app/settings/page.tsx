import { RepositoryRulesManager } from "@/features/repository-rules";
import { SiteHeader } from "@/widgets/site-header";
import { Badge } from "@/shared/ui/badge";
import { EmptyState } from "@/shared/ui/empty-state";
import { Panel, PanelHeader } from "@/shared/ui/panel";
import { getCurrentCodewalkUser } from "@/entities/auth-server";
import { listRepositoryReviewRules } from "@/entities/database";
import { getGitHubAutomationConfig } from "@/entities/github-server";

export default async function SettingsPage() {
  const user = await getCurrentCodewalkUser();
  const isAuthenticated = user.status === "authenticated";
  const rules = isAuthenticated ? await listRepositoryReviewRules() : [];
  const githubConfig = getGitHubAutomationConfig();
  const allowedOwner = githubConfig.ok ? githubConfig.allowedOwner : null;

  return (
    <main className="min-h-screen">
      <SiteHeader />

      <section className="px-4 py-4 sm:px-6">
        {!isAuthenticated ? (
          <Panel className="min-h-[calc(100vh-88px)]">
            <PanelHeader
              actions={<Badge tone="warning">auth required</Badge>}
              description="Sign in with GitHub to manage Codewalk settings."
              title="Settings"
            />
            <div className="grid min-h-[calc(100vh-137px)] place-items-center p-4">
              <EmptyState
                className="w-full max-w-xl"
                description="Use the GitHub sign-in button to manage repository rules."
                title="Sign in required"
              />
            </div>
          </Panel>
        ) : (
          <Panel className="min-h-[calc(100vh-88px)]">
            <PanelHeader
              actions={<Badge tone="muted">{rules.length} rules</Badge>}
              description={
                allowedOwner
                  ? `Every repository in ${allowedOwner} gets guided reviews by default. Whitelist repositories outside it, or block noisy ones inside it.`
                  : "Whitelist repositories for guided reviews, or block noisy ones. Set GITHUB_ALLOWED_OWNER to enable an org-wide default."
              }
              title="Repository rules"
            />
            <div className="p-4">
              <RepositoryRulesManager
                allowedOwner={allowedOwner}
                initialRules={rules.map((rule) => ({
                  id: rule.id,
                  owner: rule.owner,
                  repo: rule.repo,
                  rule: rule.rule,
                }))}
              />
            </div>
          </Panel>
        )}
      </section>
    </main>
  );
}
