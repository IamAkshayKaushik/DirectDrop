document.addEventListener("DOMContentLoaded", () => {
  const peer = initializePeerConnection();

  let fileData;
  let fileChunks = [];
  let currentChunk = 0;
  let receivedChunks = [];
  let otherPeer;
  const CHUNK_SIZE = 16 * 1024; // Size of each file chunk
  const FILENAME_PREFIX = "bbb."; // Prefix for filename messages
  let downloadInitiated = false;

  const fileInput = document.getElementById("fileInput");
  const progressBar = document.getElementById("progressBar");
  const progressBarInner = document.getElementById("progressBarInner");
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

  function initializePeerConnection() {
    return new Peer({
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

  function handleFileSelection(e) {
    fileData = e.target.files[0];
    fileChunks = splitFileIntoChunks(fileData);
    shareLink.classList.remove("hidden");
    linkInput.value = `${window.location.origin}?peer=${peer.id}`;
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
      otherPeer.send(`${FILENAME_PREFIX + fileData.name}`);
      otherPeer.send(`size:${fileChunks.length.toString()}`);
      progressBar.classList.remove("hidden");
      progressBarInner.style.width = "0%";
    });
    otherPeer.on("data", handleDataReceived);
    otherPeer.on("close", () => {
      resetDownloadState();
    });
  }

  function handleDataReceived(data) {
    try {
      if (data === "next") {
        sendNextFileChunk();
      } else {
        otherPeer.send("done");
        // Reset currentChunk on successful download
        resetDownloadState();
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
      if (currentChunk < fileChunks.length) {
        otherPeer.send("next");
      }
    } else {
      otherPeer.send("done");
      resetDownloadState();
    }
  }

  function handleDownloadError(error) {
    console.error("An error occurred during the file transfer: ", error);
    resetDownloadState();
  }

  function resetDownloadState() {
    currentChunk = 0;
    progressBarInner.style.width = "0%";
    progressBar.classList.add("hidden");
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

      otherPeer.on("data", (data) => {
        if (typeof data === "string" && data.startsWith(FILENAME_PREFIX)) {
          filename = data.slice(4);
        } else if (typeof data === "string" && data.startsWith("size:")) {
          totalChunks = parseInt(data.slice(5));
          console.log(`Total chunks: ${totalChunks}`);
          if (!isNaN(totalChunks) && totalChunks >= 0) {
            receivedChunks = new Array(totalChunks);
          }
        } else if (data !== "done" && typeof data === "object") {
          receivedChunks[data.index] = data.data;
          // receivedSize += data.data.byteLength;
          // console.log(`Received ${data.index} of ${totalChunks}.`);
          // update progress bar
          progressBar.classList.remove("hidden");
          progressBarInner.style.width = `${(data.index / totalChunks) * 100}%`;
          otherPeer.send("next");
        } else if (!downloadInitiated && data === "done") {
          console.log("Download complete.", data);
          const file = new Blob(receivedChunks.map((chunk) => new Blob([chunk])));
          const url = URL.createObjectURL(file);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          a.click();
          downloadInitiated = true;
          resetDownloadState();
        }
      });

      otherPeer.on("close", () => {
        resetDownloadState();
      });
    }
  }
});
