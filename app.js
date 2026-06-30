document.addEventListener("DOMContentLoaded", () => {
  const {
    CHUNK_SIZE,
    formatFileSize,
    calculateReceivedBytes,
    calculateReceivePercent,
    shouldShowProgressBar,
  } = DirectDropTransfer;

  let peer = initializePeerConnection();

  let fileQueue = [];
  let currentFileIndex = 0;
  let fileData;
  let currentChunk = 0;
  let receivedChunks = [];
  let otherPeer;
  const PIPELINE_WINDOW = 8;   // ponytail: chunks in-flight at once; tune for speed vs memory
  const FILENAME_PREFIX = "bbb.";
  let downloadInitiated = false;

  let isSending = false;
  let isReceiving = false;
  let incomingFilePending = false;

  let remotePeerId = null;
  let userInitiatedClose = false;
  let reconnectAttempt = 0;
  let reconnectTimer = null;

  let incomingTotalChunks = 0;
  let incomingTotalBytes = 0;
  let incomingFilename = "";

  let transferStartTime = 0;
  let lastSpeedUpdateTime = 0;

  const fileInput = document.getElementById("fileInput");
  const dropZone = document.getElementById("dropZone");
  const progressBar = document.getElementById("progressBar");
  const progressBarInner = document.getElementById("progressBarInner");
  const transferStatsEl = document.getElementById("transferStats");
  const transferEtaEl = document.getElementById("transferEta");
  const transferSizeEl = document.getElementById("transferSize");
  const transferFileNameEl = document.getElementById("transferFileName");
  const cancelReceiveBtn = document.getElementById("cancelReceiveBtn");
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

  const connectionHelp = document.getElementById("connectionHelp");

  const pinForm = document.getElementById("pinForm");
  const pinInput = document.getElementById("pinInput");
  const myPinCode = document.getElementById("myPinCode");
  const pinEntrySection = document.getElementById("pinEntrySection");

  document.getElementById("myPinDisplay").addEventListener("click", () => {
    if (peer && peer.id) {
      navigator.clipboard.writeText(peer.id).then(() => {
        showToast("PIN copied!", "success");
      });
    }
  });

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

  pinForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const pin = pinInput.value.trim();
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      showToast("Please enter a valid 6-digit PIN", "error");
      return;
    }
    if (otherPeer && otherPeer.open) {
      showToast("Already connected to a peer", "info");
      return;
    }
    const connectBtn = document.getElementById("pinConnectBtn");
    connectBtn.disabled = true;
    connectBtn.textContent = "Connecting...";

    const connectTimeout = setTimeout(() => {
      showToast("Connection timed out. Peer may be offline.", "error");
      connectBtn.disabled = false;
      connectBtn.textContent = "Connect";
      if (otherPeer) { otherPeer.close(); otherPeer = null; }
    }, 10000);

    otherPeer = peer.connect(pin);
    otherPeer.on("open", () => {
      clearTimeout(connectTimeout);
      remotePeerId = pin;
      connectBtn.disabled = false;
      connectBtn.textContent = "Connect";
      chatContainer.classList.remove("hidden");
      if (connectionHelp) connectionHelp.classList.add("hidden");
      pinEntrySection.classList.add("hidden");
      shareLink.classList.add("hidden");
      showToast("Connected to peer!", "success");
      tryStartSending();
      renderFileQueue();
    });
    otherPeer.on("data", handleDataReceived);
    otherPeer.on("close", handlePeerClose);
    otherPeer.on("error", (err) => {
      clearTimeout(connectTimeout);
      connectBtn.disabled = false;
      connectBtn.textContent = "Connect";
      showToast("Connection failed: " + err.message, "error");
    });
  });

  fileInput.addEventListener("change", handleFileSelection);

  function setupPeerEvents() {
    peer.on("connection", handlePeerConnection);
    peer.on("open", handlePeerOpen);
    peer.on("disconnected", () => {
      if (!peer.destroyed) {
        showToast("Reconnecting to server...", "info");
        peer.reconnect();
      }
    });
    peer.on("error", (err) => {
      if (err.type === "unavailable-id") {
        showToast("PIN collision — regenerating...", "info");
        peer.destroy();
        peer = initializePeerConnection();
        setupPeerEvents();
      } else {
        showToast("Connection error: " + err.message, "error");
      }
    });
  }

  setupPeerEvents();

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
    const bubble = document.createElement("div");
    bubble.textContent = text;

    if (sender === "You") {
      wrapper.classList.add("justify-end");
      bubble.className = "max-w-[75%] px-4 py-2 rounded-2xl rounded-br-sm bg-teal-500 text-white text-sm shadow";
    } else if (sender === "Peer") {
      wrapper.classList.add("justify-start");
      bubble.className = "max-w-[75%] px-4 py-2 rounded-2xl rounded-bl-sm bg-white border border-slate-200 text-slate-700 text-sm shadow-sm";
    } else {
      wrapper.classList.add("justify-center");
      bubble.className = "px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-xs";
    }

    wrapper.appendChild(bubble);
    chatMessages.appendChild(wrapper);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  acceptBtn.addEventListener("click", () => {
    if (!incomingFilePending) return;
    incomingFilePending = false;
    isReceiving = true;
    acceptRejectPrompt.classList.add("hidden");
    if (cancelReceiveBtn) cancelReceiveBtn.classList.remove("hidden");
    const totalBytes = incomingTotalBytes || incomingTotalChunks * CHUNK_SIZE;
    if (progressBar) {
      progressBar.classList.remove("hidden");
      progressBar.dataset.role = "receive";
      if (progressBarInner) progressBarInner.style.width = "0%";
    }
    if (transferFileNameEl) transferFileNameEl.textContent = incomingFilename;
    updateTransferAnalytics(0, totalBytes);
    otherPeer.send("next");
  });

  rejectBtn.addEventListener("click", () => {
    abortReceive(false);
  });

  if (cancelReceiveBtn) {
    cancelReceiveBtn.addEventListener("click", () => abortReceive(true));
  }

  function abortReceive(isMidTransfer) {
    if (!isReceiving && !incomingFilePending) return;
    isReceiving = false;
    incomingFilePending = false;
    incomingFilename = "";
    incomingTotalBytes = 0;
    incomingTotalChunks = 0;
    downloadInitiated = true;
    receivedChunks = [];
    acceptRejectPrompt.classList.add("hidden");
    if (cancelReceiveBtn) cancelReceiveBtn.classList.add("hidden");
    otherPeer.send("reject");
    resetReceiveProgress();
    if (isMidTransfer) showToast("Download cancelled", "info");
    tryStartSending();
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
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          { urls: "stun:stun3.l.google.com:19302" },
          { urls: "stun:stun4.l.google.com:19302" },
          { urls: "stun:stun.services.mozilla.com:3478" },
          { urls: "stun:stunserver.stunprotocol.org:3478" },
          { urls: "stun.cloudflare.com:3478" },
        ],
      },
    });
  }

  function prepareNextFile() {
    if (currentFileIndex < fileQueue.length) {
      fileData = fileQueue[currentFileIndex];
      currentChunk = 0;
      chunksInFlight = 0; // reset pipeline window for new file
      isProcessingQueue = false;
      renderFileQueue();
      return true;
    }
    renderFileQueue();
    return false;
  }

  function tryStartSending() {
    if (!otherPeer || !otherPeer.open || isSending || isReceiving) return false;
    if (currentFileIndex >= fileQueue.length) return false;
    if (!prepareNextFile()) return false;
    sendFileMetadata();
    if (progressBar) {
      progressBar.classList.remove("hidden");
      progressBarInner.style.width = "0%";
    }
    return true;
  }

  function handleFileSelection(e) {
    const newFiles = Array.from(e.target.files);
    if (newFiles.length === 0) return;

    if (otherPeer && otherPeer.open) {
      fileQueue.push(...newFiles);
      if (!tryStartSending()) renderFileQueue();
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
      remotePeerId = conn.peer;
      reconnectAttempt = 0;
      chatContainer.classList.remove("hidden");
      if (connectionHelp) connectionHelp.classList.add("hidden");
      shareLink.classList.add("hidden");
      pinEntrySection.classList.add("hidden");
      showToast("Peer connected!", "success");

      tryStartSending();
      renderFileQueue();
    });
    otherPeer.on("data", handleDataReceived);
    otherPeer.on("close", handlePeerClose);
  }

  function sendFileMetadata() {
    isSending = true;
    const totalChunks = Math.ceil(fileData.size / CHUNK_SIZE);
    updateTransferAnalytics(0, fileData.size);
    if (transferFileNameEl) transferFileNameEl.textContent = fileData.name;
    otherPeer.send(`${FILENAME_PREFIX + fileData.name}`);
    otherPeer.send(`bytes:${fileData.size}`);
    otherPeer.send(`size:${totalChunks.toString()}`);
    renderFileQueue();
  }

  function updateTransferAnalytics(currentBytes, totalBytes) {
    const now = Date.now();
    if (currentBytes === 0) {
      transferStartTime = now;
      lastSpeedUpdateTime = now;
      if (transferStatsEl) transferStatsEl.innerText = "Calculating speed...";
      if (transferEtaEl) transferEtaEl.innerText = "ETA: --";
      if (transferSizeEl && totalBytes > 0) {
        transferSizeEl.innerText = `0 B / ${formatFileSize(totalBytes)}`;
      }
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
    if (transferSizeEl && totalBytes > 0) {
      transferSizeEl.innerText = `${formatFileSize(currentBytes)} / ${formatFileSize(totalBytes)}`;
    }
    
    lastSpeedUpdateTime = now;
  }

  function handleDataReceived(data) {
    try {
      if (typeof data === "object" && data.type === "chat") {
        appendChatMessage("Peer", data.text);
      } else if (typeof data === "string" && data.startsWith(FILENAME_PREFIX)) {
        incomingFilePending = true;
        incomingFilename = data.slice(FILENAME_PREFIX.length);
        incomingTotalBytes = 0;
        incomingTotalChunks = 0;
        downloadInitiated = false;
        receivedChunks = [];
      } else if (typeof data === "string" && data.startsWith("bytes:")) {
        const bytes = parseInt(data.slice(6));
        if (!isNaN(bytes) && bytes >= 0) {
          incomingTotalBytes = bytes;
          if (incomingFilename && incomingFileInfo) {
            incomingFileInfo.innerText = `${incomingFilename} (${formatFileSize(bytes)})`;
          }
        }
      } else if (typeof data === "string" && data.startsWith("size:")) {
        incomingTotalChunks = parseInt(data.slice(5));
        if (!isNaN(incomingTotalChunks) && incomingTotalChunks >= 0) {
          const totalBytes = incomingTotalBytes || incomingTotalChunks * CHUNK_SIZE;
          receivedChunks = new Array(incomingTotalChunks);
          if (incomingFileInfo) {
            incomingFileInfo.innerText = `${incomingFilename} (${formatFileSize(totalBytes)})`;
          }
          const promptIcon = document.getElementById("incomingFileIcon");
          if (promptIcon) promptIcon.innerHTML = getFileIcon(incomingFilename, 'text-blue-600');
          acceptRejectPrompt.classList.remove("hidden");
        }
      } else if (data === "next") {
        // Only the sender role handles "next" — ignore if we're not sending
        if (isSending) sendNextFileChunk();
      } else if (data === "reject") {
        showToast("Receiver rejected the file", "error");
        moveToNextFile();
      } else if (data === "file_received") {
        moveToNextFile();
      } else if (data === "cancel_transfer") {
        isReceiving = false;
        incomingFilePending = false;
        incomingFilename = "";
        incomingTotalBytes = 0;
        incomingTotalChunks = 0;
        downloadInitiated = true;
        showToast("Sender cancelled the transfer", "info");
        receivedChunks = [];
        if (cancelReceiveBtn) cancelReceiveBtn.classList.add("hidden");
        resetReceiveProgress();
        tryStartSending();
      } else if (data === "all_done") {
        resetReceiveProgress();
        showToast("Peer finished sending", "success");
        tryStartSending();
      } else if (data === "done" && isReceiving && !downloadInitiated) {
        showToast(`Downloaded: ${incomingFilename}`, "success");
        const file = new Blob(receivedChunks);
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url;
        a.download = incomingFilename;
        a.click();
        URL.revokeObjectURL(url);
        downloadInitiated = true;
        isReceiving = false;
        if (cancelReceiveBtn) cancelReceiveBtn.classList.add("hidden");
        resetReceiveProgress();
        otherPeer.send("file_received");
        tryStartSending();
      } else if (typeof data === "object" && data.index !== undefined) {
        if (!isReceiving) return;
        receivedChunks[data.index] = data.data;
        if (progressBar) {
          progressBar.classList.remove("hidden");
          progressBar.dataset.role = "receive";
        }
        const totalBytes = incomingTotalBytes || incomingTotalChunks * CHUNK_SIZE;
        const receivedBytes = calculateReceivedBytes(
          data.index,
          data.data.byteLength,
          CHUNK_SIZE,
          totalBytes
        );
        const pct = calculateReceivePercent(receivedBytes, totalBytes);
        if (progressBarInner) progressBarInner.style.width = `${pct}%`;
        updateTransferAnalytics(receivedBytes, totalBytes);
        otherPeer.send("next");
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
      isSending = false;
      otherPeer.send("all_done");
      resetSendProgress();
    }
  }

  // Pipelined chunk sender: push up to PIPELINE_WINDOW chunks without waiting for
  // individual acks. The receiver still sends "next" per chunk for flow control,
  // but we have multiple in-flight so RTT doesn't bottleneck throughput.
  // ponytail: window=8 × 64KB = 512KB in-flight; bump PIPELINE_WINDOW if link allows
  let chunksInFlight = 0;
  let isProcessingQueue = false;

  async function sendNextFileChunk() {
    if (!isSending) return;
    if (chunksInFlight > 0) chunksInFlight--;

    if (isProcessingQueue) return;
    isProcessingQueue = true;

    try {
      const totalChunks = Math.ceil(fileData.size / CHUNK_SIZE);

      while (isSending && chunksInFlight < PIPELINE_WINDOW && currentChunk < totalChunks) {
        const idx = currentChunk;
        currentChunk++;
        chunksInFlight++;

        const start = idx * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, fileData.size);
        const arrayBuffer = await fileData.slice(start, end).arrayBuffer();

        otherPeer.send({ index: idx, data: arrayBuffer });

        if (progressBar) {
          progressBar.dataset.role = "send";
          progressBar.classList.remove("hidden");
        }
        if (progressBarInner) progressBarInner.style.width = `${(currentChunk / totalChunks) * 100}%`;
        updateTransferAnalytics(currentChunk * CHUNK_SIZE, fileData.size);
      }

      if (isSending && currentChunk >= totalChunks && chunksInFlight === 0) {
        otherPeer.send("done");
      }
    } finally {
      isProcessingQueue = false;
    }
  }

  function handleDownloadError(error) {
    console.error("An error occurred during the file transfer: ", error);
    showToast("File transfer error", "error");
    resetProgressState();
  }

  function resetSendProgress() {
    currentChunk = 0;
    chunksInFlight = 0;
    isProcessingQueue = false;
    if (!shouldShowProgressBar(isSending, isReceiving) && progressBar) {
      progressBar.classList.add("hidden");
    }
  }

  function resetReceiveProgress() {
    if (!shouldShowProgressBar(isSending, isReceiving) && progressBar) {
      progressBar.classList.add("hidden");
    }
    if (acceptRejectPrompt) acceptRejectPrompt.classList.add("hidden");
    if (cancelReceiveBtn) cancelReceiveBtn.classList.add("hidden");
    if (!isSending) {
      if (transferFileNameEl) transferFileNameEl.textContent = "";
      if (transferStatsEl) transferStatsEl.innerText = "Calculating speed...";
      if (transferEtaEl) transferEtaEl.innerText = "ETA: --";
      if (transferSizeEl) transferSizeEl.innerText = "";
      if (progressBarInner) progressBarInner.style.width = "0%";
    }
  }

  function resetProgressState() {
    currentChunk = 0;
    chunksInFlight = 0;
    isProcessingQueue = false;
    if (progressBarInner) progressBarInner.style.width = "0%";
    if (progressBar) progressBar.classList.add("hidden");
    if (acceptRejectPrompt) acceptRejectPrompt.classList.add("hidden");
    if (cancelReceiveBtn) cancelReceiveBtn.classList.add("hidden");
    if (transferFileNameEl) transferFileNameEl.textContent = "";
    if (transferSizeEl) transferSizeEl.innerText = "";
  }

  function handlePeerClose() {
    isSending = false;
    isReceiving = false;
    incomingFilePending = false;
    resetProgressState();
    otherPeer = null;

    if (userInitiatedClose) {
      userInitiatedClose = false;
      remotePeerId = null;
      showToast("Disconnected", "info");
      chatContainer.classList.add("hidden");
      pinEntrySection.classList.remove("hidden");
      if (!new URLSearchParams(window.location.search).get("peer") && fileQueue.length > 0) {
        shareLink.classList.remove("hidden");
      }
      return;
    }

    if (remotePeerId && reconnectAttempt < 3) {
      const delays = [2000, 4000, 8000];
      const delay = delays[reconnectAttempt];
      reconnectAttempt++;
      showToast(`Reconnecting... attempt ${reconnectAttempt}/3`, "info");

      reconnectTimer = setTimeout(() => {
        if (!peer || peer.destroyed) return;
        otherPeer = peer.connect(remotePeerId);
        otherPeer.on("open", () => {
          reconnectAttempt = 0;
          showToast("Reconnected!", "success");
          chatContainer.classList.remove("hidden");
          if (connectionHelp) connectionHelp.classList.add("hidden");
          pinEntrySection.classList.add("hidden");
          shareLink.classList.add("hidden");
          tryStartSending();
          renderFileQueue();
        });
        otherPeer.on("data", handleDataReceived);
        otherPeer.on("close", handlePeerClose);
        otherPeer.on("error", () => {
          handlePeerClose();
        });
      }, delay);
    } else {
      reconnectAttempt = 0;
      remotePeerId = null;
      showToast("Connection lost. Enter PIN to reconnect.", "error");
      chatContainer.classList.add("hidden");
      pinEntrySection.classList.remove("hidden");
      if (!new URLSearchParams(window.location.search).get("peer") && fileQueue.length > 0) {
        shareLink.classList.remove("hidden");
      }
    }
  }

  function handlePeerOpen(id) {
    if (myPinCode) myPinCode.textContent = id;

    const peerIdParam = new URLSearchParams(window.location.search).get("peer") || null;
    if (peerIdParam) {
      shareLink.classList.add("hidden");
      pinEntrySection.classList.add("hidden");

      if (connectionHelp) {
        connectionHelp.innerHTML = `
          <div class="flex items-center justify-center space-x-3 py-2">
            <svg class="animate-spin h-5 w-5 text-teal-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            <span class="text-sm font-medium text-slate-600">Connecting to peer...</span>
          </div>`;
      }

      history.replaceState(null, "", window.location.pathname);

      const connectTimeout = setTimeout(() => {
        showToast("Connection timed out. Peer may be offline.", "error");
        if (otherPeer) { otherPeer.close(); otherPeer = null; }
        pinEntrySection.classList.remove("hidden");
        if (connectionHelp) connectionHelp.classList.add("hidden");
      }, 10000);

      otherPeer = peer.connect(peerIdParam);
      otherPeer.on("open", () => {
        clearTimeout(connectTimeout);
        remotePeerId = peerIdParam;
        reconnectAttempt = 0;
        chatContainer.classList.remove("hidden");
        if (connectionHelp) connectionHelp.classList.add("hidden");
        showToast("Connected to peer!", "success");
        tryStartSending();
        renderFileQueue();
      });
      otherPeer.on("data", handleDataReceived);
      otherPeer.on("close", handlePeerClose);
      otherPeer.on("error", (err) => {
        clearTimeout(connectTimeout);
        showToast("Connection failed: " + err.message, "error");
        pinEntrySection.classList.remove("hidden");
        if (connectionHelp) connectionHelp.classList.add("hidden");
      });
    }
  }

  function cancelFileAtIndex(index) {
    const isCurrent = index === currentFileIndex;
    if (isCurrent && otherPeer && otherPeer.open && isSending) {
      isSending = false;
      otherPeer.send("cancel_transfer");
      showToast(`Cancelled: ${fileQueue[index].name}`, "info");
      fileQueue.splice(index, 1);
      resetSendProgress();
      tryStartSending();
    } else if (index > currentFileIndex) {
      showToast(`Removed: ${fileQueue[index].name}`, "info");
      fileQueue.splice(index, 1);
      renderFileQueue();
    }
  }

  function getFileIcon(filename, colorClass) {
    const ext = (filename.split('.').pop() || '').toLowerCase();
    if (['png','jpg','jpeg','gif','svg','webp'].includes(ext)) {
      return `<svg class="w-6 h-6 ${colorClass} flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>`;
    }
    if (['zip','rar','7z','tar','gz'].includes(ext)) {
      return `<svg class="w-6 h-6 ${colorClass} flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>`;
    }
    if (['js','html','css','json','md','txt','csv'].includes(ext)) {
      return `<svg class="w-6 h-6 ${colorClass} flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>`;
    }
    return `<svg class="w-6 h-6 ${colorClass} flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>`;
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
      let cancelBtn = "";
      if (isCurrent && otherPeer && otherPeer.open && isSending) {
          statusBadge = `<span class="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700">Sending</span>`;
          cancelBtn = `<button data-cancel="${index}" class="ml-2 px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-600 hover:bg-rose-200 transition-colors cursor-pointer">Cancel</button>`;
      } else if (isDone) {
          statusBadge = `<span class="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700">Done</span>`;
      } else {
          statusBadge = `<span class="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-600">Pending</span>`;
          cancelBtn = `<button data-cancel="${index}" class="ml-2 w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:bg-rose-100 hover:text-rose-500 transition-colors cursor-pointer text-xs">&times;</button>`;
      }

      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);

      const item = document.createElement("div");
      item.className = `p-3 rounded-xl border ${isCurrent && otherPeer && otherPeer.open && isSending ? 'border-teal-400 bg-teal-50' : 'border-slate-100 bg-white'} flex justify-between items-center transition-all`;
      item.innerHTML = `
        <div class="flex items-center space-x-3 overflow-hidden">
            ${getFileIcon(file.name, isDone ? 'text-green-500' : 'text-slate-400')}
            <div class="overflow-hidden">
                <p class="text-sm font-semibold text-slate-700 truncate" title="${file.name}">${file.name}</p>
                <p class="text-xs text-slate-500">${sizeMB} MB</p>
            </div>
        </div>
        <div class="flex items-center">
            ${statusBadge}${cancelBtn}
        </div>
      `;
      queueList.appendChild(item);
    });

    queueList.querySelectorAll("[data-cancel]").forEach((btn) => {
      btn.addEventListener("click", () => {
        cancelFileAtIndex(parseInt(btn.dataset.cancel));
      });
    });

    if (currentFileIndex >= fileQueue.length && fileQueue.length > 0) {
      const hint = document.createElement("div");
      hint.className = "flex items-center justify-center space-x-2 text-slate-400 text-xs mt-3 py-2";
      hint.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg><span>Drop more files to send</span>`;
      queueList.appendChild(hint);
    }
  }

});
