import "server-only";
import { inArray } from "drizzle-orm";
import webPush from "web-push";
import { database } from "@/db";
import { pushSubscription } from "@/db/schema";
import type { PushMessage } from "@/lib/reminders";

export const isPushEnabled = Boolean(
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT,
);

let configured = false;

function configure() {
  if (configured) return;
  webPush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

export async function sendPushToUsers(userIds: readonly string[], messageFor: (userId: string) => PushMessage | null) {
  if (!isPushEnabled || userIds.length === 0) return { sent: 0, removed: 0 };
  configure();
  const subscriptions = await database
    .select()
    .from(pushSubscription)
    .where(inArray(pushSubscription.userId, [...userIds]));
  let sent = 0;
  const expired: string[] = [];
  await Promise.all(
    subscriptions.map(async (subscription) => {
      const message = messageFor(subscription.userId);
      if (!message) return;
      try {
        await webPush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          JSON.stringify(message),
          { TTL: 60 * 60 * 4, urgency: "normal" },
        );
        sent += 1;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) expired.push(subscription.id);
        else console.error("Push delivery failed", statusCode);
      }
    }),
  );
  if (expired.length > 0) {
    await database.delete(pushSubscription).where(inArray(pushSubscription.id, expired));
  }
  return { sent, removed: expired.length };
}
