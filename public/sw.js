/*
 * DirectDrop streaming-download service worker.
 *
 * The page registers a stream (id + filename + size) over postMessage with a
 * MessagePort, then navigates a hidden iframe to /dl/<id>. We answer that
 * fetch with a ReadableStream fed chunk-by-chunk from the port, so received
 * files go straight to disk instead of being assembled in RAM.
 */
const streams = new Map(); // id -> { stream, filename, size }

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("message", (e) => {
  const d = e.data || {};
  if (d.type === "stream") {
    const port = e.ports[0];
    const stream = new ReadableStream({
      start(controller) {
        port.onmessage = (ev) => {
          const m = ev.data || {};
          if (m.done) controller.close();
          else if (m.abort) controller.error(new Error("transfer aborted"));
          else if (m.chunk) controller.enqueue(m.chunk instanceof Uint8Array ? m.chunk : new Uint8Array(m.chunk));
        };
      },
    });
    streams.set(d.id, { stream, filename: d.filename, size: d.size });
    if (e.source) e.source.postMessage({ type: "stream-ready", id: d.id });
  }
  // "ping" messages need no handling — receiving any event resets the
  // browser's ~30s service-worker idle-kill timer.
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (!url.pathname.startsWith("/dl/")) return;
  const entry = streams.get(url.pathname.slice(4));
  if (!entry) {
    e.respondWith(new Response("Not found", { status: 404 }));
    return;
  }
  streams.delete(url.pathname.slice(4));
  const headers = {
    "Content-Type": "application/octet-stream",
    "Content-Security-Policy": "default-src 'none'",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "attachment; filename*=UTF-8''" + encodeURIComponent(entry.filename),
  };
  if (entry.size > 0) headers["Content-Length"] = String(entry.size);
  e.respondWith(new Response(entry.stream, { headers }));
});
