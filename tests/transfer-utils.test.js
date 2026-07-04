const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
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
  CHUNK_SIZE,
  PIPELINE_WINDOW,
} = require("../lib/transfer-utils.js");

// ── formatFileSize ──────────────────────────────────────────────────────────

describe("formatFileSize", () => {
  it("formats 0 bytes", () => {
    assert.equal(formatFileSize(0), "0 B");
  });
  it("formats bytes under 1 KB", () => {
    assert.equal(formatFileSize(512), "512 B");
    assert.equal(formatFileSize(1023), "1023 B");
  });
  it("formats exactly 1 KB", () => {
    assert.equal(formatFileSize(1024), "1.0 KB");
  });
  it("formats fractional KB", () => {
    assert.equal(formatFileSize(1536), "1.5 KB");
  });
  it("formats exactly 1 MB", () => {
    assert.equal(formatFileSize(1024 * 1024), "1.00 MB");
  });
  it("formats fractional MB", () => {
    assert.equal(formatFileSize(2.5 * 1024 * 1024), "2.50 MB");
  });
  it("1 byte below 1 MB is still KB", () => {
    assert.match(formatFileSize(1024 * 1024 - 1), /KB$/);
  });
  // ponytail: no GB tier — files over ~1 TB would show e.g. "1048576.00 MB"
  it("large file shows MB (no GB tier)", () => {
    assert.match(formatFileSize(1024 * 1024 * 1024), /MB$/);
  });
});

// ── calculateReceivedBytes ──────────────────────────────────────────────────

describe("calculateReceivedBytes", () => {
  it("first partial chunk from index 0", () => {
    assert.equal(calculateReceivedBytes(0, 1000, CHUNK_SIZE, 5000), 1000);
  });
  it("full chunks plus current chunk", () => {
    assert.equal(
      calculateReceivedBytes(2, CHUNK_SIZE, CHUNK_SIZE, 200000),
      3 * CHUNK_SIZE
    );
  });
  it("caps at totalBytes on last partial chunk", () => {
    const totalBytes = CHUNK_SIZE * 3 + 100;
    assert.equal(calculateReceivedBytes(3, 100, CHUNK_SIZE, totalBytes), totalBytes);
  });
  it("caps at totalBytes when chunk would overflow", () => {
    // chunkIndex * chunkSize + chunkByteLength > totalBytes
    assert.equal(calculateReceivedBytes(0, 9999, CHUNK_SIZE, 5000), 5000);
  });
  it("returns 0 for empty first chunk", () => {
    assert.equal(calculateReceivedBytes(0, 0, CHUNK_SIZE, 5000), 0);
  });
});

// ── calculateReceivePercent ─────────────────────────────────────────────────

describe("calculateReceivePercent", () => {
  it("0 bytes → 0%", () => {
    assert.equal(calculateReceivePercent(0, 1000), 0);
  });
  it("complete transfer → 100%", () => {
    assert.equal(calculateReceivePercent(1000, 1000), 100);
  });
  it("never exceeds 100", () => {
    assert.equal(calculateReceivePercent(1500, 1000), 100);
  });
  it("50% midpoint", () => {
    assert.equal(calculateReceivePercent(500, 1000), 50);
  });
  it("1% at start of large file", () => {
    assert.equal(calculateReceivePercent(1, 100), 1);
  });
});

// ── shouldShowProgressBar ───────────────────────────────────────────────────

describe("shouldShowProgressBar", () => {
  it("shows when sending", () => {
    assert.equal(shouldShowProgressBar(true, false), true);
  });
  it("shows when receiving", () => {
    assert.equal(shouldShowProgressBar(false, true), false === false && true);
  });
  it("hidden when idle", () => {
    assert.equal(shouldShowProgressBar(false, false), false);
  });
  it("shows when both flags set (edge case)", () => {
    assert.equal(shouldShowProgressBar(true, true), true);
  });
});

// ── validatePin ─────────────────────────────────────────────────────────────

