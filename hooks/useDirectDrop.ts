"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import utils from "@/lib/transfer-utils";
import { createStreamDownload, probeStreamDownload, type StreamWriter } from "@/lib/stream-download";
import { startSession, type Link } from "@/lib/webrtc-session";

const {
  CHUNK_SIZE,
  PIPELINE_WINDOW,
  formatFileSize,
  calculateReceivedBytes,
  calculateReceivePercent,
  generateRoomId,
  formatEta,
  getFileIconType,
} = utils;

const FILENAME_PREFIX = "bbb.";

const TOAST_VISIBLE_MS = 4000;
const TOAST_EXIT_MS = 200; // must match --duration-2 in app/globals.css

export type ToastItem = {
  id: number;
  message: string;
  type: "success" | "error" | "info";
  exiting?: boolean;
};
export type ChatMessage = { id: number; sender: "you" | "peer"; text: string };
export type QueueEntry = {
  index: number;
  name: string;
  size: number;
  iconType: string;
  status: "sending" | "done" | "pending";
  cancellable: boolean;
};
export type TransferProgress = {
  role: "send" | "receive";
  filename: string;
  pct: number;
  speed: string;
  eta: string;
  sizeText: string;
};
export type IncomingPrompt = { filename: string; sizeLabel: string; iconType: string };
export type LogEntry = { id: number; name: string; sizeLabel: string };
export type ManualDownload = { url: string; name: string };

let nextId = 0;

