import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#0a0a0a",
    display: "standalone",
    icons: [
      { sizes: "192x192", src: "/icon", type: "image/png" },
      { sizes: "512x512", src: "/icon1", type: "image/png" },
    ],
    name: "RextFlex Ai",
    short_name: "RextFlex Ai",
    start_url: "/",
    theme_color: "#0a0a0a",
  };
}
