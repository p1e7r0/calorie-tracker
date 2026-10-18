"use client";

import { CopyPlusIcon, Trash2Icon } from "lucide-react";
import { type ReactNode, type PointerEvent, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const actionThreshold = 88;
const intentDistance = 10;
const restoreDelay = 4000;

type Intent = "none" | "horizontal" | "vertical";

export function SwipeableRow({
  children,
  onSwipeLeft,
  onSwipeRight,
  disabled = false,
}: {
  children: ReactNode;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  disabled?: boolean;
}) {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const gesture = useRef({ startX: 0, startY: 0, intent: "none" as Intent, suppressClick: false });

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (disabled || (event.pointerType === "mouse" && event.button !== 0)) return;
    gesture.current = { startX: event.clientX, startY: event.clientY, intent: "none", suppressClick: false };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (disabled || event.buttons === 0) return;
    const deltaX = event.clientX - gesture.current.startX;
    const deltaY = event.clientY - gesture.current.startY;
    if (gesture.current.intent === "none") {
      if (Math.abs(deltaX) > intentDistance && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
        gesture.current.intent = "horizontal";
        event.currentTarget.setPointerCapture(event.pointerId);
        setIsDragging(true);
      } else if (Math.abs(deltaY) > intentDistance) {
        gesture.current.intent = "vertical";
      }
    }
    if (gesture.current.intent === "horizontal") {
      const resisted = Math.sign(deltaX) * Math.min(Math.abs(deltaX), actionThreshold + (Math.abs(deltaX) - actionThreshold) / 4);
      setOffset(Math.abs(deltaX) > actionThreshold ? resisted : deltaX);
    }
  }

  function handlePointerEnd() {
    if (gesture.current.intent !== "horizontal") return;
    gesture.current.suppressClick = true;
    setIsDragging(false);
    if (offset <= -actionThreshold) {
      setOffset(-window.innerWidth);
      onSwipeLeft();
      window.setTimeout(() => setOffset(0), restoreDelay);
    } else {
      if (offset >= actionThreshold) onSwipeRight();
      setOffset(0);
    }
    gesture.current.intent = "none";
  }

  return (
    <div className="relative overflow-hidden rounded-lg">
      <div aria-hidden="true" className="absolute inset-0 flex items-center justify-between text-sm font-medium">
        <span
          className={cn(
            "flex h-full items-center gap-2 bg-secondary px-4 text-secondary-foreground transition-opacity",
            offset > 0 ? "opacity-100" : "opacity-0",
          )}
        >
          <CopyPlusIcon className="size-4" />
          Duplica
        </span>
        <span
          className={cn(
            "flex h-full items-center gap-2 bg-destructive-strong px-4 text-white transition-opacity",
            offset < 0 ? "opacity-100" : "opacity-0",
          )}
        >
          Elimina
          <Trash2Icon className="size-4" />
        </span>
      </div>
      <div
        className={cn("relative touch-pan-y bg-background", !isDragging && "transition-transform duration-200")}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onClickCapture={(event) => {
          if (!gesture.current.suppressClick) return;
          gesture.current.suppressClick = false;
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        {children}
      </div>
    </div>
  );
}
