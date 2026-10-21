import { z } from "zod";
import { authenticateApiToken } from "@/server/api-tokens";
import { AiError, isAiEnabled } from "@/server/ai";
import { logShortcutMeal, ShortcutError, undoLastShortcutMeal } from "@/server/shortcut-meal";

export const maxDuration = 60;

const bodySchema = z.object({ text: z.string().trim().min(3).max(500) });

function reply(message: string, status: number) {
  return Response.json(status === 401 ? { error: "Non autenticato", message } : { message }, { status });
}

async function authenticate(request: Request) {
  return authenticateApiToken(request.headers.get("authorization"));
}

const unauthenticatedMessage = "Il token non è valido. Creane uno nuovo in Bilancia, Profilo, Impostazioni.";

export async function POST(request: Request) {
  const userId = await authenticate(request);
  if (!userId) return reply(unauthenticatedMessage, 401);
  if (!isAiEnabled) return reply("Le funzioni AI di Bilancia non sono attive.", 503);

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return reply("Dimmi cosa hai mangiato.", 400);

  try {
    return Response.json(await logShortcutMeal(userId, body.data.text));
  } catch (error) {
    if (error instanceof ShortcutError || error instanceof AiError) return reply(error.message, 422);
    console.error(error);
    return reply("Bilancia non risponde. Riprova tra poco.", 502);
  }
}

export async function DELETE(request: Request) {
  const userId = await authenticate(request);
  if (!userId) return reply(unauthenticatedMessage, 401);
  try {
    return Response.json(await undoLastShortcutMeal(userId));
  } catch (error) {
    console.error(error);
    return reply("Bilancia non risponde. Riprova tra poco.", 502);
  }
}
