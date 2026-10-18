"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveProfile } from "@/app/actions/profile";
import { MacroLine } from "@/components/diary/macro-line";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatDayWithArticle } from "@/lib/nutrition/days";
import { formatDecimal, formatKcal, parseDecimal } from "@/lib/nutrition/format";
import {
  type ActivityLevel,
  ageOn,
  computeDailyTargets,
  type GoalType,
  type Sex,
} from "@/lib/nutrition/goals";
import { projectTargetWeight, targetWeightBounds } from "@/lib/nutrition/target-weight";

const activityOptions: { value: ActivityLevel; label: string }[] = [
  { value: "sedentary", label: "Sedentario: lavoro seduto, poco movimento" },
  { value: "light", label: "Leggero: sport 1-3 volte a settimana" },
  { value: "moderate", label: "Moderato: sport 3-5 volte a settimana" },
  { value: "active", label: "Attivo: sport 6-7 volte a settimana" },
  { value: "very_active", label: "Molto attivo: lavoro fisico o doppi allenamenti" },
];

const rateOptions = [0.25, 0.5, 0.75, 1];

export type ProfileFormValues = {
  sex: Sex | null;
  birthDate: string;
  heightCm: string;
  weightKg: string;
  activityLevel: ActivityLevel;
  goal: GoalType;
  weeklyRateKg: number;
  targetWeightKg: string;
  customized: boolean;
  kcal: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
};

