"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type CodeReviewGuideGenerationControlProps = {
  autoStart?: boolean;
  force?: boolean;
  label?: string;
  onGenerationStart?: () => void;
  snapshotId: string;
};

type GenerationResponse = {
  error?: string;
  status?: string;
};

export function CodeReviewGuideGenerationControl({
  autoStart = false,
  force = false,
  label = force ? "Regenerate" : "Generate guided review",
  onGenerationStart,
  snapshotId,
}: CodeReviewGuideGenerationControlProps) {
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const autoStarted = useRef(false);
  const mounted = useRef(true);
  const router = useRouter();

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const generateGuide = useCallback(async () => {
    setError(null);
    setIsGenerating(true);
    // Let the workspace begin polling (and optimistically show "preparing")
    // before the potentially long-running request resolves.
    onGenerationStart?.();

    try {
      const response = await fetch("/api/code-review-guides/generate", {
        body: JSON.stringify({ force, snapshotId }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const body = (await response.json()) as GenerationResponse;

      if (!mounted.current) {
        return;
      }

      if (!response.ok) {
        setError(body.error ?? "The guided review could not be generated.");
        return;
      }

      // When a polling owner is wired up it refreshes the workspace in place;
      // otherwise fall back to a server re-render.
      if (!onGenerationStart) {
        router.replace(`/review/${encodeURIComponent(snapshotId)}`);
        router.refresh();
      }
    } catch {
      if (mounted.current) {
        setError("The guided review generation route is unavailable.");
      }
    } finally {
      if (mounted.current) {
        setIsGenerating(false);
      }
    }
  }, [force, onGenerationStart, router, snapshotId]);

  useEffect(() => {
    if (!autoStart || autoStarted.current) {
      return;
    }

    autoStarted.current = true;
    void generateGuide();
  }, [autoStart, generateGuide]);

  return (
    <div className="grid gap-2">
      <Button disabled={isGenerating} onClick={() => void generateGuide()} size="sm" type="button" variant={force ? "secondary" : "primary"}>
        {force ? <RefreshCcw aria-hidden="true" className="size-3.5" /> : <Sparkles aria-hidden="true" className="size-3.5" />}
        {isGenerating ? "Generating" : label}
      </Button>
      {error ? <p className="text-xs leading-5 text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
