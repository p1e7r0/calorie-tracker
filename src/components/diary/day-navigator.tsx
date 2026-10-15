"use client";

import { it } from "date-fns/locale";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addDays, formatDayLabel } from "@/lib/nutrition/days";

function dayHref(day: string, today: string) {
  return day === today ? "/" : `/?date=${day}`;
}

export function DayNavigator({ day, today }: { day: string; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const previousDay = addDays(day, -1);
  const nextDay = addDays(day, 1);

  return (
    <div className="flex items-center gap-1">
      <Link
        href={dayHref(previousDay, today)}
        aria-label="Giorno precedente"
        className={buttonVariants({ variant: "ghost", size: "icon" })}
      >
        <ChevronLeftIcon />
      </Link>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className="min-w-24 rounded-lg px-2 py-1.5 font-heading text-2xl font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label="Scegli il giorno"
        >
          {formatDayLabel(day, today)}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            locale={it}
            selected={new Date(`${day}T12:00:00`)}
            defaultMonth={new Date(`${day}T12:00:00`)}
            onSelect={(date) => {
              if (!date) return;
              const selectedDay = [
                date.getFullYear(),
                String(date.getMonth() + 1).padStart(2, "0"),
                String(date.getDate()).padStart(2, "0"),
              ].join("-");
              setOpen(false);
              router.push(dayHref(selectedDay, today));
            }}
          />
        </PopoverContent>
      </Popover>
      <Link
        href={dayHref(nextDay, today)}
        aria-label="Giorno successivo"
        className={buttonVariants({ variant: "ghost", size: "icon" })}
      >
        <ChevronRightIcon />
      </Link>
    </div>
  );
}
