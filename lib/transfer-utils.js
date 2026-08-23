const CHUNK_SIZE = 64 * 1024;
const PIPELINE_WINDOW = 8;

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function calculateReceivedBytes(chunkIndex, chunkByteLength, chunkSize, totalBytes) {
  return Math.min(chunkIndex * chunkSize + chunkByteLength, totalBytes);
}

function calculateReceivePercent(receivedBytes, totalBytes) {
  return Math.min((receivedBytes / totalBytes) * 100, 100);
}

function shouldShowProgressBar(isSending, isReceiving) {
  return isSending || isReceiving;
}

function validatePin(pin) {
  return typeof pin === "string" && pin.length === 6 && /^\d{6}$/.test(pin);
}

function generatePin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ponytail: no hours tier — etaSeconds > 3600 shows e.g. "70m 0s", add when needed
function formatEta(seconds) {
  if (seconds > 60) {
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

function calculateTotalChunks(fileSize, chunkSize) {
  return Math.ceil(fileSize / (chunkSize || CHUNK_SIZE));
}

function calculateChunkRange(idx, fileSize, chunkSize) {
  const cs = chunkSize || CHUNK_SIZE;
  const start = idx * cs;
  const end = Math.min(start + cs, fileSize);
  return { start, end };
}

function getFileIconType(filename) {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext)) return "image";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "archive";
  if (["js", "html", "css", "json", "md", "txt", "csv"].includes(ext)) return "code";
  return "generic";
}

function shouldThrottleUpdate(now, lastUpdate, currentBytes, totalBytes) {
  return now - lastUpdate < 500 && currentBytes < totalBytes;
}

/** True when URL `mode` param marks a DirectDrop contributor session. */
function parseDropModeMarker(mode) {
  return mode === "drop";
}

/** Build share link; append `mode=drop` only when mode is `"drop"`. */
function buildShareUrl(origin, pathname, pin, mode) {
  const q = new URLSearchParams({ peer: pin });
  if (parseDropModeMarker(mode)) q.set("mode", "drop");
  return `${origin}${pathname}?${q.toString()}`;
}

/** After guest auto-connect: strip `peer`, keep `mode=drop` when active. */
function buildDropPersistUrl(pathname, dropMode) {
  if (!dropMode) return pathname;
  return `${pathname}?mode=drop`;
}

const api = {
  CHUNK_SIZE,
  PIPELINE_WINDOW,
  formatFileSize,
  calculateReceivedBytes,
  calculateReceivePercent,
  shouldShowProgressBar,
  validatePin,
  generatePin,
  formatEta,
  calculateTotalChunks,
  calculateChunkRange,
  getFileIconType,
  shouldThrottleUpdate,
  parseDropModeMarker,
  buildShareUrl,
  buildDropPersistUrl,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = api;
} else {
  globalThis.DirectDropTransfer = api;
}
