// Canonical site URL for SEO metadata, sitemap, and structured data.
// Set NEXT_PUBLIC_SITE_URL at build time to the real production domain.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://directdrop.app";

export const SITE_NAME = "DirectDrop";

export const SITE_DESCRIPTION =
  "Send files directly between two browsers that both stay open. Encrypted between those browsers. If a direct path is blocked, the encrypted stream may pass through a relay and is not stored. No account.";

// Rendered on the homepage FAQ and mirrored as FAQPage structured data —
// keep both in sync by editing only this list.
export const FAQ: { q: string; a: string }[] = [
  {
    q: "Is DirectDrop free?",
    a: "Yes. No account and no ads. Very large files need the browser’s save-to-disk path. Where that path is unavailable, the file is held in memory and can fail.",
  },
  {
    q: "How do I send a file?",
    a: "Open DirectDrop, share the link or QR code, then pick your files. Nothing is sent until they allow the connection and accept the file.",
  },
  {
    q: "Is there a file size limit?",
    a: "No cap is set in the app when the file streams straight to disk. If the browser cannot do that, the whole file is buffered in memory, and a large file can fail or crash the tab.",
  },
  {
    q: "Are my files private?",
    a: "The file is encrypted between the two browsers. A relay carries that encrypted stream only when a direct connection fails, and the file is not stored. Both people can see who joined before anything is accepted.",
  },
  {
    q: "Do both devices need to stay online?",
    a: "Yes. Both tabs have to stay open and awake until the transfer finishes. Sleep, lock, or a closed tab stops it. Nothing is queued to finish later.",
  },
  {
    q: "Does it work on phones?",
    a: "It runs in mobile browsers with no install. A phone that sleeps will stop the transfer. Keep the screen open until the file finishes.",
  },
];

// Rendered on the homepage "How it works" section and mirrored as HowTo
// structured data — keep both in sync by editing only this list.
export const HOW_IT_WORKS: { title: string; detail: string }[] = [
  { title: "Share your link or QR code", detail: "Your peer opens it in any browser — no app, no account" },
  { title: "They allow the connection, then accept the file", detail: "Nothing transfers until both of those happen" },
  { title: "Files stream directly to them", detail: "Encrypted between the two browsers. A relay may carry the encrypted stream. The file is not stored." },
];
