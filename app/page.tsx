"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useDirectDrop } from "@/hooks/useDirectDrop";

// Set NEXT_PUBLIC_DONATE_URL (e.g. a Buy Me a Coffee / Ko-fi link) at build
// time to enable the donation prompt and footer link.
const DONATE_URL = process.env.NEXT_PUBLIC_DONATE_URL ?? "";

function FileIcon({ type, className }: { type: string; className: string }) {
  const cls = `w-6 h-6 ${className} flex-shrink-0`;
  if (type === "image") {
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }
  if (type === "archive") {
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    );
  }
  if (type === "code") {
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    );
  }
  return (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

export default function Home() {
  const dd = useDirectDrop();
  const [pinValue, setPinValue] = useState("");
  const [chatValue, setChatValue] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const chatBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsTouch(navigator.maxTouchPoints > 0);
  }, []);

  useEffect(() => {
    const box = chatBoxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [dd.chat]);

  function onPinSubmit(e: FormEvent) {
    e.preventDefault();
    dd.connectToPin(pinValue);
  }

  function onChatSubmit(e: FormEvent) {
    e.preventDefault();
    if (dd.sendChat(chatValue)) setChatValue("");
  }

  const stopDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <>
      {/* Decorative background blobs */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-teal-200/40 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob" />
        <div className="absolute top-[20%] right-[-5%] w-72 h-72 bg-blue-200/40 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000" />
        <div className="absolute bottom-[-20%] left-[20%] w-80 h-80 bg-slate-300/40 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000" />
      </div>

      <div className="bg-white/70 backdrop-blur-xl border border-white/50 p-4 sm:p-8 rounded-3xl shadow-2xl max-w-5xl w-full transition-all duration-300 min-h-[80vh] flex flex-col">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 flex-1">
          {/* Left Column: Header, File Input, Queue */}
          <div className="flex flex-col">
            <div className="text-left mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-teal-100 text-teal-600 rounded-xl mb-4 shadow-sm">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">DirectDrop</h1>
              <p className="text-base text-slate-500 mt-1 font-medium">Fast, secure peer-to-peer file transfer</p>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                End-to-end encrypted · Files never touch a server
              </p>
            </div>

            {/* PIN Entry */}
            {dd.showPinEntry && (
              <div className="mb-6 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <div
                  className="text-center cursor-pointer mb-4 pb-4 border-b border-slate-100"
                  title="Tap to copy PIN"
                  onClick={dd.copyPin}
                >
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Your PIN — share it</p>
                  <span className="text-3xl sm:text-4xl font-mono font-extrabold text-teal-600 tracking-[0.35em] select-all">
                    {dd.pin || "------"}
                  </span>
                  <p className="text-xs text-slate-400 mt-1.5">Tap to copy</p>
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Or enter their PIN</p>
                <form onSubmit={onPinSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    value={pinValue}
                    onChange={(e) => setPinValue(e.target.value)}
                    maxLength={6}
                    pattern="[0-9]{6}"
                    inputMode="numeric"
                    placeholder="Enter 6-digit PIN"
                    autoFocus
                    className="flex-1 min-w-0 bg-slate-50 border border-slate-200 text-slate-800 text-xl font-mono font-bold tracking-[0.3em] text-center rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-slate-300 placeholder:tracking-normal placeholder:font-normal placeholder:text-base"
                  />
                  <button
                    type="submit"
                    disabled={dd.pinConnecting}
                    className="bg-teal-500 hover:bg-teal-600 text-white font-semibold px-5 py-3 rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {dd.pinConnecting ? "Connecting..." : "Connect"}
                  </button>
                </form>
              </div>
            )}

            {/* File Upload Area */}
            <div className="w-full mb-6">
              <label
                htmlFor="fileInput"
                onDragEnter={(e) => {
                  stopDrag(e);
                  setDragActive(true);
                }}
                onDragOver={(e) => {
                  stopDrag(e);
                  setDragActive(true);
                }}
                onDragLeave={(e) => {
                  stopDrag(e);
                  setDragActive(false);
                }}
                onDrop={(e) => {
                  stopDrag(e);
                  setDragActive(false);
                  dd.addFiles(e.dataTransfer.files);
                }}
                className={`flex flex-col items-center justify-center w-full h-36 sm:h-44 border-2 border-dashed rounded-2xl cursor-pointer bg-slate-50/50 hover:bg-slate-50 hover:border-teal-400 transition-all duration-200 group ${
                  dragActive ? "border-teal-400 bg-teal-50/50 scale-[1.02]" : "border-slate-300"
                }`}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                  <div className="p-4 bg-white rounded-full shadow-sm mb-4 group-hover:scale-110 transition-transform duration-200">
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
                  <p className="mb-1 text-base font-semibold text-slate-700">
                    {isTouch ? "Tap to select files" : "Click to select files"}
                  </p>
                  <p className="text-sm text-slate-500 hidden sm:block">or drag and drop here</p>
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
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Transfer Queue</h3>
                <div className="flex flex-col space-y-3 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                  {dd.queue.map((item) => (
                    <div
                      key={item.index}
                      className={`p-3 rounded-xl border ${
                        item.status === "sending" ? "border-teal-400 bg-teal-50" : "border-slate-100 bg-white"
                      } flex justify-between items-center transition-all`}
                    >
                      <div className="flex items-center space-x-3 overflow-hidden">
                        <FileIcon type={item.iconType} className={item.status === "done" ? "text-green-500" : "text-slate-400"} />
                        <div className="overflow-hidden">
                          <p className="text-sm font-semibold text-slate-700 truncate" title={item.name}>
                            {item.name}
                          </p>
                          <p className="text-xs text-slate-500">{(item.size / (1024 * 1024)).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <div className="flex items-center">
                        {item.status === "sending" && (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700">Sending</span>
                        )}
                        {item.status === "done" && (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700">Done</span>
                        )}
                        {item.status === "pending" && (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-600">Pending</span>
                        )}
                        {item.status === "sending" && item.cancellable && (
                          <button
                            onClick={() => dd.cancelFileAt(item.index)}
                            className="ml-2 px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-600 hover:bg-rose-200 transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                        )}
                        {item.status === "pending" && item.cancellable && (
                          <button
                            onClick={() => dd.cancelFileAt(item.index)}
                            className="ml-2 w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:bg-rose-100 hover:text-rose-500 transition-colors cursor-pointer text-xs"
                          >
                            &times;
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {dd.queueDrained && (
                    <div className="flex items-center justify-center space-x-2 text-slate-400 text-xs mt-3 py-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Drop more files to send</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Status, Chat, Progress */}
          <div className="flex flex-col h-full">
            {/* Share Link */}
            {dd.showShare && (
              <div className="mb-6 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Share this code to connect</p>
                <p className="text-3xl font-mono font-extrabold text-teal-600 tracking-[0.35em] mb-3">{dd.pin || "------"}</p>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={dd.shareUrl}
                    className="flex-1 bg-slate-50 border border-slate-200 text-slate-800 text-lg font-mono font-medium rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                  />
                  <button
                    onClick={dd.shareOrCopyLink}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2.5 rounded-xl transition-colors"
                    title="Copy to clipboard"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
                {dd.qrDataUrl && (
                  <div className="hidden sm:flex mt-4 justify-center p-2 bg-white rounded-xl border border-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={dd.qrDataUrl} alt="QR code for share link" width={200} height={200} />
                  </div>
                )}
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                  <span className="inline-block w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                  Waiting for someone to connect…
                </div>
              </div>
            )}

            {/* Connecting spinner (URL-based auto-connect) */}
            {dd.showSpinner && (
              <div className="mb-6 p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center justify-center space-x-3 py-2">
                  <svg className="animate-spin h-5 w-5 text-teal-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm font-medium text-slate-600">Connecting to peer...</span>
                </div>
              </div>
            )}

            {/* Pre-connection: trust & features */}
            {dd.showHelp && (
              <div className="mb-6 p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
                      <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">End-to-end encrypted</p>
                      <p className="text-xs text-slate-400">Direct browser-to-browser transfer</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
                      <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">No file size limits</p>
                      <p className="text-xs text-slate-400">Stream any file, any size</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
                      <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Nothing stored on servers</p>
                      <p className="text-xs text-slate-400">Files go directly to your peer</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* iOS Safari manual download fallback */}
            {dd.manualDownload && (
              <div className="mb-6 p-4 bg-teal-50 border border-teal-200 rounded-2xl">
                <p className="text-xs font-bold text-teal-700 uppercase tracking-wider mb-2">File Ready</p>
                <a
                  href={dd.manualDownload.url}
                  download={dd.manualDownload.name}
                  className="flex items-center gap-2 text-sm font-semibold text-teal-700 underline underline-offset-2"
                >
                  Save {dd.manualDownload.name}
                </a>
              </div>
            )}

            {/* Transfer Progress */}
            {dd.progress && (
              <div className="mb-6 w-full bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-sm font-semibold text-slate-700">
                    Transferring <span className="text-teal-600">{dd.progress.filename}</span>
                  </span>
                  <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{dd.progress.eta}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 mb-2 overflow-hidden">
                  <div
                    className="bg-teal-500 h-2.5 rounded-full transition-all duration-300 relative"
                    style={{ width: `${dd.progress.pct}%` }}
                  >
                    <div className="absolute top-0 left-0 w-full h-full bg-white/20 animate-pulse" />
                  </div>
                </div>
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span className="font-medium">{dd.progress.speed}</span>
                  <span className="text-slate-400">{dd.progress.sizeText}</span>
                </div>
                {dd.receivingActive && (
                  <button
                    type="button"
                    onClick={dd.cancelActiveReceive}
                    className="mt-3 w-full bg-white hover:bg-rose-50 border border-rose-200 text-rose-600 text-sm font-semibold py-2 px-4 rounded-xl transition-all"
                  >
                    Cancel download
                  </button>
                )}
              </div>
            )}

            {/* Donation prompt after a successful transfer */}
            {DONATE_URL && dd.donateHint && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                <span className="text-xl">❤️</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800">Transfer complete — glad it helped!</p>
                  <p className="text-xs text-slate-500 mt-0.5">
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
                  className="text-slate-400 hover:text-slate-600 text-lg leading-none"
                >
                  &times;
                </button>
              </div>
            )}

            {/* Transfer History */}
            {dd.log.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Transferred</p>
                <ul className="flex flex-col gap-1.5">
                  {dd.log.map((entry) => (
                    <li key={entry.id} className="flex items-center gap-2 text-xs bg-slate-50 rounded-lg px-3 py-2">
                      <span className="font-medium truncate text-slate-700">{entry.name}</span>
                      <span className="ml-auto text-slate-400 shrink-0">{entry.sizeLabel}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Incoming file accept/reject */}
            {dd.incoming && (
              <div className="mb-6 p-5 bg-white border border-teal-100 rounded-2xl shadow-md transform transition-all">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
                    <FileIcon type={dd.incoming.iconType} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Incoming File</p>
                    <p className="text-xs text-slate-500">
                      {dd.incoming.filename} ({dd.incoming.sizeLabel})
                    </p>
                  </div>
                </div>
                <div className="flex space-x-3 mt-4">
                  <button
                    onClick={dd.acceptIncoming}
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold py-2.5 px-4 rounded-xl transition-all shadow-sm shadow-teal-500/30"
                  >
                    Accept
                  </button>
                  <button
                    onClick={dd.rejectIncoming}
                    className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-sm font-semibold py-2.5 px-4 rounded-xl transition-all"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}

            {/* Connected badge + chat */}
            {dd.connected && (
              <>
                <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-green-600">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Connected
                </div>
                <div className="w-full bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col flex-1 min-h-[80px] sm:min-h-[200px]">
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <h3 className="text-sm font-bold text-slate-700">Live Chat</h3>
                  </div>
                  <div
                    ref={chatBoxRef}
                    className="h-40 overflow-y-auto p-4 text-sm flex flex-col space-y-3 bg-white scroll-smooth"
                  >
                    <div className="text-center text-xs text-slate-400 mt-auto">Connection established. Say hi!</div>
                    {dd.chat.map((msg) => (
                      <div key={msg.id} className={`flex animate-fade-in mb-2 ${msg.sender === "you" ? "justify-end" : "justify-start"}`}>
                        <div
                          className={
                            msg.sender === "you"
                              ? "max-w-[75%] px-4 py-2 rounded-2xl rounded-br-sm bg-teal-500 text-white text-sm shadow"
                              : "max-w-[75%] px-4 py-2 rounded-2xl rounded-bl-sm bg-white border border-slate-200 text-slate-700 text-sm shadow-sm"
                          }
                        >
                          {msg.text}
                        </div>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={onChatSubmit} className="p-3 border-t border-slate-100 bg-slate-50 flex space-x-2">
                    <input
                      type="text"
                      value={chatValue}
                      onChange={(e) => setChatValue(e.target.value)}
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                      placeholder="Type a message..."
                      autoComplete="off"
                    />
                    <button
                      type="submit"
                      className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm shadow-teal-500/20"
                    >
                      Send
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {DONATE_URL && (
        <p className="mt-4 text-xs text-slate-400">
          Free forever ·{" "}
          <a href={DONATE_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-slate-600">
            Support DirectDrop ❤️
          </a>
        </p>
      )}

      {/* Toasts */}
      <div className="fixed top-6 right-6 z-50 flex flex-col space-y-3 max-w-sm">
        {dd.toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center p-4 rounded-xl border shadow-lg animate-fade-in ${
              toast.type === "success"
                ? "bg-emerald-500 border-emerald-600 text-white"
                : toast.type === "error"
                  ? "bg-rose-500 border-rose-600 text-white"
                  : "bg-slate-800 border-slate-700 text-white"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </>
  );
}
