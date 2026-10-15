import { ImageResponse } from "next/og";

export function createAppIconResponse(size: number, padding = 0) {
  const markSize = size - padding * 2;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#15201b",
        }}
      >
        <svg width={markSize} height={markSize} viewBox="0 0 64 64">
          <path
            d="M14 41a18 18 0 0 1 36 0"
            fill="none"
            stroke="#a9d95b"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path d="M32 41 41 28" stroke="#f5f7f3" strokeWidth="4" strokeLinecap="round" />
          <circle cx="32" cy="41" r="4.5" fill="#f5f7f3" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
