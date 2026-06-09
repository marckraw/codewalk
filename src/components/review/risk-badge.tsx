import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import type { ReviewGuideSection } from "./review-types";

interface RiskBadgeProps {
  section: Pick<ReviewGuideSection, "riskLevel" | "riskRationale">;
}

export function RiskBadge({ section }: RiskBadgeProps) {
  const risk = section.riskLevel;
  const rationale = section.riskRationale || `${risk} risk`;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label={`${risk} risk: ${rationale}`}
            className={cn(
              "h-auto shrink-0 cursor-help rounded border px-2 py-1 text-[10px] font-medium uppercase hover:bg-transparent",
              risk === "high" && "border-destructive/40 text-destructive",
              risk === "medium" && "border-amber-500/40 text-amber-600",
              risk === "low" && "border-emerald-500/40 text-emerald-600",
            )}
            size="sm"
            type="button"
            variant="ghost"
          >
            {risk} risk
          </Button>
        </TooltipTrigger>
        <TooltipContent align="end" className="max-w-72 text-xs" side="bottom">
          {rationale}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
