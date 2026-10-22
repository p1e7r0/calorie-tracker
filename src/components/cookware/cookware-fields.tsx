"use client";

import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export type CookwareFieldValues = { name: string; weight: string };

export function CookwareFields({
  idPrefix,
  values,
  autoFocus,
  onChange,
}: {
  idPrefix: string;
  values: CookwareFieldValues;
  autoFocus?: boolean;
  onChange: (values: CookwareFieldValues) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_8rem] gap-3">
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-name`}>Nome</FieldLabel>
        <Input
          id={`${idPrefix}-name`}
          placeholder="Padella grande"
          autoFocus={autoFocus}
          value={values.name}
          onChange={(event) => onChange({ ...values, name: event.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-weight`}>Peso vuota</FieldLabel>
        <div className="relative">
          <Input
            id={`${idPrefix}-weight`}
            inputMode="decimal"
            className="pr-7"
            value={values.weight}
            onChange={(event) => onChange({ ...values, weight: event.target.value })}
          />
          <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-muted-foreground">
            g
          </span>
        </div>
      </Field>
    </div>
  );
}
