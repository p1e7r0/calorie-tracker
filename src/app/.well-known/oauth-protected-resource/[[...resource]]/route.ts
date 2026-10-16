import { auth } from "@/lib/auth/server";

export function GET(request: Request) {
  return auth.handler(request);
}
