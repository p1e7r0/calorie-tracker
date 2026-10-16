"use client";

import { ChartLineIcon, CircleUserRoundIcon, PlusIcon, SunIcon, UtensilsIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const destinations = [
  { href: "/", label: "Oggi", icon: SunIcon },
  { href: "/food", label: "Cibo", icon: UtensilsIcon },
  { href: "/progress", label: "Progressi", icon: ChartLineIcon },
  { href: "/profile", label: "Profilo", icon: CircleUserRoundIcon },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function BottomNavigation() {
  const pathname = usePathname();
  const [today, food, progress, profile] = destinations;

  return (
    <nav
      aria-label="Navigazione principale"
      className="shrink-0 border-t bg-background pb-safe in-data-keyboard-open:hidden [.app-viewport:has([data-slot=screen-footer])_&]:border-t-transparent"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-2">
        <NavigationLink destination={today} active={isActive(pathname, today.href)} />
        <NavigationLink destination={food} active={isActive(pathname, food.href)} />
        <div className="flex justify-center">
          <Link
            href="/add"
            aria-label="Aggiungi cibo"
            className="flex size-12 items-center justify-center rounded-full bg-energy text-energy-foreground shadow-sm transition-transform outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
          >
            <PlusIcon className="size-6" strokeWidth={2.5} />
          </Link>
        </div>
        <NavigationLink destination={progress} active={isActive(pathname, progress.href)} />
        <NavigationLink destination={profile} active={isActive(pathname, profile.href)} />
      </div>
    </nav>
  );
}

function NavigationLink({
  destination,
  active,
}: {
  destination: (typeof destinations)[number];
  active: boolean;
}) {
  const Icon = destination.icon;
  return (
    <Link
      href={destination.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-lg py-1 text-[0.7rem] font-medium text-muted-foreground transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        active && "text-foreground",
      )}
    >
      <Icon className="size-5" strokeWidth={active ? 2.4 : 1.8} />
      {destination.label}
    </Link>
  );
}
