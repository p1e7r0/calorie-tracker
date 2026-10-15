export type Sex = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type GoalType = "lose" | "maintain" | "gain";

export const activityFactors: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const kcalPerKilogramOfBodyWeight = 7700;
const minimumDailyKcal: Record<Sex, number> = { male: 1500, female: 1200 };

export function ageOn(birthDate: string, today: string) {
  const [birthYear, birthMonth, birthDay] = birthDate.split("-").map(Number);
  const [year, month, day] = today.split("-").map(Number);
  const hadBirthday = month > birthMonth || (month === birthMonth && day >= birthDay);
  return year - birthYear - (hadBirthday ? 0 : 1);
}

export function basalMetabolicRate({
  sex,
  weightKg,
  heightCm,
  age,
}: {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
}) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === "male" ? base + 5 : base - 161;
}

export type DailyTargets = {
  basalMetabolicRate: number;
  maintenanceKcal: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export function computeDailyTargets({
  sex,
  weightKg,
  heightCm,
  age,
  activityLevel,
  goal,
  weeklyRateKg,
}: {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
  activityLevel: ActivityLevel;
  goal: GoalType;
  weeklyRateKg: number;
}): DailyTargets {
  const bmr = basalMetabolicRate({ sex, weightKg, heightCm, age });
  const maintenanceKcal = bmr * activityFactors[activityLevel];
  const dailyAdjustment = (Math.abs(weeklyRateKg) * kcalPerKilogramOfBodyWeight) / 7;
  const adjustedKcal =
    goal === "lose"
      ? maintenanceKcal - dailyAdjustment
      : goal === "gain"
        ? maintenanceKcal + dailyAdjustment
        : maintenanceKcal;
  const kcal = roundTo(Math.max(adjustedKcal, minimumDailyKcal[sex]), 10);

  const proteinPerKilogram = goal === "lose" ? 2 : 1.8;
  const proteinG = Math.round(weightKg * proteinPerKilogram);
  const fatG = Math.round((kcal * 0.25) / 9);
  const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));

  return {
    basalMetabolicRate: Math.round(bmr),
    maintenanceKcal: Math.round(maintenanceKcal),
    kcal,
    proteinG,
    carbsG,
    fatG,
  };
}

function roundTo(value: number, step: number) {
  return Math.round(value / step) * step;
}
