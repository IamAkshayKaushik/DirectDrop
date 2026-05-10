document.addEventListener("DOMContentLoaded", () => {
  const peer = initializePeerConnection();

  let fileQueue = [];
  let currentFileIndex = 0;
  let fileData;
  let currentChunk = 0;
  let receivedChunks = [];
  let otherPeer;
  const CHUNK_SIZE = 16 * 1024; // Size of each file chunk in bytes
  const FILENAME_PREFIX = "bbb."; // Prefix for filename messages
  let downloadInitiated = false;
  
  let transferStartTime = 0;
  let lastSpeedUpdateTime = 0;

  const fileInput = document.getElementById("fileInput");
  const dropZone = document.getElementById("dropZone");
  const progressBar = document.getElementById("progressBar");
  const progressBarInner = document.getElementById("progressBarInner");
  const transferStatsEl = document.getElementById("transferStats");
  const transferEtaEl = document.getElementById("transferEta");
  const shareLink = document.getElementById("shareLink");
  const linkInput = document.getElementById("linkInput");
  
  const acceptRejectPrompt = document.getElementById("acceptRejectPrompt");
  const incomingFileInfo = document.getElementById("incomingFileInfo");
  const acceptBtn = document.getElementById("acceptBtn");
  const rejectBtn = document.getElementById("rejectBtn");

  const chatContainer = document.getElementById("chatContainer");
  const chatMessages = document.getElementById("chatMessages");
  const chatForm = document.getElementById("chatForm");
  const chatInput = document.getElementById("chatInput");

  fileInput.addEventListener("change", handleFileSelection);

  peer.on("connection", handlePeerConnection);

  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const msg = chatInput.value.trim();
    if (msg && otherPeer && otherPeer.open) {
      appendChatMessage("You", msg);
      otherPeer.send({ type: "chat", text: msg });
      chatInput.value = "";
    }
  });

  function appendChatMessage(sender, text) {
    const div = document.createElement("div");
    div.className = "flex space-x-2 animate-fade-in";
    div.innerHTML = `<span class="font-bold text-slate-700">${sender}:</span><span class="text-slate-600 break-words flex-1">${text}</span>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  acceptBtn.addEventListener("click", () => {
    acceptRejectPrompt.classList.add("hidden");
    progressBar.classList.remove("hidden");
    otherPeer.send("next");
  });

  rejectBtn.addEventListener("click", () => {
    acceptRejectPrompt.classList.add("hidden");
    otherPeer.send("reject");
    resetProgressState();
  });

  peer.on("open", handlePeerOpen);

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
          { urls: "stun:freestun.net:5350" }
        ],
      },
    });
  }

  function prepareNextFile() {
    if (currentFileIndex < fileQueue.length) {
      fileData = fileQueue[currentFileIndex];
      currentChunk = 0;
      return true;
    }
    return false;
  }

  function handleFileSelection(e) {
    const newFiles = Array.from(e.target.files);
    if (newFiles.length === 0) return;

    if (otherPeer && otherPeer.open) {
      const wasIdle = currentFileIndex >= fileQueue.length;
      fileQueue.push(...newFiles);
      if (wasIdle) {
        if (prepareNextFile()) {
          sendFileMetadata();
        }
      }
    } else {
      fileQueue = newFiles;
      currentFileIndex = 0;
      prepareNextFile();
      shareLink.classList.remove("hidden");

      const link = `${window.location.href.split('?')[0]}?peer=${peer.id}`;
      linkInput.value = link;

      const qrContainer = document.getElementById("qrContainer");
      qrContainer.classList.remove("hidden");
      document.getElementById("qrcode").innerHTML = "";
      new QRCode(document.getElementById("qrcode"), {
        text: link,
        width: 200,
        height: 200,
        colorDark: "#0f172a", // slate-900
        colorLight: "#ffffff",
      });
    }
    
    // Reset file input so same file can be selected again if needed
    fileInput.value = "";
  }

  function handlePeerConnection(conn) {
    otherPeer = conn;
    otherPeer.on("open", () => {
      chatContainer.classList.remove("hidden");
      shareLink.classList.add("hidden");
      
      if (fileQueue.length > 0 && currentFileIndex < fileQueue.length) {
        sendFileMetadata();
        progressBar.classList.remove("hidden");
        progressBarInner.style.width = "0%";
      }
    });
    otherPeer.on("data", handleDataReceived);
    otherPeer.on("close", handlePeerClose);
  }

  function sendFileMetadata() {
    const totalChunks = Math.ceil(fileData.size / CHUNK_SIZE);
    updateTransferAnalytics(0, fileData.size);
    otherPeer.send(`${FILENAME_PREFIX + fileData.name}`);
    otherPeer.send(`size:${totalChunks.toString()}`);
  }

  function updateTransferAnalytics(currentBytes, totalBytes) {
    const now = Date.now();
    if (currentBytes === 0) {
      transferStartTime = now;
      lastSpeedUpdateTime = now;
      if (transferStatsEl) transferStatsEl.innerText = "Calculating speed...";
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
      if (typeof data === "object" && data.type === "chat") {
        appendChatMessage("Peer", data.text);
      } else if (data === "next") {
        sendNextFileChunk();
      } else if (data === "reject") {
        console.log("Receiver rejected the file");
        moveToNextFile();
      } else if (data === "file_received") {
        moveToNextFile();
      }
    } catch (error) {
      handleDownloadError(error);
    }
  }

  function moveToNextFile() {
    currentFileIndex++;
    if (prepareNextFile()) {
      sendFileMetadata();
    } else {
      otherPeer.send("all_done");
      resetProgressState();
    }
  }

  async function sendNextFileChunk() {
    const totalChunks = Math.ceil(fileData.size / CHUNK_SIZE);
    if (currentChunk < totalChunks) {
      const start = currentChunk * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, fileData.size);
      const chunkBlob = fileData.slice(start, end);
      
      const arrayBuffer = await chunkBlob.arrayBuffer();
      
      otherPeer.send({ index: currentChunk, data: arrayBuffer });
      currentChunk++;
      
      if (progressBarInner) progressBarInner.style.width = `${(currentChunk / totalChunks) * 100}%`;
      updateTransferAnalytics(currentChunk * CHUNK_SIZE, fileData.size);
    } else {
      otherPeer.send("done");
    }
  }

  function handleDownloadError(error) {
    console.error("An error occurred during the file transfer: ", error);
    resetProgressState();
  }

  function resetProgressState() {
    currentChunk = 0;
    if (progressBarInner) progressBarInner.style.width = "0%";
    if (progressBar) progressBar.classList.add("hidden");
    if (acceptRejectPrompt) acceptRejectPrompt.classList.add("hidden");
  }

  function handlePeerClose() {
    resetProgressState();
    appendChatMessage("System", "Peer disconnected.");
    otherPeer = null;
    
    // If we are receiver, maybe we should just alert.
    // If sender, we can show share link again.
    if (!new URLSearchParams(window.location.search).get("peer")) {
       shareLink.classList.remove("hidden");
    }
  }

  function handlePeerOpen(id) {
    const peerIdParam = new URLSearchParams(window.location.search).get("peer") || null;
    if (peerIdParam) {
      // Receiver Mode
      if (dropZone) dropZone.parentElement.classList.add("hidden"); // Hide file input for receiver
      shareLink.classList.add("hidden");
      
      otherPeer = peer.connect(peerIdParam);
      otherPeer.on("open", () => {
        chatContainer.classList.remove("hidden");
        appendChatMessage("System", "Connected to sender.");
      });
      
      downloadInitiated = false;
      let totalChunks = 0;
      let filename = Date.now().toString();
      
      otherPeer.on("data", (data) => {
        if (typeof data === "string" && data.startsWith(FILENAME_PREFIX)) {
          filename = data.slice(4);
          downloadInitiated = false;
          receivedChunks = [];
        } else if (typeof data === "string" && data.startsWith("size:")) {
          totalChunks = parseInt(data.slice(5));
          console.log(`Total chunks for ${filename}: ${totalChunks}`);
          if (!isNaN(totalChunks) && totalChunks >= 0) {
            receivedChunks = new Array(totalChunks);
            updateTransferAnalytics(0, totalChunks * CHUNK_SIZE);
            
            const sizeMB = ((totalChunks * CHUNK_SIZE) / (1024 * 1024)).toFixed(2);
            if (incomingFileInfo) incomingFileInfo.innerText = `${filename} (${sizeMB} MB)`;
            
            acceptRejectPrompt.classList.remove("hidden");
            progressBar.classList.add("hidden");
          }
        } else if (data === "all_done") {
          resetProgressState();
          appendChatMessage("System", "All files transferred successfully.");
        } else if (data !== "done" && typeof data === "object") {
          if (data.type === "chat") {
            appendChatMessage("Peer", data.text);
          } else {
            receivedChunks[data.index] = data.data;
            if (progressBar) progressBar.classList.remove("hidden");
            if (progressBarInner) progressBarInner.style.width = `${(data.index / totalChunks) * 100}%`;
            updateTransferAnalytics((data.index + 1) * CHUNK_SIZE, totalChunks * CHUNK_SIZE);
            otherPeer.send("next");
          }
        } else if (!downloadInitiated && data === "done") {
          console.log(`Download complete for ${filename}.`);
          const file = new Blob(receivedChunks);
          const url = URL.createObjectURL(file);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);
          downloadInitiated = true;
          otherPeer.send("file_received");
        }
      });

      otherPeer.on("close", handlePeerClose);
    }
  }
});
