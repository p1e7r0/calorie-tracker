import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function ScreenBody({ className, ...properties }: ComponentProps<"div">) {
  return (
    <div
      data-slot="screen-body"
      className={cn("-mx-4 min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 pb-6", className)}
      {...properties}
    />
  );
}

export function ScreenFooter({
  className,
  coversSafeArea = true,
  ...properties
}: ComponentProps<"div"> & { coversSafeArea?: boolean }) {
  return (
    <div
      data-slot="screen-footer"
      className={cn("-mx-4 shrink-0 border-t bg-background px-4 pt-2", coversSafeArea ? "pb-safe-or-3" : "pb-2", className)}
      {...properties}
    />
  );
}
