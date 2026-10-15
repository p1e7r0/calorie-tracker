import { createAppIconResponse } from "@/components/brand/app-icon-image";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return createAppIconResponse(180, 16);
}
