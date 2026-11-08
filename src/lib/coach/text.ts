import type { CoachMessageKind } from "./input";

export const notificationMaximumLength = 140;

export type CoachText = { status: "skip" } | { status: "too-long"; text: string } | { status: "ok"; text: string };

export function cleanCoachText(raw: string, kind: CoachMessageKind): CoachText {
  const text = raw
    .trim()
    .replace(/^["«“]+|["»”]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text === "" || /^skip\.?$/i.test(text)) return { status: "skip" };
  if (kind === "notification" && text.length > notificationMaximumLength) return { status: "too-long", text };
  return { status: "ok", text };
}

export function shortenToLength(text: string, maximumLength = notificationMaximumLength) {
  if (text.length <= maximumLength) return text;
  const cut = text.slice(0, maximumLength - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maximumLength / 2 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.]+$/, "")}…`;
}

export const coachTitles: Record<CoachMessageKind, string> = {
  notification: "Il coach",
  weigh_in: "Il coach sulla pesata",
  weekly_report: "Il resoconto della settimana",
};
