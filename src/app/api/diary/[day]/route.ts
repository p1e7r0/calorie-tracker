import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { isIsoDate } from "@/lib/nutrition/days";
import { getDiaryDay } from "@/server/diary";

export async function GET(_request: NextRequest, { params }: RouteContext<"/api/diary/[day]">) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  const { day } = await params;
  if (!isIsoDate(day)) return NextResponse.json({ error: "Data non valida" }, { status: 400 });
  const diary = await getDiaryDay(session.user.id, day);
  return NextResponse.json({ meals: diary.meals }, { headers: { "Cache-Control": "private, no-store" } });
}
