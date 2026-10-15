import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { searchOpenFoodFacts } from "@/server/open-food-facts";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (query.length < 2) return NextResponse.json({ products: [] });
  try {
    const products = await searchOpenFoodFacts(query);
    return NextResponse.json({ products }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Open Food Facts non risponde." }, { status: 502 });
  }
}
