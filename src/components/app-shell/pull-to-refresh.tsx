"use client";

import { useRouter } from "next/navigation";
import { type CSSProperties, type ReactNode, useEffect, useEffectEvent, useRef, useState, useTransition } from "react";
import {
  blocksVerticalPan,
  type PullIntent,
  pullDistance,
  pullHoldOffset,
  pullIntent,
  pullMinimumRefreshDuration,
  pullRefreshThreshold,
  spinnerTickCount,
  visibleSpinnerTicks,
} from "@/lib/pull-to-refresh";
import { cn } from "@/lib/utils";

const spinnerSize = 28;
const settleTransition = "transform 350ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 350ms ease";
const clickSuppressionWindow = 400;

function canStartPull(target: EventTarget | null, container: HTMLElement) {
  if (!(target instanceof Element) || !container.contains(target)) return false;
  const dialog = target.closest('[role="dialog"], [role="alertdialog"]');
  if (dialog && container.contains(dialog)) return false;
  for (let element: Element | null = target; element; element = element.parentElement) {
    if (element.scrollTop > 0) return false;
    if (blocksVerticalPan(getComputedStyle(element).touchAction)) return false;
    if (element === container) break;
  }
  return true;
}

function useRouteRefresh() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const waiters = useRef<Array<() => void>>([]);

  useEffect(() => {
    if (isPending) return;
    for (const resolve of waiters.current.splice(0)) resolve();
  }, [isPending]);

  return () =>
    new Promise<void>((resolve) => {
      waiters.current.push(resolve);
      startTransition(() => router.refresh());
    });
}

export function PullToRefresh({ children, className }: { children: ReactNode; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gesture = useRef({
    startX: 0,
    startY: 0,
    originY: 0,
    intent: "ignore" as PullIntent,
    touching: false,
    refreshed: false,
  });
  const isRefreshingRef = useRef(false);
  const [offset, setOffset] = useState(0);
  const [ticks, setTicks] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const refreshRoute = useRouteRefresh();

  const startRefresh = useEffectEvent(async () => {
    isRefreshingRef.current = true;
    setIsRefreshing(true);
    setTicks(spinnerTickCount);
    setAnnouncement("Aggiornamento in corso");
    await Promise.all([
      Promise.allSettled([refreshRoute()]),
      new Promise((resolve) => window.setTimeout(resolve, pullMinimumRefreshDuration)),
    ]);
    isRefreshingRef.current = false;
    setIsRefreshing(false);
    setAnnouncement("Contenuto aggiornato");
    if (!(gesture.current.touching && gesture.current.intent === "pull")) setOffset(0);
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const container: HTMLDivElement = containerRef.current;

    function suppressNextClick() {
      const swallow = (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
      };
      container.addEventListener("click", swallow, { capture: true, once: true });
      window.setTimeout(() => container.removeEventListener("click", swallow, { capture: true }), clickSuppressionWindow);
    }

    function handleTouchStart(event: TouchEvent) {
      const touch = event.touches[0];
      const eligible = event.touches.length === 1 && !isRefreshingRef.current && canStartPull(event.target, container);
      gesture.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        originY: touch.clientY,
        intent: eligible ? "pending" : "ignore",
        touching: true,
        refreshed: false,
      };
    }

    function handleTouchMove(event: TouchEvent) {
      const current = gesture.current;
      if (current.intent === "ignore") return;
      if (event.touches.length > 1) {
        current.intent = "ignore";
        return;
      }
      const touch = event.touches[0];
      const deltaX = touch.clientX - current.startX;
      const deltaY = touch.clientY - current.startY;
      if (current.intent === "pending") {
        const intent = pullIntent(deltaX, deltaY);
        if (intent === "pending") {
          if (deltaY > 0 && deltaY >= Math.abs(deltaX) && event.cancelable) event.preventDefault();
          return;
        }
        current.intent = intent;
        if (intent === "ignore") return;
        current.originY = touch.clientY;
        setTicks(0);
        setIsDragging(true);
      }
      if (event.cancelable) event.preventDefault();
      const distance = pullDistance(touch.clientY - current.originY);
      setOffset(distance);
      if (current.refreshed) return;
      if (distance >= pullRefreshThreshold) {
        current.refreshed = true;
        void startRefresh();
      } else setTicks(visibleSpinnerTicks(distance));
    }

    function handleTouchEnd(event: TouchEvent) {
      if (event.touches.length > 0) return;
      const current = gesture.current;
      current.touching = false;
      if (current.intent !== "pull") return;
      current.intent = "ignore";
      setIsDragging(false);
      setOffset(isRefreshingRef.current ? pullHoldOffset : 0);
      suppressNextClick();
    }

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd);
    container.addEventListener("touchcancel", handleTouchEnd);
    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, []);

  const transition = isDragging ? "none" : settleTransition;
  const indicatorStyle: CSSProperties = {
    transform: `translateY(${offset / 2 - spinnerSize / 2}px)`,
    opacity: offset > 0 && (isDragging || isRefreshing) ? 1 : 0,
    transition,
  };
  const contentStyle: CSSProperties = { transform: offset > 0 ? `translateY(${offset}px)` : "none", transition };

  return (
    <div ref={containerRef} className={cn("relative flex min-h-0 flex-1 flex-col overflow-y-clip", className)}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 flex justify-center" style={indicatorStyle}>
        <Spinner ticks={ticks} spinning={isRefreshing} />
      </div>
      <div data-slot="pull-to-refresh-content" className="flex min-h-0 flex-1 flex-col" style={contentStyle}>
        {children}
      </div>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}

function Spinner({ ticks, spinning }: { ticks: number; spinning: boolean }) {
  return (
    <span className={cn("relative block size-7", spinning && "animate-pull-to-refresh")}>
      {Array.from({ length: spinnerTickCount }, (_, index) => (
        <span
          key={index}
          className="absolute top-0 left-[calc(50%-1.25px)] h-2 w-[2.5px] origin-[50%_14px] rounded-full bg-muted-foreground"
          style={{
            transform: `rotate(${index * (360 / spinnerTickCount)}deg)`,
            opacity:
              index >= ticks ? 0 : spinning ? 1 - (((spinnerTickCount - index) % spinnerTickCount) / spinnerTickCount) * 0.85 : 1,
          }}
        />
      ))}
    </span>
  );
}
