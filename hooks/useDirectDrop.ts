"use client";

import { useEffect, useRef, useState } from "react";
import type Peer from "peerjs";
import type { DataConnection } from "peerjs";
import QRCode from "qrcode";
import utils from "@/lib/transfer-utils";

const {
  CHUNK_SIZE,
  PIPELINE_WINDOW,
  formatFileSize,
  calculateReceivedBytes,
  calculateReceivePercent,
  generatePin,
  formatEta,
  getFileIconType,
} = utils;

const FILENAME_PREFIX = "bbb.";

export type ToastItem = { id: number; message: string; type: "success" | "error" | "info" };
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

  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const eng = useRef({
    fileQueue: [] as File[],
    currentFileIndex: 0,
    fileData: null as File | null,
    currentChunk: 0,
    receivedChunks: [] as ArrayBuffer[],
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
  }).current;

  function showToast(message: string, type: ToastItem["type"] = "info") {
    const id = ++nextId;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
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
    }
  }

  function resetReceiveState() {
    eng.isReceiving = false;
    eng.incomingFilePending = false;
    eng.incomingFilename = "";
    eng.incomingTotalBytes = 0;
    eng.incomingTotalChunks = 0;
    eng.receivedChunks = [];
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
        eng.incomingFilePending = true;
        eng.incomingFilename = msg.slice(FILENAME_PREFIX.length);
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
          eng.incomingTotalChunks = totalChunks;
          const totalBytes = eng.incomingTotalBytes || totalChunks * CHUNK_SIZE;
          eng.receivedChunks = new Array(totalChunks);
          setIncoming({
            filename: eng.incomingFilename,
            sizeLabel: formatFileSize(totalBytes),
            iconType: getFileIconType(eng.incomingFilename),
          });
        }
      } else if (msg === "next") {
        // Only the sender role handles "next" — ignore if we're not sending
        if (eng.isSending) void sendNextFileChunk();
      } else if (msg === "reject") {
        showToast("Receiver rejected the file", "error");
        moveToNextFile();
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
        eng.downloadInitiated = true;
        connRef.current?.send("file_received");
        resetReceiveState();
        tryStartSending();
      } else if (typeof msg === "object" && msg !== null && msg.index !== undefined) {
        if (!eng.isReceiving) return;
        eng.receivedChunks[msg.index] = msg.data;
        const totalBytes = eng.incomingTotalBytes || eng.incomingTotalChunks * CHUNK_SIZE;
        const receivedBytes = calculateReceivedBytes(msg.index, msg.data.byteLength, CHUNK_SIZE, totalBytes);
        updateTransferAnalytics("receive", eng.incomingFilename, receivedBytes, totalBytes);
        connRef.current?.send("next");
      }
    } catch (error) {
      handleDownloadError(error);
    }
  }

  function enterConnectedUI(toastMsg: string) {
    setConnected(true);
    setShowPinEntry(false);
    setShowShare(false);
    setShowHelp(false);
    setSpinner(false);
    showToast(toastMsg, "success");
    tryStartSending();
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

    if (eng.remotePeerId && eng.reconnectAttempt < 3) {
      const delays = [2000, 4000, 8000];
      const delay = delays[eng.reconnectAttempt];
      eng.reconnectAttempt++;
      showToast(`Reconnecting... attempt ${eng.reconnectAttempt}/3`, "info");

      eng.reconnectTimer = setTimeout(() => {
        const peer = peerRef.current;
        if (!peer || peer.destroyed) return;
        const conn = peer.connect(eng.remotePeerId!);
        connRef.current = conn;
        conn.on("open", () => {
          eng.reconnectAttempt = 0;
          enterConnectedUI("Reconnected!");
        });
        conn.on("data", handleData);
        conn.on("close", handleConnClose);
        conn.on("error", () => handleConnClose());
      }, delay);
    } else {
      eng.reconnectAttempt = 0;
      eng.remotePeerId = null;
      showToast("Connection lost. Enter PIN to reconnect.", "error");
      setShowPinEntry(true);
      if (!eng.hasPeerParam && eng.fileQueue.length > 0) setShowShare(true);
    }
  }

  function handleInboundConnection(conn: DataConnection) {
    connRef.current = conn;
    conn.on("open", () => {
      eng.remotePeerId = conn.peer;
      eng.reconnectAttempt = 0;
      enterConnectedUI("Peer connected!");
    });
    conn.on("data", handleData);
    conn.on("close", handleConnClose);
  }

  function handlePeerOpen(id: string) {
    setPin(id);

    const peerIdParam = new URLSearchParams(window.location.search).get("peer");
    eng.hasPeerParam = !!peerIdParam;
    if (peerIdParam) {
      setShowShare(false);
      setShowPinEntry(false);
      setShowHelp(false);
      setSpinner(true);

      const connectTimeout = setTimeout(() => {
        showToast("Connection timed out. Peer may be offline.", "error");
        connRef.current?.close();
        connRef.current = null;
        setSpinner(false);
        setShowHelp(true);
        setShowPinEntry(true);
      }, 10000);

      const conn = peerRef.current!.connect(peerIdParam);
      connRef.current = conn;
      conn.on("open", () => {
        clearTimeout(connectTimeout);
        history.replaceState(null, "", window.location.pathname);
        eng.remotePeerId = peerIdParam;
        eng.reconnectAttempt = 0;
        enterConnectedUI("Connected to peer!");
      });
      conn.on("data", handleData);
      conn.on("close", handleConnClose);
      conn.on("error", (err: any) => {
        clearTimeout(connectTimeout);
        const msg =
          err.type === "peer-unavailable"
            ? "No peer found — check the PIN and try again."
            : "Connection failed: " + err.message;
        showToast(msg, "error");
        setSpinner(false);
        setShowHelp(true);
        setShowPinEntry(true);
      });
    } else {
      const link = `${window.location.origin}${window.location.pathname}?peer=${id}`;
      setShareUrl(link);
      setShowShare(true);
      QRCode.toDataURL(link, {
        width: 200,
        margin: 1,
        color: { dark: "#0f172a", light: "#ffffff" },
      })
        .then(setQrDataUrl)
        .catch(() => {});
    }
  }

  async function createPeer() {
    const { default: PeerCtor } = await import("peerjs");
    if (eng.destroyed) return;
    const peer = new PeerCtor(generatePin(), {
      config: {
        // STUN only discovers public IPs — it cannot relay. When both peers sit
        // behind the same NAT (no hairpinning) or symmetric/CG-NAT, a TURN relay
        // is REQUIRED or the datachannel will never connect.
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun.cloudflare.com:3478" },
          // TODO: add a TURN server here, e.g. Metered/Open Relay or Cloudflare
          // Realtime TURN. Example shape:
          // { urls: "turn:your.turn.host:443", username: "...", credential: "..." },
        ],
      },
    });
    peerRef.current = peer;
    peer.on("open", handlePeerOpen);
    peer.on("connection", handleInboundConnection);
    peer.on("disconnected", () => {
      if (!peer.destroyed) {
        showToast("Reconnecting to server...", "info");
        peer.reconnect();
      }
    });
    peer.on("error", (err: any) => {
      if (err.type === "unavailable-id") {
        showToast("PIN collision — regenerating...", "info");
        peer.destroy();
        void createPeer();
      } else {
        showToast("Connection error: " + err.message, "error");
        if (eng.spinnerVisible) {
          setSpinner(false);
          setShowHelp(true);
          setShowPinEntry(true);
        }
      }
    });
  }

  useEffect(() => {
    eng.destroyed = false;
    void createPeer();
    return () => {
      eng.destroyed = true;
      if (eng.reconnectTimer) clearTimeout(eng.reconnectTimer);
      peerRef.current?.destroy();
      peerRef.current = null;
      connRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function connectToPin(value: string) {
    const pinValue = value.trim();
    if (!utils.validatePin(pinValue)) {
      showToast("Please enter a valid 6-digit PIN", "error");
      return;
    }
    if (connRef.current?.open) {
      showToast("Already connected to a peer", "info");
      return;
    }
    setPinConnecting(true);

    const connectTimeout = setTimeout(() => {
      showToast("Connection timed out. Peer may be offline.", "error");
      setPinConnecting(false);
      connRef.current?.close();
      connRef.current = null;
    }, 10000);

    const conn = peerRef.current!.connect(pinValue);
    connRef.current = conn;
    conn.on("open", () => {
      clearTimeout(connectTimeout);
      eng.remotePeerId = pinValue;
      setPinConnecting(false);
      enterConnectedUI("Connected to peer!");
    });
    conn.on("data", handleData);
    conn.on("close", handleConnClose);
    conn.on("error", (err: any) => {
      clearTimeout(connectTimeout);
      setPinConnecting(false);
      const msg =
        err.type === "peer-unavailable"
          ? "No peer found — check the PIN and try again."
          : "Connection failed: " + err.message;
      showToast(msg, "error");
    });
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

  function acceptIncoming() {
    if (!eng.incomingFilePending) return;
    eng.incomingFilePending = false;
    eng.isReceiving = true;
    setIncoming(null);
    setReceivingActive(true);
    const totalBytes = eng.incomingTotalBytes || eng.incomingTotalChunks * CHUNK_SIZE;
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
      eng.isSending = false;
      connRef.current.send("cancel_transfer");
      showToast(`Cancelled: ${eng.fileQueue[index].name}`, "info");
      eng.fileQueue.splice(index, 1);
      eng.currentChunk = 0;
      eng.chunksInFlight = 0;
      eng.isProcessingQueue = false;
      clearProgressIfIdle();
      tryStartSending();
      syncQueue();
    } else if (index > eng.currentFileIndex) {
      showToast(`Removed: ${eng.fileQueue[index].name}`, "info");
      eng.fileQueue.splice(index, 1);
      syncQueue();
    }
  }

  function copyPin() {
    if (!pin) return;
    navigator.clipboard
      .writeText(pin)
      .then(() => showToast("PIN copied!", "success"))
      .catch(() => showToast("Copy failed", "error"));
  }

  function shareOrCopyLink() {
    if (!shareUrl) return;
    if (navigator.share) {
      navigator.share({ title: "DirectDrop", url: shareUrl }).catch(() => {});
    } else {
      navigator.clipboard
        .writeText(shareUrl)
        .then(() => showToast("Link copied!", "success"))
        .catch(() => showToast("Copy failed", "error"));
    }
  }

  const queueDrained = queue.length > 0 && queue.every((q) => q.status === "done");

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
    chat,
    toasts,
    log,
    manualDownload,
    addFiles,
    connectToPin,
    sendChat,
    acceptIncoming,
    rejectIncoming,
    cancelActiveReceive,
    cancelFileAt,
    copyPin,
    shareOrCopyLink,
  };
}
