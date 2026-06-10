"use client";

import { useId, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/empty-state";
import { TextField } from "@/shared/ui/text-field";
import { formatRepositoryRef, parseGitHubRepositoryInput } from "@/entities/github";

export type RepositoryRuleItem = {
  id: string;
  owner: string;
  repo: string;
  rule: "allow" | "block";
};

type RepositoryRulesManagerProps = {
  allowedOwner: string | null;
  initialRules: RepositoryRuleItem[];
};

export function RepositoryRulesManager({ allowedOwner, initialRules }: RepositoryRulesManagerProps) {
  const [rules, setRules] = useState(initialRules);
  const [repositoryInput, setRepositoryInput] = useState("");
  const [ruleType, setRuleType] = useState<"allow" | "block">("allow");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [removingRuleId, setRemovingRuleId] = useState<string | null>(null);
  const inputId = useId();

  const hint = useMemo(
    () => buildRuleHint({ allowedOwner, repositoryInput, ruleType }),
    [allowedOwner, repositoryInput, ruleType],
  );

  async function submitRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = parseGitHubRepositoryInput(repositoryInput);

    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/settings/repository-rules", {
        body: JSON.stringify({ repository: repositoryInput, rule: ruleType }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const body = (await response.json()) as { error?: string; rule?: RepositoryRuleItem };

      if (!response.ok || !body.rule) {
        setError(body.error ?? `Saving the rule failed with HTTP ${response.status}.`);
        return;
      }

      const saved = body.rule;
      setRules((current) => [saved, ...current.filter((rule) => rule.id !== saved.id)]);
      setRepositoryInput("");
    } catch {
      setError("The repository rules route is unavailable.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function removeRule(ruleId: string) {
    setError(null);
    setRemovingRuleId(ruleId);

    try {
      const response = await fetch(`/api/settings/repository-rules/${encodeURIComponent(ruleId)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Removing the rule failed with HTTP ${response.status}.`);
        return;
      }

      setRules((current) => current.filter((rule) => rule.id !== ruleId));
    } catch {
      setError("The repository rules route is unavailable.");
    } finally {
      setRemovingRuleId(null);
    }
  }

  return (
    <div className="grid max-w-3xl gap-4">
      <form className="grid gap-2" onSubmit={submitRule}>
        <label className="text-xs font-medium text-[var(--muted)]" htmlFor={inputId}>
          Repository
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <TextField
            className="flex-1"
            id={inputId}
            onChange={(event) => setRepositoryInput(event.target.value)}
            placeholder="https://github.com/owner/repo or owner/repo"
            value={repositoryInput}
          />
          <div aria-label="Rule type" className="flex rounded-md border border-[var(--border)] p-0.5" role="group">
            <Button
              aria-pressed={ruleType === "allow"}
              onClick={() => setRuleType("allow")}
              size="sm"
              type="button"
              variant={ruleType === "allow" ? "primary" : "ghost"}
            >
              Allow
            </Button>
            <Button
              aria-pressed={ruleType === "block"}
              onClick={() => setRuleType("block")}
              size="sm"
              type="button"
              variant={ruleType === "block" ? "primary" : "ghost"}
            >
              Block
            </Button>
          </div>
          <Button disabled={isSubmitting || !repositoryInput.trim()} type="submit" variant="primary">
            <Plus aria-hidden="true" className="size-4" />
            {isSubmitting ? "Saving" : "Add rule"}
          </Button>
        </div>
        {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
        {hint ? <p className="text-xs text-[var(--warning)]">{hint}</p> : null}
      </form>

      {rules.length === 0 ? (
        <EmptyState
          description={
            allowedOwner
              ? `No rules yet. Repositories in ${allowedOwner} already get guided reviews; add a rule to whitelist an outside repository or block one inside the org.`
              : "No rules yet. Add a repository to whitelist it for guided reviews."
          }
          title="No repository rules"
        />
      ) : (
        <ul className="grid gap-2">
          {rules.map((rule) => (
            <li
              className="flex items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--panel-subtle)] px-3 py-2"
              key={rule.id}
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-sm">{formatRepositoryRef(rule)}</p>
                <p className="text-xs text-[var(--muted)]">{describeRule(rule, allowedOwner)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone={rule.rule === "allow" ? "success" : "danger"}>
                  {rule.rule === "allow" ? "Allowed" : "Blocked"}
                </Badge>
                <Button
                  aria-label={`Remove rule for ${formatRepositoryRef(rule)}`}
                  disabled={removingRuleId === rule.id}
                  onClick={() => removeRule(rule.id)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function buildRuleHint(input: { allowedOwner: string | null; repositoryInput: string; ruleType: "allow" | "block" }) {
  if (!input.allowedOwner) {
    return null;
  }

  const parsed = parseGitHubRepositoryInput(input.repositoryInput);

  if (!parsed.ok) {
    return null;
  }

  const insideAllowedOwner = parsed.repository.owner.toLowerCase() === input.allowedOwner.toLowerCase();

  if (insideAllowedOwner && input.ruleType === "allow") {
    return `Repositories in ${input.allowedOwner} are already reviewed by default — an allow rule is redundant.`;
  }

  if (!insideAllowedOwner && input.ruleType === "block") {
    return `Repositories outside ${input.allowedOwner} are ignored by default — a block rule has no effect.`;
  }

  return null;
}

function describeRule(rule: RepositoryRuleItem, allowedOwner: string | null) {
  if (!allowedOwner) {
    return rule.rule === "allow" ? "Whitelisted for guided reviews" : "Excluded from guided reviews";
  }

  const insideAllowedOwner = rule.owner.toLowerCase() === allowedOwner.toLowerCase();

  if (rule.rule === "block") {
    return insideAllowedOwner
      ? `Overrides the ${allowedOwner} org default`
      : "Excluded from guided reviews";
  }

  return insideAllowedOwner
    ? `Redundant — ${allowedOwner} is reviewed by default`
    : `Outside ${allowedOwner} — whitelisted for guided reviews`;
}
