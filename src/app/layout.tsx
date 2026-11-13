import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "R2 Vault — privatni Cloudflare storage",
  description: "Privatni portal za bezbedan upload fajlova u Cloudflare R2.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sr-Latn">
      <body>{children}</body>
    </html>
  );
}
