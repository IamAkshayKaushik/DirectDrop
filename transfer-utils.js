const CHUNK_SIZE = 64 * 1024;

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

const api = {
  CHUNK_SIZE,
  formatFileSize,
  calculateReceivedBytes,
  calculateReceivePercent,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = api;
} else {
  globalThis.DirectDropTransfer = api;
}
