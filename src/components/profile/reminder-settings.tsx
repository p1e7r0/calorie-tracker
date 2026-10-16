"use client";

import { BellIcon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  removePushSubscription,
  savePushSubscription,
  saveReminderSettings,
  sendTestNotification,
} from "@/app/actions/reminders";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { weekdays } from "@/lib/reminders";

type DeviceStatus = "checking" | "unsupported" | "denied" | "subscribed" | "not-subscribed";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function applicationServerKey(base64: string) {
  const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

const subscribeTimeout = 15_000;

function withTimeout<T>(promise: Promise<T>) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Il servizio di notifiche non risponde. Riprova più tardi.")), subscribeTimeout),
    ),
  ]);
}

function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function currentSubscription() {
  const registration = await navigator.serviceWorker.getRegistration("/");
  return registration ? registration.pushManager.getSubscription() : null;
}

export function ReminderSettings({
  initialEvening,
  initialWeighInWeekday,
}: {
  initialEvening: boolean;
  initialWeighInWeekday: number | null;
}) {
  const [evening, setEvening] = useState(initialEvening);
  const [weighInWeekday, setWeighInWeekday] = useState<number | null>(initialWeighInWeekday);
  const [status, setStatus] = useState<DeviceStatus>("checking");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isPushSupported()) {
      queueMicrotask(() => setStatus("unsupported"));
      return;
    }
    currentSubscription()
      .then((subscription) => {
        if (subscription) setStatus("subscribed");
        else setStatus(Notification.permission === "denied" ? "denied" : "not-subscribed");
      })
      .catch(() => setStatus("not-subscribed"));
  }, []);

  async function subscribeThisDevice() {
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setStatus(permission === "denied" ? "denied" : "not-subscribed");
      throw new Error("Senza il permesso per le notifiche non posso mandarti i promemoria.");
    }
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await withTimeout(
        registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(publicKey),
        }),
      ));
    const result = await savePushSubscription(subscription.toJSON());
    if (!result.ok) throw new Error(result.error);
    setStatus("subscribed");
  }

  function save(next: { evening: boolean; weighInWeekday: number | null }) {
    const previous = { evening, weighInWeekday };
    setEvening(next.evening);
    setWeighInWeekday(next.weighInWeekday);
    startTransition(async () => {
      try {
        const wantsReminders = next.evening || next.weighInWeekday !== null;
        if (wantsReminders && status !== "subscribed") await subscribeThisDevice();
        const result = await saveReminderSettings(next);
        if (!result.ok) throw new Error(result.error);
        toast.success(wantsReminders ? "Promemoria salvati" : "Promemoria disattivati");
      } catch (error) {
        setEvening(previous.evening);
        setWeighInWeekday(previous.weighInWeekday);
        toast.error(
          error instanceof Error && !(error instanceof DOMException)
            ? error.message
            : "Questo browser non ha accettato le notifiche. Riprova dall'app installata sulla schermata Home.",
        );
      }
    });
  }

  function unsubscribeThisDevice() {
    startTransition(async () => {
      const subscription = await currentSubscription();
      if (subscription) {
        await removePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setStatus("not-subscribed");
      toast.success("Notifiche disattivate su questo dispositivo");
    });
  }

  function sendTest() {
    startTransition(async () => {
      const result = await sendTestNotification();
      if (!result.ok) toast.error(result.error);
    });
  }

  if (status === "unsupported") {
    return (
      <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
        Questo browser non riceve notifiche. Su iPhone apri Bilancia in Safari, tocca Condividi e poi «Aggiungi alla
        schermata Home»: dall&apos;app installata potrai attivare i promemoria.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>
          <span className="block font-medium">La sera, se mancano dei pasti</span>
          <span className="block text-muted-foreground">Verso le 21, solo se oggi non hai registrato la cena</span>
        </span>
        <Switch
          checked={evening}
          disabled={isPending || status === "checking"}
          onCheckedChange={(checked) => save({ evening: checked, weighInWeekday })}
        />
      </label>
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>
          <span className="block font-medium">Pesata settimanale</span>
          <span className="block text-muted-foreground">Verso le 8 del giorno scelto</span>
        </span>
        <select
          aria-label="Giorno della pesata"
          value={weighInWeekday ?? ""}
          disabled={isPending || status === "checking"}
          onChange={(event) =>
            save({ evening, weighInWeekday: event.target.value ? Number(event.target.value) : null })
          }
          className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          <option value="">Mai</option>
          {weekdays.map((weekday) => (
            <option key={weekday.value} value={weekday.value}>
              {weekday.label}
            </option>
          ))}
        </select>
      </label>
      {status === "denied" ? (
        <p className="text-sm text-muted-foreground">
          Le notifiche sono bloccate per Bilancia: riattivale dalle impostazioni del browser o del telefono.
        </p>
      ) : null}
      {status === "subscribed" ? (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={isPending} onClick={sendTest}>
            <BellIcon />
            Invia una prova
          </Button>
          <Button variant="ghost" size="sm" disabled={isPending} onClick={unsubscribeThisDevice}>
            Disattiva su questo dispositivo
          </Button>
        </div>
      ) : null}
    </div>
  );
}
