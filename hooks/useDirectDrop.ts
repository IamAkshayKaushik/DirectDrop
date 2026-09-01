"use client";

import { useEffect, useRef, useState } from "react";
import type Peer from "peerjs";
import type { DataConnection } from "peerjs";
import QRCode from "qrcode";
import utils from "@/lib/transfer-utils";
import { createStreamDownload, probeStreamDownload, type StreamWriter } from "@/lib/stream-download";

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
  const [dropMode, setDropMode] = useState(false);
  const [dropRole, setDropRole] = useState<"host" | "contributor" | null>(null);
  // Streaming-download support probe; null until known. Pessimistic default —
  // show the manual-save hint until we've confirmed the SW path works.
  const [streamOk, setStreamOk] = useState<boolean | null>(null);

  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
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
      eng.reconnectTimer = setTimeout(() => attemptReconnect(handleConnClose), delay);
    } else {
      eng.reconnectAttempt = 0;
      showToast("Connection lost.", "error");
      setConnectionLost(true);
      setShowPinEntry(true);
      if (!eng.hasPeerParam && eng.fileQueue.length > 0) setShowShare(true);
    }
  }

  // Connects once to eng.remotePeerId. peer.connect() can hang forever with
  // no open/close/error if the remote peer id is stale on the signaling
  // server, so this always settles within ATTEMPT_TIMEOUT_MS via onFail.
  const ATTEMPT_TIMEOUT_MS = 5000;
  function attemptReconnect(onFail: () => void) {
    const peer = peerRef.current;
    if (!peer || peer.destroyed || !eng.remotePeerId) {
      onFail();
      return;
    }
    const conn = peer.connect(eng.remotePeerId);
    connRef.current = conn;
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      onFail();
    }, ATTEMPT_TIMEOUT_MS);
    conn.on("open", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      eng.reconnectAttempt = 0;
      enterConnectedUI("Reconnected!");
    });
    conn.on("data", handleData);
    conn.on("close", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      onFail();
    });
    conn.on("error", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      onFail();
    });
  }

  // Manual retry after reconnect attempts are exhausted — reuses the same
  // target peer id so a drop-mode contributor (no PIN entry UI) can recover.
  function retryConnection() {
    if (!eng.remotePeerId) return;
    setConnectionLost(false);
    showToast("Reconnecting...", "info");
    attemptReconnect(() => {
      showToast("Connection lost.", "error");
      setConnectionLost(true);
    });
  }

  function handleInboundConnection(conn: DataConnection) {
    connRef.current = conn;
    conn.on("open", () => {
      eng.remotePeerId = conn.peer;
      eng.reconnectAttempt = 0;
      setRole("host");
      enterConnectedUI("Peer connected!");
    });
    conn.on("data", handleData);
    conn.on("close", handleConnClose);
  }

  function handlePeerOpen(id: string) {
    setPin(id);

    const searchParams = new URLSearchParams(window.location.search);
    const peerIdParam = searchParams.get("peer");
    eng.hasPeerParam = !!peerIdParam;
    if (peerIdParam) {
      const isDrop = utils.parseDropModeMarker(searchParams.get("mode"));
      if (isDrop) {
        setDropMode(true);
        setDropRole("contributor");
      }
      setShowShare(false);
      setShowPinEntry(false);
      setShowHelp(false);
      setSpinner(true);

      const connectTimeout = setTimeout(() => {
        showToast("Couldn't connect — peer may be offline, or this network (mobile data, hotel/office Wi-Fi) may be blocking it.", "error");
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
        history.replaceState(null, "", utils.buildDropPersistUrl(window.location.pathname, isDrop));
        eng.remotePeerId = peerIdParam;
        eng.reconnectAttempt = 0;
        setRole("guest");
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
      setDropMode(true);
      setDropRole("host");
      const link = utils.buildShareUrl(window.location.origin, window.location.pathname, id, "drop");
      setShareUrl(link);
      setShowShare(true);
      QRCode.toDataURL(link, {
        width: 200,
        margin: 1,
        // QR modules in the foreground color on a white card behind them;
        // the card uses bg-white so QR contrast stays high regardless of theme.
        color: { dark: "#0A0A0B", light: "#ffffff" },
      })
        .then(setQrDataUrl)
        .catch(() => { });
    }
  }

  async function createPeer() {
    const { default: PeerCtor } = await import("peerjs");
    if (eng.destroyed) return;
    // STUN only discovers public IPs — it cannot relay. When both peers sit
    // behind the same NAT (no hairpinning) or symmetric/CG-NAT, a TURN relay
    // is REQUIRED or the datachannel will never connect.
    const iceServers: RTCIceServer[] = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun.cloudflare.com:3478" },
      {
        urls: "turn:global.relay.metered.ca:80",
        username: "5c9daad2f3ec33c9b9353772",
        credential: "c3odGSFJiu9Hu2Mr",
      },
      {
        urls: "turn:global.relay.metered.ca:80?transport=tcp",
        username: "5c9daad2f3ec33c9b9353772",
        credential: "c3odGSFJiu9Hu2Mr",
      },
      {
        urls: "turn:global.relay.metered.ca:443",
        username: "5c9daad2f3ec33c9b9353772",
        credential: "c3odGSFJiu9Hu2Mr",
      },
      {
        urls: "turns:global.relay.metered.ca:443?transport=tcp",
        username: "5c9daad2f3ec33c9b9353772",
        credential: "c3odGSFJiu9Hu2Mr",
      },
    ];
    // Set at build time, e.g. Metered/Open Relay or Cloudflare Realtime TURN.
    if (process.env.NEXT_PUBLIC_TURN_URL) {
      iceServers.push({
        urls: process.env.NEXT_PUBLIC_TURN_URL,
        username: process.env.NEXT_PUBLIC_TURN_USERNAME,
        credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
      });
    }
    const peer = new PeerCtor(generatePin(), {
      config: { iceServers },
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
      showToast("Couldn't connect — peer may be offline, or this network (mobile data, hotel/office Wi-Fi) may be blocking it.", "error");
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
      setRole("guest");
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
    retryConnection,
    donateHint,
    dismissDonate: () => setDonateHint(false),
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
