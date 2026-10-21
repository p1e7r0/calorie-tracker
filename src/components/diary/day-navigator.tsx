"use client";

import { it } from "date-fns/locale";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addDays, formatDayLabel, formatLongDay } from "@/lib/nutrition/days";
import { loggedDayClassName, toIsoDate, toLocalDate } from "./calendar-days";

function dayHref(day: string, today: string) {
  return day === today ? "/" : `/?date=${day}`;
}

export function DayNavigator({ day, today, loggedDays }: { day: string; today: string; loggedDays: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const previousDay = addDays(day, -1);
  const nextDay = addDays(day, 1);
  const label = formatDayLabel(day, today);
  const isRelativeLabel = label === "Oggi" || label === "Ieri" || label === "Domani";

  return (
    <div className="flex w-full items-center justify-between gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className="-ml-2 flex min-w-0 flex-col items-start rounded-lg px-2 py-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label={`Scegli il giorno, ${formatLongDay(day)}`}
        >
          <span className="flex items-center gap-1 font-heading text-2xl leading-tight font-semibold tracking-tight">
            {isRelativeLabel ? label : formatLongDay(day)}
            <ChevronDownIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          </span>
          {isRelativeLabel ? (
            <span className="text-sm text-muted-foreground">{formatLongDay(day)}</span>
          ) : null}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            locale={it}
            selected={toLocalDate(day)}
            defaultMonth={toLocalDate(day)}
            disabled={{ after: toLocalDate(today) }}
            endMonth={toLocalDate(today)}
            modifiers={{ logged: loggedDays.map(toLocalDate) }}
            modifiersClassNames={{ logged: loggedDayClassName }}
            onSelect={(date) => {
              if (!date) return;
              setOpen(false);
              router.push(dayHref(toIsoDate(date), today));
            }}
          />
          <p className="flex items-center gap-1.5 border-t px-3 py-2 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-energy" aria-hidden="true" />
            Giorni con qualcosa registrato
          </p>
        </PopoverContent>
      </Popover>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href={dayHref(previousDay, today)}
          aria-label="Giorno precedente"
          className={buttonVariants({ variant: "ghost", size: "icon", className: "touch-target" })}
        >
          <ChevronLeftIcon />
        </Link>
        {day < today ? (
          <Link
            href={dayHref(nextDay, today)}
            aria-label="Giorno successivo"
            className={buttonVariants({ variant: "ghost", size: "icon", className: "touch-target" })}
          >
            <ChevronRightIcon />
          </Link>
        ) : (
          <Button variant="ghost" size="icon" className="touch-target" aria-label="Giorno successivo" disabled>
            <ChevronRightIcon />
          </Button>
        )}
      </div>
    </div>
  );
}
