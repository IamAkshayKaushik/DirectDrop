document.addEventListener("DOMContentLoaded", () => {
  const peer = initializePeerConnection();

  let fileData;
  let fileChunks = [];
  let currentChunk = 0;
  let otherPeer;
  const CHUNK_SIZE = 16 * 1024; // Size of each file chunk
  const FILENAME_PREFIX = "bbb."; // Prefix for filename messages

  const fileInput = document.getElementById("fileInput");
  const progressBar = document.getElementById("progressBar");
  const progressBarInner = document.getElementById("progressBarInner");
  const shareLink = document.getElementById("shareLink");
  const linkInput = document.getElementById("linkInput");
  const downloadBtn = document.getElementById("downloadBtn");

  fileInput.addEventListener("change", handleFileSelection);

  peer.on("connection", handlePeerConnection);

  downloadBtn.addEventListener("click", initiateFileDownload);

  let filename;
  let totalChunks;
  let receivedChunks;

  peer.on("open", handlePeerOpen);

  function initializePeerConnection() {
    return new Peer({
      config: {
        "iceServers": [
          { "urls": "stun:stun.l.google.com:19302" },
          { "urls": "stun:freestun.net:3479" },
          { "urls": "stun:freestun.net:5350" },
          { "urls": "turn:freestun.net:3479", "username": "free", "credential": "free" },
          { "urls": "turn:freestun.net:5350", "username": "free", "credential": "free" },
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
    fileReader.readAsArrayBuffer(file);
    fileReader.onloadend = () => {
      const fileSize = file.size;
      const numberOfChunks = Math.ceil(fileSize / CHUNK_SIZE);
      /* The code is splitting the file into chunks of a specified size (`CHUNK_SIZE`). It iterate over the file and slice it into chunks. Each chunk is then pushed into the `fileChunks` array. The loop continues until all chunks have been created. */
      for (let i = 0; i < numberOfChunks; i++) {
        fileChunks.push(fileReader.result.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
      }
    };
    return fileChunks;
  }

  function handlePeerConnection(conn) {
    otherPeer = conn;
    otherPeer.on("open", () => {
      otherPeer.send(`${FILENAME_PREFIX + fileData.name}`);
      otherPeer.send(fileChunks.length.toString());
      // downloadBtn.classList.remove("hidden");
      progressBar.classList.remove("hidden");
      progressBarInner.style.width = "0%";
    });
    otherPeer.on("data", handleDataReceived);
    otherPeer.on("close", () => {
      // Reset currentChunk on unsuccessful download
      currentChunk = 0;
      progressBarInner.style.width = "0%";
      progressBar.classList.add("hidden");
    });
  }

  function handleDataReceived(data) {
    try {
      if (data === "next") {
        if (currentChunk < fileChunks.length) {
          otherPeer.send({ index: currentChunk, data: fileChunks[currentChunk] });
          currentChunk++;
          progressBarInner.style.width = `${(currentChunk / fileChunks.length) * 100}%`;
          if (currentChunk < fileChunks.length) {
            otherPeer.send("next");
          }
        } else {
          otherPeer.send("done");
          // Reset currentChunk on successful download
          currentChunk = 0;
          progressBarInner.style.width = "0%";
          progressBar.classList.add("hidden");
        }
      }
    } catch (error) {
      console.error("An error occurred during the file transfer: ", error);
      // Reset currentChunk on unsuccessful download
      currentChunk = 0;
      progressBarInner.style.width = "0%";
      progressBar.classList.add("hidden");
    }
  }

  function initiateFileDownload() {
    otherPeer.send("next");
  }

  /**
   * The function handles the opening of a peer connection and initiates the download of a file if a peer
   * ID parameter is provided in the URL.
   * @param id - The `id` parameter in the `handlePeerOpen` function is the ID of the peer that has just
   * opened a connection.
   */
  function handlePeerOpen(id) {
    const peerIdParam = new URLSearchParams(window.location.search).get("peer") || null;
    if (peerIdParam) {
      shareLink.classList.add("hidden");
      downloadBtn.classList.remove("hidden");
      progressBar.classList.remove("hidden");
      progressBarInner.style.width = "0%";
      otherPeer = peer.connect(peerIdParam);
      let receivedSize = 0;
      let downloadInitiated = false;
      otherPeer.on("data", (data) => {
        if (typeof data === "string" && data.startsWith(FILENAME_PREFIX)) {
          // This if block checks if the data is a string and if it is starts with "bbb.". If it starts with "bbb.", then it is the name of the file. The name of the file is extracted from the data and stored in the `filename` variable.
          filename = data.slice(4);
        } else if (typeof data === "string" && data !== "done") {
          // This else if block checks if the data is a string and if it is not "done". If it is not "done", then it is the total number of chunks in the file. The total number of chunks is extracted from the data and stored in the `totalChunks` variable. The `receivedChunks` array is initialized with the length of the total number of chunks.
          totalChunks = parseInt(data);
          if (!isNaN(totalChunks) && totalChunks >= 0) {
            receivedChunks = new Array(totalChunks);
          }
        } else if (data !== "done") {
          // This if block checks if the data is not "done". If it is not "done", then it is a chunk of the file. The chunk is added to the array of chunks and the size of the received chunks is increased by the size of the chunk. The other peer is then sent the "next" message to request the next chunk. If the chunk is the last chunk, then the "done" message is sent to the other peer. If the download has not been initiated, then the chunks are combined into a file and the file is downloaded.
          receivedChunks[data.index] = data.data;
          receivedSize += data.data.byteLength;
          otherPeer.send("next");
        } else if (!downloadInitiated) {
          const file = new Blob(receivedChunks.map((chunk) => new Blob([chunk])));
          const url = URL.createObjectURL(file);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          a.click();
          downloadInitiated = true;
        }
      });

      otherPeer.on("close", () => {
        // Reset currentChunk on unsuccessful download
        currentChunk = 0;
        progressBarInner.style.width = "0%";
        progressBar.classList.add("hidden");
      });
    }
  }
});