export function useDirectDrop() {
  const [pin, setPin] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [showPinEntry, setShowPinEntry] = useState(true);
  const [showShare, setShowShare] = useState(false);
  const [showHelp, setShowHelp] = useState(true);
  const [showSpinner, setShowSpinner] = useState(false);
  const [connected, setConnected] = useState(false);
  const [pinConnecting, setPinConnecting] = useState(false);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const [receivingActive, setReceivingActive] = useState(false);
  const [incoming, setIncoming] = useState<IncomingPrompt | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [manualDownload, setManualDownload] = useState<ManualDownload | null>(null);
  const [donateHint, setDonateHint] = useState(false);
  const [role, setRole] = useState<"host" | "guest" | null>(null);
  // All reconnect attempts exhausted; drop-mode contributors have no PIN
  // entry to fall back to, so they need an explicit retry affordance.
  const [connectionLost, setConnectionLost] = useState(false);
  const [awaitingGuest, setAwaitingGuest] = useState(false);
  const [transferAllowed, setTransferAllowed] = useState(false);
  const [safetyCode, setSafetyCode] = useState("");
  const [dropMode, setDropMode] = useState(false);
  const [dropRole, setDropRole] = useState<"host" | "contributor" | null>(null);
  // Streaming-download support probe; null until known. Pessimistic default —
  // show the manual-save hint until we've confirmed the SW path works.
  const [streamOk, setStreamOk] = useState<boolean | null>(null);

  const sessionRef = useRef<{ close: () => void } | null>(null);
  const connRef = useRef<Link | null>(null);
  const defaultTitleRef = useRef<string>("");
  const eng = useRef({
    fileQueue: [] as File[],
    currentFileIndex: 0,
    fileData: null as File | null,
    currentChunk: 0,
    receivedChunks: [] as ArrayBuffer[],
    streamWriter: null as StreamWriter | null,
    chunksInFlight: 0,
    isProcessingQueue: false,
    isSending: false,
    isReceiving: false,
    incomingFilePending: false,
    downloadInitiated: false,
    incomingTotalChunks: 0,
    incomingTotalBytes: 0,
    incomingFilename: "",
    transferStartTime: 0,
    lastSpeedUpdateTime: 0,
    lastProgress: null as TransferProgress | null,
    remotePeerId: null as string | null,
    reconnectAttempt: 0,
    reconnectTimer: null as ReturnType<typeof setTimeout> | null,
    hasPeerParam: false,
    spinnerVisible: false,
    destroyed: false,
    guestConfirmed: false,
    roomId: null as string | null,
  }).current;

  function showToast(message: string, type: ToastItem["type"] = "info") {
    const id = ++nextId;
    setToasts((t) => [...t, { id, message, type }]);

    // Visible 4s, then exit 200ms so the top-edge transition can play before unmount.
    setTimeout(() => {
      setToasts((t) => t.map((x) => (x.id === id ? { ...x, exiting: true } : x)));
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), TOAST_EXIT_MS);
    }, TOAST_VISIBLE_MS);
  }

  function setSpinner(v: boolean) {
    eng.spinnerVisible = v;
    setShowSpinner(v);
  }

  function syncQueue() {
    const open = !!connRef.current?.open;
    setQueue(
      eng.fileQueue.map((file, index) => {
        const isCurrent = index === eng.currentFileIndex;
        const isDone = index < eng.currentFileIndex;
        const sending = isCurrent && open && eng.isSending;
        return {
          index,
          name: file.name,
          size: file.size,
          iconType: getFileIconType(file.name),
          status: sending ? "sending" : isDone ? "done" : "pending",
          cancellable: sending || index > eng.currentFileIndex,
        } as QueueEntry;
      })
    );
  }

  function appendChat(sender: ChatMessage["sender"], text: string) {
    setChat((c) => [...c, { id: ++nextId, sender, text }]);
  }

  function appendLog(name: string, bytes: number) {
    setLog((l) => [...l, { id: ++nextId, name, sizeLabel: formatFileSize(bytes) }]);
  }

  function updateTransferAnalytics(role: "send" | "receive", filename: string, currentBytes: number, totalBytes: number) {
    const now = Date.now();
    if (currentBytes === 0) {
      eng.transferStartTime = now;
      eng.lastSpeedUpdateTime = now;
      const p: TransferProgress = {
        role,
        filename,
        pct: 0,
        speed: "Calculating speed...",
        eta: "ETA: --",
        sizeText: totalBytes > 0 ? `0 B / ${formatFileSize(totalBytes)}` : "",
      };
      eng.lastProgress = p;
      setProgress(p);
      return;
    }

    const pct = calculateReceivePercent(currentBytes, totalBytes);
    if (now - eng.lastSpeedUpdateTime < 500 && currentBytes < totalBytes) {
      if (eng.lastProgress) {
        const p = { ...eng.lastProgress, pct };
        eng.lastProgress = p;
        setProgress(p);
      }
      return;
    }

    const timeElapsed = (now - eng.transferStartTime) / 1000;
    if (timeElapsed <= 0) return;

    const speedBps = currentBytes / timeElapsed;
    const speedMBps = (speedBps / (1024 * 1024)).toFixed(2);
    const etaSeconds = Math.round((totalBytes - currentBytes) / speedBps);

    const p: TransferProgress = {
      role,
      filename,
      pct,
      speed: `${speedMBps} MB/s`,
      eta: `ETA: ${formatEta(etaSeconds)}`,
      sizeText: totalBytes > 0 ? `${formatFileSize(currentBytes)} / ${formatFileSize(totalBytes)}` : "",
    };
    eng.lastProgress = p;
    setProgress(p);
    eng.lastSpeedUpdateTime = now;
  }

  function clearProgressIfIdle() {
    if (!eng.isSending && !eng.isReceiving) {
      eng.lastProgress = null;
      setProgress(null);
    }
  }

  function prepareNextFile() {
    if (eng.currentFileIndex < eng.fileQueue.length) {
      eng.fileData = eng.fileQueue[eng.currentFileIndex];
      eng.currentChunk = 0;
      eng.chunksInFlight = 0;
      eng.isProcessingQueue = false;
      syncQueue();
      return true;
    }
    syncQueue();
    return false;
  }

  function sendFileMetadata() {
    const conn = connRef.current;
    const file = eng.fileData;
    if (!conn || !file) return;
    eng.isSending = true;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    updateTransferAnalytics("send", file.name, 0, file.size);
    conn.send(`${FILENAME_PREFIX + file.name}`);
    conn.send(`bytes:${file.size}`);
    conn.send(`size:${totalChunks}`);
    syncQueue();
  }

  function tryStartSending() {
    const conn = connRef.current;
    if (!eng.guestConfirmed) return false;
    if (!conn || !conn.open || eng.isSending || eng.isReceiving) return false;
    if (eng.currentFileIndex >= eng.fileQueue.length) return false;
    if (!prepareNextFile()) return false;
    sendFileMetadata();
    return true;
  }

  // Pipelined chunk sender: push up to PIPELINE_WINDOW chunks without waiting for
  // individual acks. The receiver still sends "next" per chunk for flow control,
  // but we have multiple in-flight so RTT doesn't bottleneck throughput.
  async function sendNextFileChunk() {
    if (!eng.isSending) return;
    if (eng.chunksInFlight > 0) eng.chunksInFlight--;

    if (eng.isProcessingQueue) return;
    eng.isProcessingQueue = true;

    try {
      const conn = connRef.current;
      const file = eng.fileData;
      if (!conn || !file) return;
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

      while (eng.isSending && eng.chunksInFlight < PIPELINE_WINDOW && eng.currentChunk < totalChunks) {
        const idx = eng.currentChunk;
        eng.currentChunk++;
        eng.chunksInFlight++;

        const start = idx * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const arrayBuffer = await file.slice(start, end).arrayBuffer();

        // The transfer may have been cancelled/rejected while we were reading
        // from disk — don't send a stray chunk or resurrect the progress card.
        if (!eng.isSending || eng.fileData !== file) return;

        conn.send({ index: idx, data: arrayBuffer });
        updateTransferAnalytics("send", file.name, Math.min(eng.currentChunk * CHUNK_SIZE, file.size), file.size);
      }

      if (eng.isSending && eng.currentChunk >= totalChunks && eng.chunksInFlight === 0) {
        conn.send("done");
      }
    } finally {
      eng.isProcessingQueue = false;
    }
  }

  // Remove the in-flight file from the queue without marking it done —
  // used when the transfer is cancelled by either side.
  function dropCurrentFile() {
    eng.isSending = false;
    eng.fileQueue.splice(eng.currentFileIndex, 1);
    eng.currentChunk = 0;
    eng.chunksInFlight = 0;
    eng.isProcessingQueue = false;
    clearProgressIfIdle();
    tryStartSending();
    syncQueue();
  }

  function moveToNextFile() {
    eng.currentFileIndex++;
    if (prepareNextFile()) {
      sendFileMetadata();
    } else {
      eng.isSending = false;
      connRef.current?.send("all_done");
      eng.currentChunk = 0;
      eng.chunksInFlight = 0;
      eng.isProcessingQueue = false;
      clearProgressIfIdle();
      syncQueue();
      setDonateHint(true);
    }
  }

  function resetReceiveState() {
    eng.isReceiving = false;
    eng.incomingFilePending = false;
    eng.incomingFilename = "";
    eng.incomingTotalBytes = 0;
    eng.incomingTotalChunks = 0;
    eng.receivedChunks = [];
    eng.streamWriter?.abort();
    eng.streamWriter = null;
    setIncoming(null);
    setReceivingActive(false);
    clearProgressIfIdle();
  }

  function handleDownloadError(error: unknown) {
    console.error("An error occurred during the file transfer: ", error);
    showToast("File transfer error", "error");
    eng.isSending = false;
    resetReceiveState();
    eng.currentChunk = 0;
    eng.chunksInFlight = 0;
    eng.isProcessingQueue = false;
    eng.lastProgress = null;
    setProgress(null);
  }

  function handleData(data: unknown) {
    try {
      const msg = data as any;
      if (typeof msg === "object" && msg !== null && msg.type === "chat") {
        appendChat("peer", String(msg.text));
      } else if (typeof msg === "string" && msg.startsWith(FILENAME_PREFIX)) {
        const base = msg.slice(FILENAME_PREFIX.length).split(/[/\\]/).pop() || "file";
        eng.incomingFilename = base.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 180) || "file";
        eng.incomingFilePending = true;
        eng.incomingTotalBytes = 0;
        eng.incomingTotalChunks = 0;
        eng.downloadInitiated = false;
        eng.receivedChunks = [];
      } else if (typeof msg === "string" && msg.startsWith("bytes:")) {
        const bytes = parseInt(msg.slice(6), 10);
        if (!isNaN(bytes) && bytes >= 0) eng.incomingTotalBytes = bytes;
      } else if (typeof msg === "string" && msg.startsWith("size:")) {
        const totalChunks = parseInt(msg.slice(5), 10);
        if (!isNaN(totalChunks) && totalChunks >= 0) {
          if (totalChunks > 100_000) {
            showToast("That file is too large to accept", "error");
            return;
          }
          eng.incomingTotalChunks = totalChunks;
          const totalBytes = eng.incomingTotalBytes || totalChunks * CHUNK_SIZE;
          eng.receivedChunks = new Array(totalChunks);
          setIncoming({
            filename: eng.incomingFilename,
            sizeLabel: formatFileSize(totalBytes),
            iconType: getFileIconType(eng.incomingFilename),
          });
        }
      } else if (msg === "allowed") {
        eng.guestConfirmed = true;
        setTransferAllowed(true);
        setAwaitingGuest(false);
        tryStartSending();
      } else if (msg === "next") {
        // Only the sender role handles "next" — ignore if we're not sending
        if (eng.isSending) void sendNextFileChunk();
      } else if (msg === "reject") {
        showToast("Receiver rejected the file", "error");
        dropCurrentFile();
      } else if (msg === "file_received") {
        if (eng.fileData) appendLog(eng.fileData.name, eng.fileData.size);
        moveToNextFile();
      } else if (msg === "cancel_transfer") {
        eng.downloadInitiated = true;
        showToast("Sender cancelled the transfer", "info");
        resetReceiveState();
        tryStartSending();
      } else if (msg === "all_done") {
        clearProgressIfIdle();
        showToast("Peer finished sending", "success");
        tryStartSending();
      } else if (msg === "done" && eng.isReceiving && !eng.downloadInitiated) {
        showToast(`Downloaded: ${eng.incomingFilename}`, "success");
        appendLog(eng.incomingFilename, eng.incomingTotalBytes);
        if (eng.streamWriter) {
          // Streaming path: chunks already went to disk, just finalize.
          eng.streamWriter.close();
          eng.streamWriter = null;
        } else {
          const file = new Blob(eng.receivedChunks);
          const url = URL.createObjectURL(file);
          const a = document.createElement("a");
          a.href = url;
          a.download = eng.incomingFilename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          // iOS Safari ignores a.click() — show persistent link as fallback
          setManualDownload({ url, name: eng.incomingFilename });
          setTimeout(() => URL.revokeObjectURL(url), 60000);
        }
        eng.downloadInitiated = true;
        connRef.current?.send("file_received");
        setDonateHint(true);
        resetReceiveState();
        tryStartSending();
      } else if (typeof msg === "object" && msg !== null && msg.index !== undefined) {
        if (!eng.isReceiving) return;
        const chunkBytes = msg.data.byteLength;
        if (eng.streamWriter) {
          // DataChannel is reliable+ordered, so chunks arrive in index order —
          // safe to stream sequentially to disk without buffering.
          eng.streamWriter.write(msg.data);
        } else {
          eng.receivedChunks[msg.index] = msg.data;
        }
        const totalBytes = eng.incomingTotalBytes || eng.incomingTotalChunks * CHUNK_SIZE;
        const receivedBytes = calculateReceivedBytes(msg.index, chunkBytes, CHUNK_SIZE, totalBytes);
        updateTransferAnalytics("receive", eng.incomingFilename, receivedBytes, totalBytes);
        connRef.current?.send("next");
      }
    } catch (error) {
      handleDownloadError(error);
    }
  }

  function enterConnectedUI(toastMsg: string) {
    setConnected(true);
    setConnectionLost(false);
    setShowPinEntry(false);
    setShowShare(false);
    setShowHelp(false);
    setSpinner(false);
    showToast(toastMsg, "success");
    if (eng.guestConfirmed) tryStartSending();
    syncQueue();
  }

  function handleConnClose() {
    eng.isSending = false;
    resetReceiveState();
    eng.currentChunk = 0;
    eng.chunksInFlight = 0;
    eng.isProcessingQueue = false;
    eng.lastProgress = null;
    setProgress(null);
    connRef.current = null;
    setConnected(false);

    if (eng.roomId && eng.reconnectAttempt < 3) {
      const delays = [2000, 4000, 8000];
      const delay = delays[eng.reconnectAttempt];
      eng.reconnectAttempt++;
      showToast(`Reconnecting... attempt ${eng.reconnectAttempt}/3`, "info");
      eng.reconnectTimer = setTimeout(() => attemptReconnect(handleConnClose), delay);
    } else {
      eng.reconnectAttempt = 0;
      showToast("Connection lost.", "error");
      setConnectionLost(true);
      setShowPinEntry(true);
      if (!eng.hasPeerParam && eng.fileQueue.length > 0) setShowShare(true);
    }
  }

  function joinRoom(roomId: string, onGiveUp?: () => void) {
    sessionRef.current?.close();
    connRef.current = null;
    const session = startSession(roomId, {
      onLink(link, role) {
        connRef.current = link;
        eng.roomId = roomId;
        eng.remotePeerId = roomId;
        eng.reconnectAttempt = 0;
        eng.guestConfirmed = false;
        setPinConnecting(false);
        setTransferAllowed(false);
        setAwaitingGuest(role === "host");
        setRole(role);
        if (role === "guest") {
          const isDrop = utils.parseDropModeMarker(new URLSearchParams(window.location.search).get("mode"));
          history.replaceState(null, "", utils.buildDropPersistUrl(window.location.pathname, isDrop));
        }
        enterConnectedUI(role === "host" ? "Check the code, then allow the sender" : "Connected. Waiting to be allowed.");
      },
      onSafetyCode(code) {
        setSafetyCode(code);
      },
      onClose() {
        handleConnClose();
      },
      onFail(message) {
        showToast(message, "error");
        setSpinner(false);
        if (onGiveUp) onGiveUp();
        else if (eng.hasPeerParam) {
          setShowHelp(true);
          setShowPinEntry(true);
        }
      },
    });
    session.onData = handleData;
    sessionRef.current = session;
  }

  function attemptReconnect(onFail: () => void) {
    if (!eng.roomId || eng.destroyed) {
      onFail();
      return;
    }
    joinRoom(eng.roomId, onFail);
  }

  // Manual retry after reconnect attempts are exhausted — reuses the same
  // target peer id so a drop-mode contributor (no PIN entry UI) can recover.
  function retryConnection() {
    if (!eng.roomId) return;
    setConnectionLost(false);
    showToast("Reconnecting...", "info");
    attemptReconnect(() => {
      showToast("Connection lost.", "error");
      setConnectionLost(true);
    });
  }

  function publishRoom(id: string) {
    setPin(id);
    eng.roomId = id;
    eng.remotePeerId = id;
    setDropMode(true);
    setDropRole("host");
    const link = utils.buildShareUrl(window.location.origin, window.location.pathname, id, "drop");
    setShareUrl(link);
    setShowShare(true);
    QRCode.toDataURL(link, {
      width: 200,
      margin: 1,
      color: { dark: "#0A0A0B", light: "#ffffff" },
    })
      .then(setQrDataUrl)
      .catch(() => {});
  }

  useEffect(() => {
    eng.destroyed = false;
    const searchParams = new URLSearchParams(window.location.search);
    const peerIdParam = searchParams.get("peer");
    eng.hasPeerParam = !!peerIdParam;
    if (peerIdParam) {
      if (!utils.validateRoomId(peerIdParam)) {
        showToast("This link is not a DirectDrop room.", "error");
        return;
      }
      const isDrop = utils.parseDropModeMarker(searchParams.get("mode"));
      if (isDrop) {
        setDropMode(true);
        setDropRole("contributor");
      }
      setShowShare(false);
      setShowPinEntry(false);
      setShowHelp(false);
      setSpinner(true);
      joinRoom(peerIdParam);
    } else {
      const id = generateRoomId();
      publishRoom(id);
      joinRoom(id);
    }
    return () => {
      eng.destroyed = true;
      if (eng.reconnectTimer) clearTimeout(eng.reconnectTimer);
      sessionRef.current?.close();
      sessionRef.current = null;
      connRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    probeStreamDownload()
      .then(setStreamOk)
      .catch(() => setStreamOk(false));
  }, []);

  // Warn before closing/reloading mid-transfer — a closed tab silently kills
  // an in-flight WebRTC transfer with no way to resume.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!eng.isSending && !eng.isReceiving) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Surface transfer progress in the tab title so it's visible when backgrounded.
  useEffect(() => {
    defaultTitleRef.current = document.title;
  }, []);

  useEffect(() => {
    if (!progress) {
      document.title = defaultTitleRef.current;
      return;
    }
    const verb = progress.role === "send" ? "Sending" : "Receiving";
    document.title = `(${Math.round(progress.pct)}%) ${verb} ${progress.filename}`;
    return () => {
      document.title = defaultTitleRef.current;
    };
  }, [progress]);

  // ---- actions exposed to the UI ----

  function addFiles(files: FileList | File[]) {
    const newFiles = Array.from(files);
    if (newFiles.length === 0) return;

    eng.fileQueue.push(...newFiles);
    if (connRef.current?.open) {
      if (!tryStartSending()) syncQueue();
    } else if (eng.currentFileIndex === 0 && eng.fileQueue.length === newFiles.length) {
      prepareNextFile();
    } else {
      syncQueue();
    }
  }

  function connectToRoom(value: string) {
    const roomId = utils.parseRoomInput(value);
    if (!roomId) {
      showToast("Paste a DirectDrop link.", "error");
      return;
    }
    if (connRef.current?.open) {
      showToast("Already connected to a peer", "info");
      return;
    }
    setPinConnecting(true);
    eng.hasPeerParam = true;
    setShowShare(false);
    joinRoom(roomId, () => setPinConnecting(false));
  }

  function sendChat(text: string) {
    const msg = text.trim();
    const conn = connRef.current;
    if (msg && conn && conn.open) {
      appendChat("you", msg);
      conn.send({ type: "chat", text: msg });
      return true;
    }
    return false;
  }

  async function acceptIncoming() {
    if (!eng.incomingFilePending) return;
    eng.incomingFilePending = false;
    eng.isReceiving = true;
    setIncoming(null);
    setReceivingActive(true);
    const totalBytes = eng.incomingTotalBytes || eng.incomingTotalChunks * CHUNK_SIZE;
    // Stream straight to disk when service workers are available; falls back
    // to in-memory Blob assembly otherwise (private windows, old browsers).
    const writer = await createStreamDownload(eng.incomingFilename, eng.incomingTotalBytes);
    if (!eng.isReceiving) {
      // Cancelled or disconnected while the stream was being set up.
      writer?.abort();
      return;
    }
    eng.streamWriter = writer;
    console.log(writer ? "[dd] streaming download to disk" : "[dd] fallback: buffering in memory");
    updateTransferAnalytics("receive", eng.incomingFilename, 0, totalBytes);
    connRef.current?.send("next");
  }

  function abortReceive(isMidTransfer: boolean) {
    if (!eng.isReceiving && !eng.incomingFilePending) return;
    eng.downloadInitiated = true;
    connRef.current?.send("reject");
    resetReceiveState();
    if (isMidTransfer) showToast("Download cancelled", "info");
    tryStartSending();
  }

  function rejectIncoming() {
    abortReceive(false);
  }

  function cancelActiveReceive() {
    abortReceive(true);
  }

  function cancelFileAt(index: number) {
    const isCurrent = index === eng.currentFileIndex;
    if (isCurrent && connRef.current?.open && eng.isSending) {
      connRef.current.send("cancel_transfer");
      showToast(`Cancelled: ${eng.fileQueue[index].name}`, "info");
      dropCurrentFile();
    } else if (index > eng.currentFileIndex) {
      showToast(`Removed: ${eng.fileQueue[index].name}`, "info");
      eng.fileQueue.splice(index, 1);
      syncQueue();
    }
  }

  function confirmGuest() {
    if (!connRef.current?.open) return;
    eng.guestConfirmed = true;
    setAwaitingGuest(false);
    setTransferAllowed(true);
    connRef.current.send("allowed");
    tryStartSending();
  }

  function shareOrCopyLink() {
    if (!shareUrl) return;
    if (navigator.share) {
      navigator.share({ title: "DirectDrop", url: shareUrl }).catch(() => { });
    } else {
      navigator.clipboard
        .writeText(shareUrl)
        .then(() => showToast("Link copied!", "success"))
        .catch(() => showToast("Copy failed", "error"));
    }
  }

  const queueDrained = queue.length > 0 && queue.every((q) => q.status === "done");
  const needsManualSaveHint = incoming !== null && streamOk !== true;

  return {
    pin,
    shareUrl,
    qrDataUrl,
    showPinEntry,
    showShare,
    showHelp,
    showSpinner,
    connected,
    pinConnecting,
    queue,
    queueDrained,
    progress,
    receivingActive,
    incoming,
    needsManualSaveHint,
    chat,
    toasts,
    log,
    manualDownload,
    role,
    dropMode,
    dropRole,
    connectionLost,
    awaitingGuest,
    transferAllowed,
    safetyCode,
    retryConnection,
    confirmGuest,
    donateHint,
    dismissDonate: () => setDonateHint(false),
    addFiles,
    connectToRoom,
    sendChat,
    acceptIncoming,
    rejectIncoming,
    cancelActiveReceive,
    cancelFileAt,
    shareOrCopyLink,
  };
}
