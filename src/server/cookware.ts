import "server-only";
import { asc, eq } from "drizzle-orm";
import { database } from "@/db";
import { cookware } from "@/db/schema";
import type { CookwareView } from "@/lib/nutrition/cookware";

export async function listCookware(userId: string): Promise<CookwareView[]> {
  return database
    .select({ id: cookware.id, name: cookware.name, weightG: cookware.weightG })
    .from(cookware)
    .where(eq(cookware.userId, userId))
    .orderBy(asc(cookware.createdAt));
}
