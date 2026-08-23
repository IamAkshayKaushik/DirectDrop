/*
 * Client side of the streaming-download service worker (public/sw.js).
 * createStreamDownload() returns a writer that pipes chunks straight to the
 * browser's download manager, or null when service workers are unavailable
 * (private windows, unsupported browsers) — callers fall back to Blob assembly.
 */

export type StreamWriter = {
  write: (chunk: ArrayBuffer | Uint8Array) => void;
  close: () => void;
  abort: () => void;
};

let swReady: Promise<ServiceWorker | null> | null = null;
// Cached result of probeStreamDownload — null until first probe.
let streamDownloadOk: boolean | null = null;

function getWorker(): Promise<ServiceWorker | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.resolve(null);
  }
  if (!swReady) {
    swReady = navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => reg.active)
      .catch(() => null);
  }
  return swReady;
}

/** Sync gate: browser exposes service workers (required for streaming path). */
export function isStreamDownloadSupported(): boolean {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator;
}

/** Probes whether the SW streaming path actually works; result is cached. */
export async function probeStreamDownload(): Promise<boolean> {
  if (streamDownloadOk !== null) return streamDownloadOk;
  if (!isStreamDownloadSupported()) {
    streamDownloadOk = false;
    return false;
  }
  const sw = await getWorker();
  streamDownloadOk = sw !== null;
  return streamDownloadOk;
}

export async function createStreamDownload(filename: string, size: number): Promise<StreamWriter | null> {
  const sw = await getWorker();
  if (!sw) return null;

  const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const channel = new MessageChannel();

  // Handshake: the SW must have the stream registered before the iframe
  // fetches /dl/<id>, and postMessage is async — so wait for its ack.
  const ready = new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), 3000);
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "stream-ready" && e.data.id === id) {
        clearTimeout(timer);
        navigator.serviceWorker.removeEventListener("message", onMsg);
        resolve(true);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
  });
  sw.postMessage({ type: "stream", id, filename, size }, [channel.port2]);
  if (!(await ready)) return null;

  const iframe = document.createElement("iframe");
  iframe.hidden = true;
  iframe.src = `/dl/${id}`;
  document.body.appendChild(iframe);

  // Browsers kill idle service workers after ~30s; any message resets the timer.
  const keepalive = setInterval(() => sw.postMessage({ type: "ping" }), 10000);
  let finished = false;
  const finish = () => {
    if (finished) return true;
    finished = true;
    clearInterval(keepalive);
    setTimeout(() => iframe.remove(), 5000);
    return false;
  };

  const port = channel.port1;
  return {
    // PeerJS delivers Uint8Array views, which aren't transferable — structured
    // clone instead (a 64KB copy per chunk, negligible vs network cost).
    write: (chunk) => port.postMessage({ chunk }),
    close: () => {
      if (!finish()) port.postMessage({ done: true });
    },
    abort: () => {
      if (!finish()) port.postMessage({ abort: true });
    },
  };
}
