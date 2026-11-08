import { type NextRequest, NextResponse } from "next/server";
import { type CoachSlot, coachSlots, runCoachSlot } from "@/server/coach";
import { isAuthorizedCronRequest } from "@/server/cron";

function isCoachSlot(value: string): value is CoachSlot {
  return (coachSlots as readonly string[]).includes(value);
}

export async function GET(request: NextRequest, { params }: RouteContext<"/api/cron/coach/[slot]">) {
  if (!isAuthorizedCronRequest(request)) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const { slot } = await params;
  if (!isCoachSlot(slot)) return NextResponse.json({ error: "Fascia sconosciuta" }, { status: 404 });
  return NextResponse.json(await runCoachSlot(slot));
}
