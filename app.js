document.addEventListener("DOMContentLoaded", () => {
  const peer = initializePeerConnection();

  let fileQueue = [];
  let currentFileIndex = 0;
  let fileData;
  let fileChunks = [];
  let currentChunk = 0;
  let receivedChunks = [];
  let otherPeer;
  const CHUNK_SIZE = 16 * 1024; // Size of each file chunk in bytes
  const FILENAME_PREFIX = "bbb."; // Prefix for filename messages
  let downloadInitiated = false;
  let receivedSize = 0;
  
  let transferStartTime = 0;
  let lastSpeedUpdateTime = 0;

  const fileInput = document.getElementById("fileInput");
  const progressBar = document.getElementById("progressBar");
  const progressBarInner = document.getElementById("progressBarInner");
  const transferStatsEl = document.getElementById("transferStats");
  const transferEtaEl = document.getElementById("transferEta");
  const shareLink = document.getElementById("shareLink");
  const linkInput = document.getElementById("linkInput");
  const downloadBtn = document.getElementById("downloadBtn");

  fileInput.addEventListener("change", handleFileSelection);

  peer.on("connection", handlePeerConnection);

  downloadBtn.addEventListener("click", initiateFileDownload);

  peer.on("open", handlePeerOpen);

  function initiateFileDownload() {
    otherPeer.send("next");
  }

  function generatePin() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  function initializePeerConnection() {
    const pin = generatePin();
    return new Peer(pin, {
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:freestun.net:3479" },
          { urls: "stun:freestun.net:5350" },
          { urls: "turn:freestun.net:3479", username: "free", credential: "free" },
          { urls: "turn:freestun.net:5350", username: "free", credential: "free" },
        ],
      },
    });
  }

  function prepareNextFile() {
    if (currentFileIndex < fileQueue.length) {
      fileData = fileQueue[currentFileIndex];
      fileChunks = splitFileIntoChunks(fileData);
      currentChunk = 0;
      return true;
    }
    return false;
  }

  function handleFileSelection(e) {
    fileQueue = Array.from(e.target.files);
    currentFileIndex = 0;
    
    if (fileQueue.length > 0) {
      prepareNextFile();
      shareLink.classList.remove("hidden");

      const link = `${window.location.href.split('?')[0]}?peer=${peer.id}`;
      linkInput.value = link;

      // Show & generate QR code
      const qrContainer = document.getElementById("qrContainer");
      qrContainer.classList.remove("hidden");
      // Clear any existing code
      document.getElementById("qrcode").innerHTML = "";
      // Generate new QR
      new QRCode(document.getElementById("qrcode"), {
        text: link,
        width: 200,
        height: 200,
        colorDark: "#000000",
        colorLight: "#ffffff",
      });
    }
  }

  function splitFileIntoChunks(file) {
    const fileReader = new FileReader();
    const chunks = [];
    fileReader.readAsArrayBuffer(file);
    fileReader.onloadend = () => {
      const fileSize = file.size;
      const numberOfChunks = Math.ceil(fileSize / CHUNK_SIZE);

      for (let i = 0; i < numberOfChunks; i++) {
        chunks.push(fileReader.result.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
      }
    };
    return chunks;
  }

  function handlePeerConnection(conn) {
    otherPeer = conn;
    otherPeer.on("open", () => {
      sendFileMetadata();
      progressBar.classList.remove("hidden");
      progressBarInner.style.width = "0%";
    });
    otherPeer.on("data", handleDataReceived);
    otherPeer.on("close", () => {
      resetDownloadState();
    });
  }

  function sendFileMetadata() {
    updateTransferAnalytics(0, fileChunks.length * CHUNK_SIZE);
    otherPeer.send(`${FILENAME_PREFIX + fileData.name}`);
    otherPeer.send(`size:${fileChunks.length.toString()}`);
  }

  function updateTransferAnalytics(currentBytes, totalBytes) {
    const now = Date.now();
    if (currentBytes === 0) {
      transferStartTime = now;
      lastSpeedUpdateTime = now;
      if (transferStatsEl) transferStatsEl.innerText = "Calculating...";
      if (transferEtaEl) transferEtaEl.innerText = "ETA: --";
      return;
    }
    
    if (now - lastSpeedUpdateTime < 500 && currentBytes < totalBytes) return;
    
    const timeElapsed = (now - transferStartTime) / 1000;
    if (timeElapsed <= 0) return;

    const speedBps = currentBytes / timeElapsed;
    const speedMBps = (speedBps / (1024 * 1024)).toFixed(2);
    
    const bytesRemaining = totalBytes - currentBytes;
    const etaSeconds = Math.round(bytesRemaining / speedBps);
    
    let etaString = `${etaSeconds}s`;
    if (etaSeconds > 60) {
      etaString = `${Math.floor(etaSeconds / 60)}m ${etaSeconds % 60}s`;
    }

    if (transferStatsEl) transferStatsEl.innerText = `${speedMBps} MB/s`;
    if (transferEtaEl) transferEtaEl.innerText = `ETA: ${etaString}`;
    
    lastSpeedUpdateTime = now;
  }

  function handleDataReceived(data) {
    try {
      if (data === "next") {
        sendNextFileChunk();
      } else if (data === "file_received") {
        currentFileIndex++;
        if (prepareNextFile()) {
          sendFileMetadata();
        } else {
          otherPeer.send("all_done");
          resetDownloadState();
        }
      } else {
        // Unexpected message
      }
    } catch (error) {
      handleDownloadError(error);
    }
  }

  function sendNextFileChunk() {
    if (currentChunk < fileChunks.length) {
      otherPeer.send({ index: currentChunk, data: fileChunks[currentChunk] });
      currentChunk++;
      progressBarInner.style.width = `${(currentChunk / fileChunks.length) * 100}%`;
      updateTransferAnalytics(currentChunk * CHUNK_SIZE, fileChunks.length * CHUNK_SIZE);
    } else {
      otherPeer.send("done");
    }
  }

  function handleDownloadError(error) {
    console.error("An error occurred during the file transfer: ", error);
    resetDownloadState();
  }

  function resetDownloadState() {
    currentChunk = 0;
    currentFileIndex = 0;
    fileQueue = [];
    progressBarInner.style.width = "0%";
    progressBar.classList.add("hidden");
    //reload the page removing parameters
    window.location.href = window.location.href.split("?")[0];
  }

  function handlePeerOpen(id) {
    const peerIdParam = new URLSearchParams(window.location.search).get("peer") || null;
    if (peerIdParam) {
      shareLink.classList.add("hidden");
      downloadBtn.classList.remove("hidden");
      progressBar.classList.remove("hidden");
      progressBarInner.style.width = "0%";
      otherPeer = peer.connect(peerIdParam);
      receivedSize = 0;
      downloadInitiated = false;
      let totalChunks = 0;
      let filename = Date.now().toString();
      
      otherPeer.on("data", (data) => {
        if (typeof data === "string" && data.startsWith(FILENAME_PREFIX)) {
          filename = data.slice(4);
          downloadInitiated = false;
        } else if (typeof data === "string" && data.startsWith("size:")) {
          totalChunks = parseInt(data.slice(5));
          console.log(`Total chunks for ${filename}: ${totalChunks}`);
          if (!isNaN(totalChunks) && totalChunks >= 0) {
            receivedChunks = new Array(totalChunks);
            updateTransferAnalytics(0, totalChunks * CHUNK_SIZE);
            // If it's a subsequent file, request next chunk automatically
            if (downloadInitiated) {
              downloadInitiated = false;
              otherPeer.send("next");
            }
          }
        } else if (data === "all_done") {
          resetDownloadState();
        } else if (data !== "done" && typeof data === "object") {
          receivedChunks[data.index] = data.data;
          progressBar.classList.remove("hidden");
          progressBarInner.style.width = `${(data.index / totalChunks) * 100}%`;
          updateTransferAnalytics((data.index + 1) * CHUNK_SIZE, totalChunks * CHUNK_SIZE);
          otherPeer.send("next");
        } else if (!downloadInitiated && data === "done") {
          console.log(`Download complete for ${filename}.`);
          const file = new Blob(receivedChunks.map((chunk) => new Blob([chunk])));
          const url = URL.createObjectURL(file);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          a.click();
          downloadInitiated = true;
          otherPeer.send("file_received");
        }
      });

      otherPeer.on("close", () => {
        resetDownloadState();
      });
    }
  }
});
