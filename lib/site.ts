// Canonical site URL for SEO metadata, sitemap, and structured data.
// Set NEXT_PUBLIC_SITE_URL at build time to the real production domain.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://directdrop.app";

export const SITE_NAME = "DirectDrop";

export const SITE_DESCRIPTION =
  "Send files of any size directly from one browser to another. End-to-end encrypted, peer-to-peer, no uploads, no account, free forever.";

// Rendered on the homepage FAQ and mirrored as FAQPage structured data —
// keep both in sync by editing only this list.
export const FAQ: { q: string; a: string }[] = [
  {
    q: "Is DirectDrop free?",
    a: "Yes. Every feature is free, with no account, no ads, and no file size limits. If it helps you, you can support the project with a donation.",
  },
  {
    q: "How do I send a file?",
    a: "Open DirectDrop, share your 6-digit PIN, link, or QR code with the receiver, then pick your files. The transfer starts as soon as they accept.",
  },
  {
    q: "Is there a file size limit?",
    a: "No. Files stream directly from your browser to the receiver's disk, so even multi-gigabyte files work.",
  },
  {
    q: "Are my files private?",
    a: "Yes. Transfers go browser-to-browser over an end-to-end encrypted WebRTC connection. Files are never uploaded to or stored on a server.",
  },
  {
    q: "Do both devices need to stay online?",
    a: "Yes. Transfers are direct, so both browser tabs must stay open until the transfer finishes. Nothing is queued on a server.",
  },
  {
    q: "Does it work on phones?",
    a: "Yes. DirectDrop runs in any modern browser on desktop, Android, and iOS — no app install needed. Scan the QR code to connect a phone instantly.",
  },
];

// Rendered on the homepage "How it works" section and mirrored as HowTo
// structured data — keep both in sync by editing only this list.
export const HOW_IT_WORKS: { title: string; detail: string }[] = [
  { title: "Open on the device that should receive", detail: "Tap Receive files — your PIN, link, and QR appear instantly" },
  { title: "Share the link or QR with the sender", detail: "Anyone can open it in any browser — no app, no account" },
  { title: "They pick files, you accept, files stream to you", detail: "Encrypted browser-to-browser, never stored on a server" },
];
