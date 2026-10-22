"use client";

import { ChevronRightIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { CookwareView } from "@/lib/nutrition/cookware";
import { formatGrams } from "@/lib/nutrition/format";
import { CookwareDrawer } from "./cookware-drawer";

export function CookwareSettings({ cookware }: { cookware: CookwareView[] }) {
  const [editing, setEditing] = useState<{ cookware?: CookwareView } | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Salva il peso delle pentole vuote: a fine cottura pesi tutta la pentola e Bilancia toglie la tara dal peso da
        cotto della ricetta.
      </p>
      {cookware.length > 0 ? (
        <ul className="divide-y rounded-2xl ring-1 ring-border">
          {cookware.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left"
                aria-label={`Modifica ${item.name}`}
                onClick={() => setEditing({ cookware: item })}
              >
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                <span className="text-sm text-muted-foreground">{formatGrams(item.weightG)} g</span>
                <ChevronRightIcon className="size-4 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Button variant="outline" className="self-start" onClick={() => setEditing({})}>
        <PlusIcon />
        Aggiungi pentola
      </Button>
      {editing ? (
        <CookwareDrawer
          cookware={editing.cookware}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}
