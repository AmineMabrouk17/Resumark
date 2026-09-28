import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import "./resume.css";

export const metadata: Metadata = {
  title: "Resumark — Markdown resume editor",
  description:
    "Write Markdown, preview a professional A4 resume, fit it on one page and export a clean, ATS-friendly PDF with the browser's own print engine.",
  applicationName: "Resumark",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
