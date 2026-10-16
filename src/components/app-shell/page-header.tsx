import type { ReactNode } from "react";

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">{title}</h1>
      {actions ? <div className="flex items-center gap-1">{actions}</div> : null}
    </header>
  );
}
