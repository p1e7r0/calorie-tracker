import { and, asc, eq, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { database } from "@/db";
import { diaryEntry, food, measurement } from "@/db/schema";
import { auth } from "@/lib/auth/server";
import { toCsv } from "@/lib/csv";
import { mealLabels } from "@/lib/nutrition/meals";

const exports = {
  diary: async (userId: string) => {
    const rows = await database
      .select()
      .from(diaryEntry)
      .where(eq(diaryEntry.userId, userId))
      .orderBy(asc(diaryEntry.day), asc(diaryEntry.createdAt));
    return toCsv(
      ["Giorno", "Pasto", "Voce", "Grammi", "Porzioni", "Kcal", "Proteine (g)", "Carboidrati (g)", "Grassi (g)"],
      rows.map((row) => [
        row.day,
        mealLabels[row.meal],
        row.label,
        row.grams,
        row.servings,
        row.kcal,
        row.protein,
        row.carbs,
        row.fat,
      ]),
    );
  },
  measurements: async (userId: string) => {
    const rows = await database
      .select()
      .from(measurement)
      .where(eq(measurement.userId, userId))
      .orderBy(asc(measurement.measuredOn));
    return toCsv(
      [
        "Giorno",
        "Peso (kg)",
        "Massa grassa (%)",
        "Massa muscolare (%)",
        "Grasso viscerale",
        "Acqua (%)",
        "Massa ossea (kg)",
        "Vita (cm)",
        "Fianchi (cm)",
      ],
      rows.map((row) => [
        row.measuredOn,
        row.weightKg,
        row.bodyFatPercent,
        row.musclePercent,
        row.visceralFat,
        row.bodyWaterPercent,
        row.boneMassKg,
        row.waistCm,
        row.hipCm,
      ]),
    );
  },
  foods: async (userId: string) => {
    const rows = await database
      .select()
      .from(food)
      .where(and(eq(food.ownerId, userId), isNull(food.archivedAt)))
      .orderBy(asc(food.name));
    return toCsv(
      ["Nome", "Marca", "Unità", "Kcal per 100", "Proteine", "Carboidrati", "Zuccheri", "Grassi", "Saturi", "Fibre", "Sale"],
      rows.map((row) => [
        row.name,
        row.brand,
        row.unit,
        row.kcal,
        row.protein,
        row.carbs,
        row.sugars,
        row.fat,
        row.saturatedFat,
        row.fiber,
        row.salt,
      ]),
    );
  },
};

const fileNames = { diary: "diario", measurements: "misure", foods: "alimenti" } as const;

export async function GET(_request: NextRequest, { params }: RouteContext<"/api/export/[kind]">) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  const { kind } = await params;
  if (!(kind in exports)) return NextResponse.json({ error: "Esportazione sconosciuta" }, { status: 404 });
  const exportKind = kind as keyof typeof exports;
  const csv = await exports[exportKind](session.user.id);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bilancia-${fileNames[exportKind]}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