export function ProfileForm({ initialValues, today }: { initialValues: ProfileFormValues; today: string }) {
  const [values, setValues] = useState(initialValues);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function update<Key extends keyof ProfileFormValues>(field: Key, value: ProfileFormValues[Key]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  const heightCm = parseDecimal(values.heightCm);
  const weightKg = parseDecimal(values.weightKg);
  const age = values.birthDate ? ageOn(values.birthDate, today) : null;
  const computed =
    values.sex && heightCm && weightKg && age !== null && age > 0
      ? computeDailyTargets({
          sex: values.sex,
          weightKg,
          heightCm,
          age,
          activityLevel: values.activityLevel,
          goal: values.goal,
          weeklyRateKg: values.weeklyRateKg,
        })
      : null;
  const targetWeightKg = values.targetWeightKg.trim() === "" ? null : parseDecimal(values.targetWeightKg);
  const targetProjection =
    values.goal !== "maintain" && weightKg && targetWeightKg
      ? projectTargetWeight({
          weights: [{ day: today, value: weightKg }],
          today,
          goal: values.goal,
          plannedWeeklyRateKg: values.weeklyRateKg,
          targetKg: targetWeightKg,
        })
      : null;

  function toggleCustomized(customized: boolean) {
    setValues((current) => ({
      ...current,
      customized,
      ...(customized && computed
        ? {
            kcal: current.kcal || String(computed.kcal),
            proteinG: current.proteinG || String(computed.proteinG),
            carbsG: current.carbsG || String(computed.carbsG),
            fatG: current.fatG || String(computed.fatG),
          }
        : {}),
    }));
  }

  function submit() {
    setErrorMessage(null);
    if (!values.sex || !values.birthDate || !heightCm || !weightKg) {
      setErrorMessage("Compila sesso, data di nascita, altezza e peso.");
      return;
    }
    const hasTargetWeight = values.goal !== "maintain" && values.targetWeightKg.trim() !== "";
    if (
      hasTargetWeight &&
      (targetWeightKg === null ||
        targetWeightKg < targetWeightBounds.minimum ||
        targetWeightKg > targetWeightBounds.maximum)
    ) {
      setErrorMessage("Peso obiettivo non valido.");
      return;
    }
    const customTargets = values.customized
      ? {
          kcal: Math.round(parseDecimal(values.kcal) ?? 0),
          proteinG: Math.round(parseDecimal(values.proteinG) ?? 0),
          carbsG: Math.round(parseDecimal(values.carbsG) ?? 0),
          fatG: Math.round(parseDecimal(values.fatG) ?? 0),
        }
      : null;
    startTransition(async () => {
      const result = await saveProfile({
        sex: values.sex!,
        birthDate: values.birthDate,
        heightCm,
        weightKg,
        activityLevel: values.activityLevel,
        goal: values.goal,
        weeklyRateKg: values.weeklyRateKg,
        targetWeightKg: hasTargetWeight ? targetWeightKg : null,
        customTargets,
      });
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      toast.success(`Obiettivo salvato: ${formatKcal(result.data.kcal)} kcal al giorno`);
    });
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Field>
        <FieldLabel id="profile-sex-label">Sesso</FieldLabel>
        <ToggleGroup
          variant="outline"
          spacing={0}
          value={values.sex ? [values.sex] : []}
          onValueChange={(selected) => {
            const [sex] = selected;
            if (sex === "male" || sex === "female") update("sex", sex);
          }}
          aria-labelledby="profile-sex-label"
          className="w-full"
        >
          <ToggleGroupItem value="female" className="flex-1">
            Donna
          </ToggleGroupItem>
          <ToggleGroupItem value="male" className="flex-1">
            Uomo
          </ToggleGroupItem>
        </ToggleGroup>
        <FieldDescription className="text-xs">Serve solo per la formula del metabolismo basale.</FieldDescription>
      </Field>

      <div className="grid grid-cols-3 gap-2">
        <Field className="col-span-3">
          <FieldLabel htmlFor="profile-birth-date">Data di nascita</FieldLabel>
          <Input
            id="profile-birth-date"
            type="date"
            max={today}
            value={values.birthDate}
            onChange={(event) => update("birthDate", event.target.value)}
          />
        </Field>
        <Field className="col-span-3 grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="profile-height">Altezza (cm)</FieldLabel>
            <Input
              id="profile-height"
              inputMode="decimal"
              value={values.heightCm}
              onChange={(event) => update("heightCm", event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="profile-weight">Peso attuale (kg)</FieldLabel>
            <Input
              id="profile-weight"
              inputMode="decimal"
              value={values.weightKg}
              onChange={(event) => update("weightKg", event.target.value)}
            />
          </div>
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor="profile-activity">Attività</FieldLabel>
        <select
          id="profile-activity"
          value={values.activityLevel}
          onChange={(event) => update("activityLevel", event.target.value as ActivityLevel)}
          className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        >
          {activityOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>

      <Field>
        <FieldLabel id="profile-goal-label">Obiettivo</FieldLabel>
        <ToggleGroup
          variant="outline"
          spacing={0}
          value={[values.goal]}
          onValueChange={(selected) => {
            const [goal] = selected;
            if (goal === "lose" || goal === "maintain" || goal === "gain") update("goal", goal);
          }}
          aria-labelledby="profile-goal-label"
          className="w-full"
        >
          <ToggleGroupItem value="lose" className="flex-1">
            Dimagrire
          </ToggleGroupItem>
          <ToggleGroupItem value="maintain" className="flex-1">
            Mantenere
          </ToggleGroupItem>
          <ToggleGroupItem value="gain" className="flex-1">
            Aumentare
          </ToggleGroupItem>
        </ToggleGroup>
      </Field>

      {values.goal !== "maintain" ? (
        <Field>
          <FieldLabel id="profile-rate-label">Ritmo a settimana</FieldLabel>
          <ToggleGroup
            variant="outline"
            spacing={0}
            value={[String(values.weeklyRateKg)]}
            onValueChange={(selected) => {
              const [rate] = selected;
              if (rate) update("weeklyRateKg", Number(rate));
            }}
            aria-labelledby="profile-rate-label"
            className="w-full"
          >
            {rateOptions.map((rate) => (
              <ToggleGroupItem key={rate} value={String(rate)} className="flex-1">
                {String(rate).replace(".", ",")} kg
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
      ) : null}

      {values.goal !== "maintain" ? (
        <Field>
          <FieldLabel htmlFor="profile-target-weight">Peso obiettivo (kg)</FieldLabel>
          <Input
            id="profile-target-weight"
            inputMode="decimal"
            value={values.targetWeightKg}
            onChange={(event) => update("targetWeightKg", event.target.value)}
          />
          <FieldDescription className="text-xs">
            Facoltativo: in Progressi vedi quanto ti manca e quando potresti arrivarci.
          </FieldDescription>
        </Field>
      ) : null}

      <section aria-label="Obiettivo giornaliero" className="rounded-2xl bg-card p-4 ring-1 ring-border">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Obiettivo giornaliero</p>
            <p className="font-heading text-3xl font-semibold tracking-tight">
              {values.customized
                ? formatKcal(parseDecimal(values.kcal) ?? 0)
                : computed
                  ? formatKcal(computed.kcal)
                  : "–"}{" "}
              <span className="text-sm font-medium text-muted-foreground">kcal</span>
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={values.customized} onCheckedChange={toggleCustomized} />
            Personalizza
          </label>
        </div>
        {values.customized ? (
          <div className="mt-3 grid grid-cols-4 gap-2">
            {(
              [
                ["kcal", "Kcal"],
                ["proteinG", "Proteine g"],
                ["carbsG", "Carbo g"],
                ["fatG", "Grassi g"],
              ] as const
            ).map(([field, label]) => (
              <Field key={field} className="gap-1.5">
                <FieldLabel htmlFor={`profile-${field}`} className="text-xs text-muted-foreground">
                  {label}
                </FieldLabel>
                <Input
                  id={`profile-${field}`}
                  inputMode="numeric"
                  value={values[field]}
                  onChange={(event) => update(field, event.target.value)}
                />
              </Field>
            ))}
          </div>
        ) : computed ? (
          <>
            <MacroLine
              className="mt-2"
              nutrients={{ kcal: computed.kcal, protein: computed.proteinG, carbs: computed.carbsG, fat: computed.fatG }}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Metabolismo basale {formatKcal(computed.basalMetabolicRate)} kcal, mantenimento{" "}
              {formatKcal(computed.maintenanceKcal)} kcal (formula Mifflin-St Jeor).
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Compila i tuoi dati per calcolarlo.</p>
        )}
        {targetProjection && targetWeightKg ? (
          <p className="mt-2 border-t pt-2 text-sm">
            <span className="text-muted-foreground">Peso obiettivo </span>
            <span className="font-medium">{formatDecimal(targetWeightKg)} kg</span>
            <span className="text-muted-foreground">
              {targetProjection.status === "projected"
                ? `, al ritmo scelto ci arrivi verso ${formatDayWithArticle(targetProjection.expectedDay, today)}`
                : targetProjection.status === "reached"
                  ? ", già raggiunto"
                  : ""}
            </span>
          </p>
        ) : null}
      </section>

      {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
      <Button type="submit" size="lg" disabled={isPending}>
        Salva obiettivo
      </Button>
    </form>
  );
}
