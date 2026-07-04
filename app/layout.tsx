import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DirectDrop — Fast, Secure P2P File Transfer",
  description:
    "DirectDrop — send files directly to any browser, peer-to-peer. No uploads, no size limits, end-to-end encrypted.",
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#14b8a6" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gradient-to-br from-slate-50 to-slate-200 min-h-screen flex items-center justify-center p-2 sm:p-4 font-sans text-slate-800">
        {children}
      </body>
    </html>
  );
}
