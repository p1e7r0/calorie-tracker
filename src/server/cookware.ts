import "server-only";
import { and, asc, count, eq } from "drizzle-orm";
import { z } from "zod";
import { database } from "@/db";
import { cookware } from "@/db/schema";
import type { CookwareView } from "@/lib/nutrition/cookware";

export const maximumCookwareCount = 50;

export const cookwareInputSchema = z.object({
  name: z.string().trim().min(1, "Dai un nome alla pentola.").max(80, "Usa un nome più corto."),
  weightG: z
    .number("Scrivi il peso della pentola vuota.")
    .positive("Il peso della pentola deve essere maggiore di zero.")
    .max(20_000, "Il peso della pentola non può superare 20 kg."),
});

export type CookwareInput = z.input<typeof cookwareInputSchema>;

const cookwareColumns = { id: cookware.id, name: cookware.name, weightG: cookware.weightG };

export async function listCookware(userId: string): Promise<CookwareView[]> {
  return database.select(cookwareColumns).from(cookware).where(eq(cookware.userId, userId)).orderBy(asc(cookware.createdAt));
}

export async function getCookware(userId: string, cookwareId: string): Promise<CookwareView | null> {
  const [found] = await database
    .select(cookwareColumns)
    .from(cookware)
    .where(and(eq(cookware.id, z.uuid().parse(cookwareId)), eq(cookware.userId, userId)));
  return found ?? null;
}

export async function insertCookware(userId: string, input: CookwareInput): Promise<CookwareView> {
  const values = cookwareInputSchema.parse(input);
  const [{ value: existing }] = await database.select({ value: count() }).from(cookware).where(eq(cookware.userId, userId));
  if (existing >= maximumCookwareCount) throw new Error(`Puoi salvare al massimo ${maximumCookwareCount} pentole.`);
  const [created] = await database
    .insert(cookware)
    .values({ userId, ...values })
    .returning(cookwareColumns);
  return created;
}

export async function editCookware(userId: string, cookwareId: string, input: CookwareInput): Promise<CookwareView> {
  const values = cookwareInputSchema.parse(input);
  const [updated] = await database
    .update(cookware)
    .set(values)
    .where(and(eq(cookware.id, z.uuid().parse(cookwareId)), eq(cookware.userId, userId)))
    .returning(cookwareColumns);
  if (!updated) throw new Error("Pentola non trovata.");
  return updated;
}

export async function removeCookware(userId: string, cookwareId: string): Promise<CookwareView> {
  const [deleted] = await database
    .delete(cookware)
    .where(and(eq(cookware.id, z.uuid().parse(cookwareId)), eq(cookware.userId, userId)))
    .returning(cookwareColumns);
  if (!deleted) throw new Error("Pentola non trovata.");
  return deleted;
}
