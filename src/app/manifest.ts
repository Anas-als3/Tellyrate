import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hospirate",
    short_name: "Hospirate",
    description:
      "Anonymous reviews of clinical training placements, by the students who did them.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f7f3",
    theme_color: "#2f6b57",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
