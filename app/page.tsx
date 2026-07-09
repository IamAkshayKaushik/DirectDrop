"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useDirectDrop } from "@/hooks/useDirectDrop";
import { FAQ } from "@/lib/site";

// Set NEXT_PUBLIC_DONATE_URL (e.g. a Buy Me a Coffee / Ko-fi link) at build
// time to enable the donation prompt and footer link.
const DONATE_URL = process.env.NEXT_PUBLIC_DONATE_URL ?? "";

function FileIcon({ type, className }: { type: string; className: string }) {
  const cls = `w-6 h-6 ${className} flex-shrink-0`;
  if (type === "image") {
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }
  if (type === "archive") {
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    );
  }
  if (type === "code") {
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    );
  }
  return (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

const toastIcons = {
  success: (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  info: (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

export default function Home() {
  const dd = useDirectDrop();
  const [pinValue, setPinValue] = useState("");
  const [chatValue, setChatValue] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const addFilesRef = useRef(dd.addFiles);
  addFilesRef.current = dd.addFiles;

  useEffect(() => {
    setIsTouch(navigator.maxTouchPoints > 0);
  }, []);

  useEffect(() => {
    const box = chatBoxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [dd.chat]);

  // Drop files anywhere on the page, not just on the dropzone.
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes("Files");
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      setDragActive(true);
    };
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragActive(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragActive(false);
      if (e.dataTransfer?.files.length) addFilesRef.current(e.dataTransfer.files);
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  function onPinSubmit(e: FormEvent) {
    e.preventDefault();
    dd.connectToPin(pinValue);
  }

  function onPinChange(raw: string) {
    const v = raw.replace(/\D/g, "").slice(0, 6);
    setPinValue(v);
    // Auto-connect once a full PIN is typed or pasted.
    if (v.length === 6) dd.connectToPin(v);
  }

  function onChatSubmit(e: FormEvent) {
    e.preventDefault();
    if (dd.sendChat(chatValue)) setChatValue("");
  }

  return (
    <>
      {/* Ambient background veil — a single fixed gradient, no blur-blob soup */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(20,184,166,0.15),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(20,184,166,0.08),transparent)]"
        aria-hidden="true"
      />

      {/* Full-page drop overlay */}
      {dragActive && (
        <div className="fixed inset-0 z-40 bg-teal-500/10 dark:bg-teal-400/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="m-4 px-10 py-8 bg-white dark:bg-slate-900 border-2 border-dashed border-teal-400 rounded-2xl shadow-2xl text-center animate-fade-in">
            <svg className="w-10 h-10 text-teal-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100">Drop files to send</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">They go straight to your peer — nothing is uploaded</p>
          </div>
        </div>
      )}

      <main className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/50 dark:border-slate-700/50 p-4 sm:p-8 rounded-3xl shadow-2xl max-w-5xl w-full transition-all duration-300 min-h-[80vh] flex flex-col">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 flex-1">
          {/* Left Column: Header, Connect, File Input, Queue */}
          <div className="flex flex-col">
            <header className="text-left mb-8">
              <div className="flex items-center gap-3 mb-3">
                <div className="inline-flex items-center justify-center w-11 h-11 bg-gradient-to-br from-teal-500 to-teal-600 text-white rounded-xl shadow-lg shadow-teal-500/25">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-none text-slate-900 dark:text-white">
                    DirectDrop
                  </h1>
                  <p className="text-base text-slate-500 dark:text-slate-400 mt-1.5 font-medium">Fast, secure peer-to-peer file transfer</p>
                </div>
              </div>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <span className="inline-flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  End-to-end encrypted
                </span>
                <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
                <span>No size limits</span>
                <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
                <span>No servers, no signups</span>
              </p>
            </header>

            {/* Connect to a peer */}
            {dd.showPinEntry && (
              <div className="mb-6 bg-white dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-sm">
                <label htmlFor="pinInput" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Have a PIN? Enter it to connect
                </label>
                <form onSubmit={onPinSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    id="pinInput"
                    type="text"
                    value={pinValue}
                    onChange={(e) => onPinChange(e.target.value)}
                    maxLength={6}
                    pattern="[0-9]{6}"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="6-digit PIN"
                    className="flex-1 min-w-0 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xl font-mono font-bold tracking-[0.3em] text-center rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-slate-300 dark:placeholder:text-slate-600 placeholder:tracking-normal placeholder:font-normal placeholder:text-base"
                  />
                  <button
                    type="submit"
                    disabled={dd.pinConnecting}
                    className="bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-semibold px-5 py-3 rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {dd.pinConnecting ? "Connecting..." : "Connect"}
                  </button>
                </form>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Connects automatically when all 6 digits are in.</p>
              </div>
            )}

            {/* File Upload Area */}
            <div className="w-full mb-6">
              <label
                htmlFor="fileInput"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    (document.getElementById("fileInput") as HTMLInputElement | null)?.click();
                  }
                }}
                className={`flex flex-col items-center justify-center w-full h-36 sm:h-44 border-2 border-dashed rounded-2xl cursor-pointer bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/70 hover:border-teal-400 transition-all duration-200 group ${
                  dragActive ? "border-teal-400 bg-teal-50/50 dark:bg-teal-500/10 scale-[1.02]" : "border-slate-300 dark:border-slate-600"
                }`}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                  <div className="p-4 bg-white dark:bg-slate-900 rounded-full shadow-md ring-1 ring-slate-900/5 dark:ring-white/10 mb-4 group-hover:scale-110 group-hover:shadow-teal-500/20 dark:group-hover:shadow-teal-400/10 transition-all duration-200">
                    <svg className="w-8 h-8 text-teal-500" aria-hidden="true" fill="none" viewBox="0 0 20 16">
                      <path
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
                      />
                    </svg>
                  </div>
                  <p className="mb-1 text-base font-semibold text-slate-700 dark:text-slate-200">
                    {isTouch ? "Tap to select files" : "Click to select files"}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 hidden sm:block">or drop them anywhere on this page</p>
                </div>
                <input
                  id="fileInput"
                  type="file"
                  className="hidden"
                  multiple
                  onChange={(e) => {
                    if (e.target.files) dd.addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>

            {/* File Queue */}
            {dd.queue.length > 0 && (
              <div className="flex flex-col space-y-3 mb-6 flex-1">
                <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Transfer Queue</h2>
                <ul className="flex flex-col space-y-3 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                  {dd.queue.map((item) => (
                    <li
                      key={item.index}
                      className={`p-3 rounded-xl border animate-fade-in ${
                        item.status === "sending"
                          ? "border-teal-400 bg-teal-50 dark:bg-teal-500/10"
                          : "border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-800/60"
                      } flex justify-between items-center transition-all`}
                    >
                      <div className="flex items-center space-x-3 overflow-hidden">
                        <FileIcon
                          type={item.iconType}
                          className={item.status === "done" ? "text-green-500" : "text-slate-500 dark:text-slate-400"}
                        />
                        <div className="overflow-hidden">
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate" title={item.name}>
                            {item.name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{(item.size / (1024 * 1024)).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <div className="flex items-center">
                        {item.status === "sending" && (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400">
                            Sending
                          </span>
                        )}
                        {item.status === "done" && (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400">
                            Done
                          </span>
                        )}
                        {item.status === "pending" && (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            Pending
                          </span>
                        )}
                        {item.status === "sending" && item.cancellable && (
                          <button
                            onClick={() => dd.cancelFileAt(item.index)}
                            className="ml-2 px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-500/25 transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                        )}
                        {item.status === "pending" && item.cancellable && (
                          <button
                            onClick={() => dd.cancelFileAt(item.index)}
                            aria-label={`Remove ${item.name} from queue`}
                            className="ml-2 w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:bg-rose-100 dark:hover:bg-rose-500/15 hover:text-rose-500 transition-colors cursor-pointer text-xs"
                          >
                            &times;
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                {dd.queueDrained && (
                  <div className="flex items-center justify-center space-x-2 text-slate-500 dark:text-slate-400 text-xs py-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Drop more files to send</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Share, Status, Chat, Progress */}
          <div className="flex flex-col h-full">
            {/* Skeleton reserving the share panel's slot until the PIN arrives — avoids layout shift */}
            {!dd.pin && !dd.showSpinner && !dd.connected && (
              <div
                className="mb-6 bg-white dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-sm"
                aria-hidden="true"
              >
                <div className="h-3 w-32 bg-slate-100 dark:bg-slate-700 rounded mb-3 animate-pulse" />
                <div className="h-[88px] w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl mb-4 animate-pulse" />
                <div className="h-11 w-full bg-slate-50 dark:bg-slate-900/60 rounded-xl animate-pulse" />
                <div className="hidden sm:block mt-4 h-[196px] bg-slate-50 dark:bg-slate-900/60 rounded-xl animate-pulse" />
                <div className="mt-3 h-3 w-44 bg-slate-100 dark:bg-slate-700 rounded animate-pulse" />
              </div>
            )}

            {/* Share panel: your PIN, link, QR */}
            {dd.showShare && (
              <div className="mb-6 bg-white dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-sm">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Your PIN — share it</p>
                <button
                  type="button"
                  onClick={dd.copyPin}
                  title="Copy PIN"
                  className="group w-full text-center bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl py-3 mb-4 hover:border-teal-400 transition-colors"
                >
                  <span className="text-3xl sm:text-4xl font-mono font-extrabold text-teal-600 dark:text-teal-400 tracking-[0.35em] select-all">
                    {dd.pin || "------"}
                  </span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1 group-hover:text-teal-500 transition-colors">
                    Tap to copy
                  </span>
                </button>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={dd.shareUrl}
                    aria-label="Share link"
                    onFocus={(e) => e.target.select()}
                    className="flex-1 min-w-0 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-sm font-mono font-medium rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                  />
                  <button
                    onClick={dd.shareOrCopyLink}
                    className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 p-2.5 rounded-xl transition-colors"
                    title="Share or copy link"
                    aria-label="Share or copy link"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
                {dd.qrDataUrl && (
                  <div className="hidden sm:flex mt-4 justify-center p-2 bg-white rounded-xl border border-slate-100 dark:border-slate-700">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={dd.qrDataUrl} alt="QR code for share link" width={180} height={180} />
                  </div>
                )}
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400" role="status">
                  <span className="inline-block w-2 h-2 rounded-full bg-teal-400 animate-pulse" aria-hidden="true" />
                  Waiting for someone to connect…
                </div>
              </div>
            )}

            {/* Connecting spinner (URL-based auto-connect) */}
            {dd.showSpinner && (
              <div className="mb-6 p-5 bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-sm" role="status">
                <div className="flex items-center justify-center space-x-3 py-2">
                  <svg className="animate-spin h-5 w-5 text-teal-500" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Connecting to peer...</span>
                </div>
              </div>
            )}

            {/* Pre-connection: how it works */}
            {dd.showHelp && (
              <div className="mb-6 p-5">
                <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">How it works</h2>
                <ol className="grid grid-cols-1 gap-3">
                  {[
                    ["Share your PIN, link, or QR code", "Your peer opens it in any browser — no app, no account"],
                    ["Pick files, they ask to accept", "Nothing transfers until the receiver says yes"],
                    ["Files stream directly to them", "Encrypted browser-to-browser, never stored on a server"],
                  ].map(([title, sub], i) => (
                    <li key={title} className="flex items-center gap-3">
                      <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-500/10 flex items-center justify-center text-sm font-bold text-teal-600 dark:text-teal-400">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{sub}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* iOS Safari manual download fallback */}
            {dd.manualDownload && (
              <div className="mb-6 p-4 bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/30 rounded-2xl">
                <p className="text-xs font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider mb-2">File Ready</p>
                <a
                  href={dd.manualDownload.url}
                  download={dd.manualDownload.name}
                  className="flex items-center gap-2 text-sm font-semibold text-teal-700 dark:text-teal-300 underline underline-offset-2"
                >
                  Save {dd.manualDownload.name}
                </a>
              </div>
            )}

            {/* Transfer Progress */}
            {dd.progress && (
              <div className="mb-6 w-full bg-white dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-sm">
                <div className="flex justify-between items-end mb-2 gap-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                    {dd.progress.role === "send" ? "Sending" : "Receiving"}{" "}
                    <span className="text-teal-600 dark:text-teal-400">{dd.progress.filename}</span>
                  </span>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md whitespace-nowrap">
                    {dd.progress.eta}
                  </span>
                </div>
                <div
                  className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5 mb-2 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={Math.round(dd.progress.pct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Transferring ${dd.progress.filename}`}
                >
                  <div
                    className="bg-teal-500 h-2.5 rounded-full transition-all duration-300 relative"
                    style={{ width: `${dd.progress.pct}%` }}
                  >
                    <div className="absolute top-0 left-0 w-full h-full bg-white/20 animate-pulse" />
                  </div>
                </div>
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                  <span className="font-medium">{dd.progress.speed}</span>
                  <span className="font-semibold text-slate-600 dark:text-slate-300">{Math.round(dd.progress.pct)}%</span>
                  <span className="text-slate-500 dark:text-slate-400">{dd.progress.sizeText}</span>
                </div>
                {dd.receivingActive && (
                  <button
                    type="button"
                    onClick={dd.cancelActiveReceive}
                    className="mt-3 w-full bg-white dark:bg-transparent hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-rose-200 dark:border-rose-500/40 text-rose-600 dark:text-rose-400 text-sm font-semibold py-2 px-4 rounded-xl transition-all"
                  >
                    Cancel download
                  </button>
                )}
              </div>
            )}

            {/* Donation prompt after a successful transfer */}
            {DONATE_URL && dd.donateHint && (
              <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl flex items-start gap-3 animate-fade-in">
                <span className="text-xl animate-pop-in" aria-hidden="true">
                  ❤️
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Transfer complete — glad it helped!</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    DirectDrop is free, private, and has no size limits. A small donation keeps it that way.
                  </p>
                  <a
                    href={DONATE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 bg-amber-400 hover:bg-amber-500 text-slate-900 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Buy me a coffee ☕
                  </a>
                </div>
                <button
                  onClick={dd.dismissDonate}
                  aria-label="Dismiss"
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-lg leading-none"
                >
                  &times;
                </button>
              </div>
            )}

            {/* Transfer History */}
            {dd.log.length > 0 && (
              <div className="mb-6">
                <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Transferred</h2>
                <ul className="flex flex-col gap-1.5">
                  {dd.log.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center gap-2 text-xs bg-slate-50 dark:bg-slate-800/60 rounded-lg px-3 py-2 animate-fade-in"
                    >
                      <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="font-medium truncate text-slate-700 dark:text-slate-200">{entry.name}</span>
                      <span className="ml-auto text-slate-500 dark:text-slate-400 shrink-0">{entry.sizeLabel}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Incoming file accept/reject */}
            {dd.incoming && (
              <div className="mb-6 p-5 bg-white dark:bg-slate-800 border-2 border-teal-300 dark:border-teal-500/50 rounded-2xl shadow-md animate-fade-in">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 p-2 rounded-lg">
                    <FileIcon type={dd.incoming.iconType} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Incoming File</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {dd.incoming.filename} ({dd.incoming.sizeLabel})
                    </p>
                  </div>
                </div>
                <div className="flex space-x-3 mt-4">
                  <button
                    onClick={dd.acceptIncoming}
                    className="flex-1 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white text-sm font-semibold py-2.5 px-4 rounded-xl transition-all shadow-sm shadow-teal-500/30"
                  >
                    Accept
                  </button>
                  <button
                    onClick={dd.rejectIncoming}
                    className="flex-1 bg-white dark:bg-transparent hover:bg-slate-50 dark:hover:bg-slate-700/60 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-semibold py-2.5 px-4 rounded-xl transition-all"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}

            {/* Connected badge + chat */}
            {dd.connected && (
              <>
                <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-green-600 dark:text-green-400" role="status">
                  <span className="w-2 h-2 rounded-full bg-green-500" aria-hidden="true" />
                  Connected
                </div>
                <div className="w-full bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-sm overflow-hidden flex flex-col flex-1 min-h-[80px] sm:min-h-[200px]">
                  <div className="bg-slate-50 dark:bg-slate-800 px-4 py-3 border-b border-slate-100 dark:border-slate-700/60 flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" aria-hidden="true" />
                    <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Live Chat</h2>
                  </div>
                  <div
                    ref={chatBoxRef}
                    className="h-40 overflow-y-auto p-4 text-sm flex flex-col space-y-3 bg-white dark:bg-transparent scroll-smooth custom-scrollbar"
                  >
                    <div className="text-center text-xs text-slate-500 dark:text-slate-400 mt-auto">Connection established. Say hi!</div>
                    {dd.chat.map((msg) => (
                      <div key={msg.id} className={`flex animate-fade-in mb-2 ${msg.sender === "you" ? "justify-end" : "justify-start"}`}>
                        <div
                          className={
                            msg.sender === "you"
                              ? "max-w-[75%] px-4 py-2 rounded-2xl rounded-br-sm bg-teal-500 text-white text-sm shadow break-words"
                              : "max-w-[75%] px-4 py-2 rounded-2xl rounded-bl-sm bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-100 text-sm shadow-sm break-words"
                          }
                        >
                          {msg.text}
                        </div>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={onChatSubmit} className="p-3 border-t border-slate-100 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800 flex space-x-2">
                    <input
                      type="text"
                      value={chatValue}
                      onChange={(e) => setChatValue(e.target.value)}
                      className="flex-1 min-w-0 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                      placeholder="Type a message..."
                      aria-label="Chat message"
                      autoComplete="off"
                    />
                    <button
                      type="submit"
                      className="bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm shadow-teal-500/20"
                    >
                      Send
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Crawlable FAQ — native <details>, no JS. Mirrored as FAQPage JSON-LD. */}
      <section id="faq" className="max-w-5xl w-full mt-8 px-2 sm:px-0" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
          Frequently asked questions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FAQ.map(({ q, a }) => (
            <details
              key={q}
              className="group bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/60 rounded-xl px-4 py-3 open:pb-4"
            >
              <summary className="cursor-pointer list-none flex items-center justify-between gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                {q}
                <svg
                  className="w-4 h-4 text-slate-400 flex-shrink-0 transition-transform group-open:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <p className="mt-6 mb-2 text-xs text-slate-500 dark:text-slate-400">
        Free forever
        {DONATE_URL && (
          <>
            {" · "}
            <a
              href={DONATE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-slate-600 dark:hover:text-slate-300"
            >
              Support DirectDrop ❤️
            </a>
          </>
        )}
      </p>

      {/* Toasts */}
      <div className="fixed top-6 right-6 z-50 flex flex-col space-y-3 max-w-sm" aria-live="polite">
        {dd.toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`flex items-center gap-2.5 p-4 rounded-xl border shadow-lg animate-fade-in text-sm font-medium ${
              toast.type === "success"
                ? "bg-emerald-500 border-emerald-600 text-white"
                : toast.type === "error"
                  ? "bg-rose-500 border-rose-600 text-white"
                  : "bg-slate-800 border-slate-700 text-white"
            }`}
          >
            {toastIcons[toast.type]}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </>
  );
}
