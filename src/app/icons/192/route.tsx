import { createAppIconResponse } from "@/components/brand/app-icon-image";

export function GET() {
  return createAppIconResponse(192);
}
