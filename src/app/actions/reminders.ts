"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { database } from "@/db";
import { profile, pushSubscription } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { sendPushToUsers } from "@/server/push";
import type { ActionResult } from "./diary";

const subscriptionSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(5).max(100) }),
});

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof z.ZodError) return { ok: false, error: "Iscrizione alle notifiche non valida." };
  return { ok: false, error: error instanceof Error ? error.message : "Qualcosa non ha funzionato. Riprova." };
}

export async function savePushSubscription(input: unknown): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const subscription = subscriptionSchema.parse(input);
    await database
      .insert(pushSubscription)
      .values({ userId, endpoint: subscription.endpoint, ...subscription.keys })
      .onConflictDoUpdate({
        target: pushSubscription.endpoint,
        set: { userId, ...subscription.keys },
      });
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export async function removePushSubscription(endpoint: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await database
      .delete(pushSubscription)
      .where(and(eq(pushSubscription.userId, userId), eq(pushSubscription.endpoint, z.url().parse(endpoint))));
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

const settingsSchema = z.object({
  evening: z.boolean(),
  weighInWeekday: z.number().int().min(1).max(7).nullable(),
});

export async function saveReminderSettings(input: z.input<typeof settingsSchema>): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const settings = settingsSchema.parse(input);
    const values = { reminderEvening: settings.evening, reminderWeighInWeekday: settings.weighInWeekday };
    await database
      .insert(profile)
      .values({ userId, ...values })
      .onConflictDoUpdate({ target: profile.userId, set: values });
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export async function sendTestNotification(): Promise<ActionResult<{ sent: number }>> {
  try {
    const userId = await requireUserId();
    const result = await sendPushToUsers([userId], () => ({
      title: "Le notifiche funzionano",
      body: "Ti scriverò solo per i promemoria che hai scelto.",
      url: "/profile",
    }));
    if (result.sent === 0) throw new Error("Nessun dispositivo iscritto alle notifiche.");
    return { ok: true, data: { sent: result.sent } };
  } catch (error) {
    return failure(error);
  }
}