describe("validatePin", () => {
  it("accepts exactly 6 digits", () => {
    assert.equal(validatePin("123456"), true);
  });
  it("accepts leading zeros", () => {
    assert.equal(validatePin("000000"), true);
  });
  it("rejects 5 digits", () => {
    assert.equal(validatePin("12345"), false);
  });
  it("rejects 7 digits", () => {
    assert.equal(validatePin("1234567"), false);
  });
  it("rejects alpha chars", () => {
    assert.equal(validatePin("12345a"), false);
  });
  it("rejects mixed alphanumeric", () => {
    assert.equal(validatePin("abc123"), false);
  });
  it("rejects empty string", () => {
    assert.equal(validatePin(""), false);
  });
  it("rejects null", () => {
    assert.equal(validatePin(null), false);
  });
  it("rejects number type (must be string)", () => {
    assert.equal(validatePin(123456), false);
  });
  it("rejects PIN with spaces", () => {
    assert.equal(validatePin("123 45"), false);
  });
  it("rejects PIN with symbols", () => {
    assert.equal(validatePin("12-456"), false);
  });
});

// ── generatePin ─────────────────────────────────────────────────────────────

describe("generatePin", () => {
  it("generates a string", () => {
    assert.equal(typeof generatePin(), "string");
  });
  it("generates exactly 6 characters", () => {
    for (let i = 0; i < 20; i++) {
      assert.equal(generatePin().length, 6);
    }
  });
  it("result passes validatePin", () => {
    for (let i = 0; i < 20; i++) {
      assert.equal(validatePin(generatePin()), true);
    }
  });
  it("numeric range [100000, 999999]", () => {
    for (let i = 0; i < 50; i++) {
      const n = parseInt(generatePin(), 10);
      assert.ok(n >= 100000 && n <= 999999, `out of range: ${n}`);
    }
  });
});

// ── formatEta ───────────────────────────────────────────────────────────────

describe("formatEta", () => {
  it("0 seconds", () => {
    assert.equal(formatEta(0), "0s");
  });
  it("sub-minute", () => {
    assert.equal(formatEta(45), "45s");
  });
  it("exactly 60 stays as seconds (boundary: > 60, not >= 60)", () => {
    assert.equal(formatEta(60), "60s");
  });
  it("61 seconds formats as minutes", () => {
    assert.equal(formatEta(61), "1m 1s");
  });
  it("90 seconds → 1m 30s", () => {
    assert.equal(formatEta(90), "1m 30s");
  });
  it("exactly 2 minutes", () => {
    assert.equal(formatEta(120), "2m 0s");
  });
  it("large value (no hours tier)", () => {
    // 3661s = 61m 1s, not 1h 1m 1s
    assert.equal(formatEta(3661), "61m 1s");
  });
});

// ── calculateTotalChunks ────────────────────────────────────────────────────

describe("calculateTotalChunks", () => {
  it("zero-byte file → 0 chunks", () => {
    assert.equal(calculateTotalChunks(0, CHUNK_SIZE), 0);
  });
  it("1 byte → 1 chunk", () => {
    assert.equal(calculateTotalChunks(1, CHUNK_SIZE), 1);
  });
  it("exactly 1 chunk size → 1 chunk", () => {
    assert.equal(calculateTotalChunks(CHUNK_SIZE, CHUNK_SIZE), 1);
  });
  it("1 byte over chunk size → 2 chunks", () => {
    assert.equal(calculateTotalChunks(CHUNK_SIZE + 1, CHUNK_SIZE), 2);
  });
  it("large file divides evenly", () => {
    assert.equal(calculateTotalChunks(CHUNK_SIZE * 100, CHUNK_SIZE), 100);
  });
  it("large file with remainder", () => {
    assert.equal(calculateTotalChunks(CHUNK_SIZE * 100 + 1, CHUNK_SIZE), 101);
  });
  it("uses CHUNK_SIZE default when not provided", () => {
    assert.equal(calculateTotalChunks(CHUNK_SIZE), 1);
  });
});

// ── calculateChunkRange ─────────────────────────────────────────────────────

describe("calculateChunkRange", () => {
  const CS = 1000; // small chunk size for easy arithmetic

  it("first chunk starts at 0", () => {
    const r = calculateChunkRange(0, 5000, CS);
    assert.equal(r.start, 0);
    assert.equal(r.end, CS);
  });
  it("second chunk starts at chunkSize", () => {
    const r = calculateChunkRange(1, 5000, CS);
    assert.equal(r.start, CS);
    assert.equal(r.end, 2 * CS);
  });
  it("last full chunk ends at fileSize boundary", () => {
    const r = calculateChunkRange(4, 5000, CS);
    assert.equal(r.start, 4000);
    assert.equal(r.end, 5000);
  });
  it("last partial chunk is capped at fileSize", () => {
    // fileSize = 4500, idx 4 → start=4000, end=min(5000,4500)=4500
    const r = calculateChunkRange(4, 4500, CS);
    assert.equal(r.start, 4000);
    assert.equal(r.end, 4500);
  });
  it("single-byte file, idx 0", () => {
    const r = calculateChunkRange(0, 1, CS);
    assert.equal(r.start, 0);
    assert.equal(r.end, 1);
  });
  it("uses CHUNK_SIZE default when not provided", () => {
    const r = calculateChunkRange(0, CHUNK_SIZE * 2);
    assert.equal(r.start, 0);
    assert.equal(r.end, CHUNK_SIZE);
  });
});

