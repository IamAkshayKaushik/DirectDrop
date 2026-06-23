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

  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    const bgColors = {
      success: 'bg-emerald-500 border-emerald-600 text-white',
      error: 'bg-rose-500 border-rose-600 text-white',
      info: 'bg-slate-800 border-slate-700 text-white'
    };
    toast.className = `flex items-center p-4 rounded-xl border shadow-lg transform transition-all duration-300 translate-y-2 opacity-0 ${bgColors[type]}`;
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.remove('translate-y-2', 'opacity-0'), 10);
    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-[-10px]');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

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
    const wrapper = document.createElement("div");
    wrapper.className = "flex animate-fade-in mb-2";

    if (sender === "You") {
      wrapper.classList.add("justify-end");
      wrapper.innerHTML = `<div class="max-w-[75%] px-4 py-2 rounded-2xl rounded-br-sm bg-teal-500 text-white text-sm shadow">${text}</div>`;
    } else if (sender === "Peer") {
      wrapper.classList.add("justify-start");
      wrapper.innerHTML = `<div class="max-w-[75%] px-4 py-2 rounded-2xl rounded-bl-sm bg-white border border-slate-200 text-slate-700 text-sm shadow-sm">${text}</div>`;
    } else {
      wrapper.classList.add("justify-center");
      wrapper.innerHTML = `<div class="px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-xs">${text}</div>`;
    }

    chatMessages.appendChild(wrapper);
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
      renderFileQueue();
      return true;
    }
    renderFileQueue();
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
      } else {
        renderFileQueue();
      }
    } else {
      fileQueue.push(...newFiles);
      if (currentFileIndex === 0 && fileQueue.length === newFiles.length) {
        prepareNextFile();
      } else {
        renderFileQueue();
      }
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
      showToast("Peer connected!", "success");

      if (fileQueue.length > 0 && currentFileIndex < fileQueue.length) {
        sendFileMetadata();
        progressBar.classList.remove("hidden");
        progressBarInner.style.width = "0%";
      }
      renderFileQueue();
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
        showToast("Receiver rejected the file", "error");
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
    showToast("File transfer error", "error");
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
    showToast("Peer disconnected", "error");
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
        showToast("Connected to sender!", "success");
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
          showToast("All files transferred successfully!", "success");
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
          showToast(`Downloaded: ${filename}`, "success");
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

  function renderFileQueue() {
    const queueContainer = document.getElementById("fileQueueContainer");
    const queueList = document.getElementById("fileQueueList");
    if (!queueContainer || !queueList) return;

    if (fileQueue.length === 0) {
      queueContainer.classList.add("hidden");
      queueContainer.classList.remove("flex");
      return;
    }

    queueContainer.classList.remove("hidden");
    queueContainer.classList.add("flex");
    queueList.innerHTML = "";

    fileQueue.forEach((file, index) => {
      const isCurrent = index === currentFileIndex;
      const isDone = index < currentFileIndex;

      let statusBadge = "";
      if (isCurrent && otherPeer && otherPeer.open) {
          statusBadge = `<span class="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700">Sending</span>`;
      } else if (isDone) {
          statusBadge = `<span class="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700">Done</span>`;
      } else {
          statusBadge = `<span class="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-600">Pending</span>`;
      }

      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      
      const item = document.createElement("div");
      item.className = `p-3 rounded-xl border ${isCurrent && otherPeer && otherPeer.open ? 'border-teal-400 bg-teal-50' : 'border-slate-100 bg-white'} flex justify-between items-center transition-all`;
      item.innerHTML = `
        <div class="flex items-center space-x-3 overflow-hidden">
            <svg class="w-6 h-6 ${isDone ? 'text-green-500' : 'text-slate-400'} flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
            <div class="overflow-hidden">
                <p class="text-sm font-semibold text-slate-700 truncate" title="${file.name}">${file.name}</p>
                <p class="text-xs text-slate-500">${sizeMB} MB</p>
            </div>
        </div>
        <div>
            ${statusBadge}
        </div>
      `;
      queueList.appendChild(item);
    });
  }

});
