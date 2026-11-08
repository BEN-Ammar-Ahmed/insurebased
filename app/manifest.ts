import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "InsureBased", short_name: "InsureBased", description: "Find doctors. Understand coverage.", start_url: "/", display: "standalone", theme_color: "#1d4f91", background_color: "#f5f8fc", icons: [
    { src: "/icon-192.png?v=2", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icon-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icon-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ] };
}
