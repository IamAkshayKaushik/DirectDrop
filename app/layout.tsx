import type { Metadata, Viewport } from "next";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, FAQ, HOW_IT_WORKS } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "DirectDrop — Free P2P File Sharing, No Size Limits",
    template: "%s · DirectDrop",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "p2p file transfer",
    "send large files free",
    "browser to browser file sharing",
    "webrtc file transfer",
    "no size limit file sharing",
    "encrypted file transfer",
    "toffeeshare alternative",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: "DirectDrop — Free P2P File Sharing, No Size Limits",
    description: SITE_DESCRIPTION,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "DirectDrop — send files browser to browser" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DirectDrop — Free P2P File Sharing, No Size Limits",
    description: SITE_DESCRIPTION,
    images: ["/og.png"],
  },
  robots: { index: true, follow: true },
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#09090B" },
    { media: "(prefers-color-scheme: light)", color: "#FCFCFD" },
  ],
};

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires a WebRTC-capable browser",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: [
      "Peer-to-peer file transfer with no size limits",
      "End-to-end encrypted (WebRTC DTLS)",
      "No account, no app install, no uploads",
      "PIN, link, and QR code connection",
      "Live chat during transfer",
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  },
  {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to send a file with DirectDrop",
    step: HOW_IT_WORKS.map(({ title, detail }) => ({
      "@type": "HowToStep",
      name: title,
      text: detail,
    })),
  },
];

const themeInitScript = `(function () {
  try {
    var stored = localStorage.getItem("theme");
    var isDark = stored ? stored === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", isDark);
  } catch (e) {}
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-bg min-h-screen flex flex-col items-center justify-center p-2 sm:p-4 font-sans text-text antialiased">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
        {children}
      </body>
    </html>
  );
}
