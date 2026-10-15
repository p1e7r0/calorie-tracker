import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bilancia",
    short_name: "Bilancia",
    description: "Conta le calorie in pochi tocchi.",
    lang: "it",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#111916",
    theme_color: "#111916",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
