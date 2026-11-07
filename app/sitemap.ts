import type { MetadataRoute } from "next";
import { CITIES, cityPath } from "../lib/cities";
import { SPECIALTY_LIST } from "../lib/specialties";

// Static pages plus every city and city + specialty directory page.
// Provider profiles are discovered through links on the directory pages.
export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env.SITE_URL;
  if (!site) return [];
  const paths = [
    "/", "/search", "/find", "/how-it-works", "/data", "/about", "/privacy", "/terms", "/accessibility", "/report",
    ...CITIES.map(city => cityPath(city)),
    ...CITIES.flatMap(city => SPECIALTY_LIST.map(s => cityPath(city, s.slug))),
  ];
  return paths.map(path => ({ url: new URL(path, site).href }));
}
