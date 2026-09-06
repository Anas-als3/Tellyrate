import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tellyrate",
    short_name: "Tellyrate",
    description:
      "Anonymous reviews of clinical training placements, by the students who did them.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfafa",
    theme_color: "#c41e3a",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
