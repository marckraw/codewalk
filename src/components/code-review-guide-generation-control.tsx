"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type CodeReviewGuideGenerationControlProps = {
  autoStart?: boolean;
  force?: boolean;
  label?: string;
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
  snapshotId,
}: CodeReviewGuideGenerationControlProps) {
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const autoStarted = useRef(false);
  const router = useRouter();

  const generateGuide = useCallback(async () => {
    setError(null);
    setIsGenerating(true);

    try {
      const response = await fetch("/api/code-review-guides/generate", {
        body: JSON.stringify({ force, snapshotId }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const body = (await response.json()) as GenerationResponse;

      if (!response.ok) {
        setError(body.error ?? "The guided review could not be generated.");
        return;
      }

      router.replace(`/review/${encodeURIComponent(snapshotId)}`);
      router.refresh();
    } catch {
      setError("The guided review generation route is unavailable.");
    } finally {
      setIsGenerating(false);
    }
  }, [force, router, snapshotId]);

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
