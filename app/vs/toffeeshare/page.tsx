import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "DirectDrop vs ToffeeShare",
  description:
    "How DirectDrop compares to ToffeeShare for free peer-to-peer file transfer: no size limits, end-to-end encryption, PIN/link/QR connect, and live chat — no account, no app install.",
  alternates: { canonical: "/vs/toffeeshare" },
};

const ROWS: [string, string, string][] = [
  ["Price", "Free", "Free"],
  ["File size limit", "None", "None"],
  ["Account required", "No", "No"],
  ["Encryption", "End-to-end (WebRTC DTLS)", "End-to-end (DTLS 1.3, per their site)"],
  ["Connect via", "PIN, link, or QR code", "Not advertised on their site"],
  ["Live chat during transfer", "Yes", "Not advertised"],
  ["App install", "Not required — browser only", "Optional app available"],
  ["Streams straight to disk", "Yes (no in-memory buffering)", "Not specified"],
];

export default function ToffeeShareComparison() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 dark:from-slate-950 dark:to-slate-900 text-slate-800 dark:text-slate-100 px-4 py-10 sm:py-16">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-sm font-medium text-teal-600 dark:text-teal-400 hover:underline">
          ← DirectDrop
        </Link>

        <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight">DirectDrop vs ToffeeShare</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-400 leading-relaxed">
          Both are free, browser-based, peer-to-peer file transfer tools with no size limits and no
          server storage. Here&apos;s how DirectDrop compares, feature for feature, based on what each
          site publicly advertises.
        </p>

        <div className="mt-8 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-900 text-left">
                <th className="px-4 py-3 font-semibold">Feature</th>
                <th className="px-4 py-3 font-semibold text-teal-600 dark:text-teal-400">DirectDrop</th>
                <th className="px-4 py-3 font-semibold">ToffeeShare</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([feature, us, them], i) => (
                <tr
                  key={feature}
                  className={i % 2 === 0 ? "bg-white dark:bg-slate-950/50" : "bg-slate-50 dark:bg-slate-900/50"}
                >
                  <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{feature}</td>
                  <td className="px-4 py-3">{us}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{them}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-xs text-slate-500 dark:text-slate-500">
          ToffeeShare details reflect what&apos;s published on their site at the time of writing and may
          change. Check their site directly for the latest.
        </p>

        <Link
          href="/"
          className="mt-8 inline-flex items-center justify-center rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold px-6 py-3 transition-colors"
        >
          Try DirectDrop free →
        </Link>
      </div>
    </main>
  );
}
