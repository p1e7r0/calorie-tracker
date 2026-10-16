import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";

export function BackHeader({ title, backHref, actions }: { title: string; backHref: string; actions?: ReactNode }) {
  return (
    <header className="-mx-4 flex h-14 shrink-0 items-center gap-1 px-2">
      <Link href={backHref} aria-label="Indietro" className={buttonVariants({ variant: "ghost", size: "icon" })}>
        <ArrowLeftIcon />
      </Link>
      <h1 className="min-w-0 flex-1 truncate font-heading text-lg font-semibold tracking-tight">{title}</h1>
      {actions ? <div className="flex items-center gap-1">{actions}</div> : null}
    </header>
  );
}
