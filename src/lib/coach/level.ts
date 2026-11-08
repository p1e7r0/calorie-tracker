export const coachLevels = ["normal", "fierce", "jackpot", "silence"] as const;
export type CoachLevel = (typeof coachLevels)[number];

export const coachLevelLabels: Record<CoachLevel, string> = {
  normal: "normale",
  fierce: "feroce",
  jackpot: "jackpot",
  silence: "silenzio",
};

export type LevelProbabilities = { fierce: number; jackpot: number; silence: number };

export const defaultLevelProbabilities: LevelProbabilities = { fierce: 0.2, jackpot: 0.05, silence: 0.1 };

function parseProbability(value: string | undefined, fallback: number) {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
}

export function levelProbabilitiesFromEnvironment(environment: Record<string, string | undefined>): LevelProbabilities {
  const probabilities = {
    fierce: parseProbability(environment.COACH_PROBABILITY_FIERCE, defaultLevelProbabilities.fierce),
    jackpot: parseProbability(environment.COACH_PROBABILITY_JACKPOT, defaultLevelProbabilities.jackpot),
    silence: parseProbability(environment.COACH_PROBABILITY_SILENCE, defaultLevelProbabilities.silence),
  };
  const total = probabilities.fierce + probabilities.jackpot + probabilities.silence;
  return total <= 1 ? probabilities : defaultLevelProbabilities;
}

export function drawLevel(probabilities: LevelProbabilities, random: number): CoachLevel {
  if (random < probabilities.jackpot) return "jackpot";
  if (random < probabilities.jackpot + probabilities.fierce) return "fierce";
  if (random < probabilities.jackpot + probabilities.fierce + probabilities.silence) return "silence";
  return "normal";
}

export const coachEventKinds = ["overshoot", "streak_broken", "streak_milestone", "recharge_unlocked"] as const;
export type CoachEventKind = (typeof coachEventKinds)[number];
export type CoachEvent = { kind: CoachEventKind; key: string };

export function resolveLevel({
  drawn,
  events,
  allowSilence,
}: {
  drawn: CoachLevel;
  events: readonly CoachEvent[];
  allowSilence: boolean;
}): CoachLevel {
  const kinds = new Set(events.map((event) => event.kind));
  if (kinds.has("overshoot") || kinds.has("streak_broken")) return "fierce";
  if (kinds.has("recharge_unlocked") || kinds.has("streak_milestone")) return "jackpot";
  if (drawn === "silence" && !allowSilence) return "normal";
  return drawn;
}
