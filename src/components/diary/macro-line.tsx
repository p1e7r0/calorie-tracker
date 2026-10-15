import { formatGrams } from "@/lib/nutrition/format";
import type { Nutrients } from "@/lib/nutrition/nutrients";
import { cn } from "@/lib/utils";

const macroItems = [
  { key: "protein", short: "P", label: "Proteine", colorClass: "bg-protein" },
  { key: "carbs", short: "C", label: "Carboidrati", colorClass: "bg-carbs" },
  { key: "fat", short: "G", label: "Grassi", colorClass: "bg-fat" },
] as const;

export function MacroLine({ nutrients, className }: { nutrients: Nutrients; className?: string }) {
  return (
    <div className={cn("flex gap-3 text-xs text-muted-foreground", className)}>
      {macroItems.map((macro) => (
        <span key={macro.key} className="flex items-center gap-1" title={macro.label}>
          <span className={cn("size-1.5 rounded-full", macro.colorClass)} aria-hidden="true" />
          <span className="sr-only">{macro.label}</span>
          <span aria-hidden="true">{macro.short}</span>
          <span className="font-medium text-foreground">{formatGrams(nutrients[macro.key])}</span>
        </span>
      ))}
    </div>
  );
}
