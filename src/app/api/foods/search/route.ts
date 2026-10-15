import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { searchFoods } from "@/server/foods";
import { listLoggableRecipes } from "@/server/recipes";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  const query = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 80);
  if (query.trim().length < 2) {
    return NextResponse.json({ foods: [], recipes: [] });
  }
  const [foods, recipes] = await Promise.all([
    searchFoods(session.user.id, query),
    listLoggableRecipes(session.user.id, query),
  ]);
  return NextResponse.json({ foods, recipes }, { headers: { "Cache-Control": "private, no-store" } });
}
