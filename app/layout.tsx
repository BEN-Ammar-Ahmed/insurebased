import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import "./globals.css";

const inter = localFont({ src: [
  { path: "../node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2", weight: "400" },
  { path: "../node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2", weight: "600" },
], variable: "--font-body", display: "swap" });

const site = process.env.SITE_URL;
const title = "InsureBased — Find Doctors by Insurance and Location";
const description = "Find nearby doctors and review available insurance coverage information using trustworthy public healthcare data.";
export const metadata: Metadata = {
  ...(site ? { metadataBase: new URL(site) } : {}),
  title: { default: title, template: "%s | InsureBased" },
  description,
  icons: {
    icon: [
      { url: "/brand/insurebased-mark.svg?v=2", type: "image/svg+xml" },
      { url: "/icon-32.png?v=2", sizes: "32x32", type: "image/png" },
      { url: "/icon-16.png?v=2", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/favicon.ico?v=2",
    apple: [{ url: "/apple-touch-icon.png?v=2", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  openGraph: { type: "website", siteName: "InsureBased", title, description, images: [{ url: "/brand/insurebased-social.png", width: 1200, height: 630, alt: "InsureBased — Find doctors. Understand coverage." }] },
  twitter: { card: "summary_large_image", title, description, images: ["/brand/insurebased-social.png"] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1d4f91",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <a className="skip-link" href="#page-content">Skip to content</a>
        <SiteHeader />
        <div id="page-content" className="site-content" tabIndex={-1}>{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