// ── getFileIconType ─────────────────────────────────────────────────────────

describe("getFileIconType", () => {
  it("png → image", () => assert.equal(getFileIconType("photo.png"), "image"));
  it("jpg → image", () => assert.equal(getFileIconType("img.jpg"), "image"));
  it("gif → image", () => assert.equal(getFileIconType("anim.gif"), "image"));
  it("svg → image", () => assert.equal(getFileIconType("icon.svg"), "image"));
  it("webp → image", () => assert.equal(getFileIconType("hero.webp"), "image"));
  it("uppercase PNG → image (case-insensitive)", () => {
    assert.equal(getFileIconType("PHOTO.PNG"), "image");
  });
  it("zip → archive", () => assert.equal(getFileIconType("bundle.zip"), "archive"));
  it("tar.gz → archive (gz extension wins)", () => {
    assert.equal(getFileIconType("archive.tar.gz"), "archive");
  });
  it("7z → archive", () => assert.equal(getFileIconType("file.7z"), "archive"));
  it("js → code", () => assert.equal(getFileIconType("app.js"), "code"));
  it("json → code", () => assert.equal(getFileIconType("config.json"), "code"));
  it("md → code", () => assert.equal(getFileIconType("README.md"), "code"));
  it("txt → code", () => assert.equal(getFileIconType("notes.txt"), "code"));
  it("csv → code", () => assert.equal(getFileIconType("data.csv"), "code"));
  it("unknown extension → generic", () => {
    assert.equal(getFileIconType("file.xyz"), "generic");
  });
  it("no extension → generic", () => {
    assert.equal(getFileIconType("Makefile"), "generic");
  });
  it("dotfile with no real extension → generic", () => {
    // '.gitignore' → split('.') = ['', 'gitignore'] → ext = 'gitignore'
    assert.equal(getFileIconType(".gitignore"), "generic");
  });
  it("empty filename → generic", () => {
    assert.equal(getFileIconType(""), "generic");
  });
  it("multiple dots — rightmost extension wins", () => {
    // 'my.file.tar.gz' → ext = 'gz' → archive
    assert.equal(getFileIconType("my.file.tar.gz"), "archive");
  });
});

// ── shouldThrottleUpdate ────────────────────────────────────────────────────

describe("shouldThrottleUpdate", () => {
  it("throttles when < 500ms elapsed and transfer incomplete", () => {
    assert.equal(shouldThrottleUpdate(1000, 700, 500, 1000), true);
  });
  it("does not throttle when >= 500ms elapsed", () => {
    assert.equal(shouldThrottleUpdate(1000, 500, 500, 1000), false);
  });
  it("does not throttle when transfer complete (currentBytes === totalBytes)", () => {
    // Last update is recent but transfer is done — must update
    assert.equal(shouldThrottleUpdate(1000, 900, 1000, 1000), false);
  });
  it("does not throttle when currentBytes > totalBytes (overflow guard)", () => {
    assert.equal(shouldThrottleUpdate(1000, 900, 1500, 1000), false);
  });
  it("exactly 499ms — still throttles", () => {
    assert.equal(shouldThrottleUpdate(1000, 501, 500, 1000), true);
  });
  it("exactly 500ms — does NOT throttle (boundary: < 500, not <=)", () => {
    assert.equal(shouldThrottleUpdate(1000, 500, 500, 1000), false);
  });
  it("0 bytes — throttles if started immediately", () => {
    // 0 < 1000, and now - last < 500
    assert.equal(shouldThrottleUpdate(100, 50, 0, 1000), true);
  });
});

// ── constants ───────────────────────────────────────────────────────────────

describe("constants", () => {
  it("CHUNK_SIZE is 64 KB", () => {
    assert.equal(CHUNK_SIZE, 64 * 1024);
  });
  it("PIPELINE_WINDOW is 8", () => {
    assert.equal(PIPELINE_WINDOW, 8);
  });
});
