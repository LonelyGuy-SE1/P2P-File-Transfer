let peerConnection = null;
let dataChannel = null;
let selectedRole = null;
let connectionKeyword = null;
let isConnected = false;

const rtcConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ],
};

let pendingFiles = {};
let receivedChunks = {};

function init() {
  updateStatus("Not Connected", "waiting");
  setupEventListeners();
}

function setupEventListeners() {
  const messageInput = document.getElementById("messageInput");
  const fileInput = document.getElementById("fileInput");
  const uploadArea = document.getElementById("uploadArea");
  const keywordInput = document.getElementById("keywordInput");

  messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  });

  keywordInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      initiateConnection();
    }
  });

  fileInput.addEventListener("change", (e) => {
    handleFiles(e.target.files);
    e.target.value = "";
  });

  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    uploadArea.addEventListener(eventName, preventDefaults, false);
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    uploadArea.addEventListener(eventName, () => {
      uploadArea.style.borderColor = "#4F46E5";
      uploadArea.style.background = "white";
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    uploadArea.addEventListener(eventName, () => {
      uploadArea.style.borderColor = "#D1D5DB";
      uploadArea.style.background = "transparent";
    });
  });

  uploadArea.addEventListener("drop", (e) => {
    const files = e.dataTransfer.files;
    handleFiles(files);
  });
}

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function selectRole(role) {
  selectedRole = role;

  document.getElementById("createBtn").classList.remove("active");
  document.getElementById("joinBtn").classList.remove("active");

  if (role === "create") {
    document.getElementById("createBtn").classList.add("active");
  } else {
    document.getElementById("joinBtn").classList.add("active");
  }

  if (role === "join") {
    document.getElementById("scannerContainer").style.display = "block";
    document.getElementById("qrCodeContainer").style.display = "none";
  } else {
    document.getElementById("scannerContainer").style.display = "none";
  }

  document.getElementById("keywordInput").focus();
}

async function initiateConnection() {
  const keyword = document.getElementById("keywordInput").value.trim();

  if (!keyword) {
    alert("Please enter a connection keyword");
    return;
  }

  if (!selectedRole) {
    alert("Please select a role first");
    return;
  }

  connectionKeyword = keyword;
  document.getElementById("connectBtn").disabled = true;

  if (selectedRole === "create") {
    await createConnection();
  } else {
    await joinConnection();
  }
}

async function createConnection() {
  try {
    updateStatus("Creating connection...", "waiting");

    peerConnection = new RTCPeerConnection(rtcConfig);
    setupPeerConnection();

    dataChannel = peerConnection.createDataChannel("fileTransfer", {
      ordered: true,
    });
    setupDataChannel(dataChannel);

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    await waitForICEGathering();

    const connectionCode = btoa(
      JSON.stringify({
        keyword: connectionKeyword,
        sdp: peerConnection.localDescription,
      }),
    );

    document.getElementById("codeDisplay").textContent = connectionCode;
    document.getElementById("connectionCode").style.display = "block";

    generateQRCode(connectionCode);

    addSystemMessage("Waiting for peer to join...");
  } catch (error) {
    console.error("Error creating connection:", error);
    updateStatus("Connection failed", "error");
    alert("Failed to create connection: " + error.message);
  }
}

async function joinConnection() {
  try {
    updateStatus("Joining connection...", "waiting");

    const code = prompt(
      "Enter the connection code shared by the other device:",
    );

    if (!code) {
      document.getElementById("connectBtn").disabled = false;
      return;
    }

    let connectionData;
    try {
      connectionData = JSON.parse(atob(code));
    } catch (e) {
      alert("Invalid connection code");
      document.getElementById("connectBtn").disabled = false;
      return;
    }

    if (connectionData.keyword !== connectionKeyword) {
      alert(
        "Keyword mismatch! Make sure you entered the same keyword as the creator.",
      );
      document.getElementById("connectBtn").disabled = false;
      return;
    }

    peerConnection = new RTCPeerConnection(rtcConfig);
    setupPeerConnection();

    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(connectionData.sdp),
    );

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    await waitForICEGathering();

    const answerCode = btoa(
      JSON.stringify({
        sdp: peerConnection.localDescription,
      }),
    );

    alert("Share this answer code with the creator:\n\n" + answerCode);

    setTimeout(() => {
      const creatorAnswer = prompt(
        "Once the creator sees your answer code above, they will give you their final connection code. Enter it here:",
      );
      if (creatorAnswer) {
        processCreatorAnswer(creatorAnswer);
      }
    }, 1000);
  } catch (error) {
    console.error("Error joining connection:", error);
    updateStatus("Connection failed", "error");
    alert("Failed to join connection: " + error.message);
  }
}

async function processCreatorAnswer(answerCode) {
  try {
    const answerData = JSON.parse(atob(answerCode));
    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(answerData.sdp),
    );
    addSystemMessage("Connection established! Waiting for confirmation...");
  } catch (error) {
    console.error("Error processing answer:", error);
    alert("Invalid answer code");
  }
}

function setupPeerConnection() {
  peerConnection.onicecandidate = (event) => {};

  peerConnection.oniceconnectionstatechange = () => {
    console.log("ICE connection state:", peerConnection.iceConnectionState);

    if (peerConnection.iceConnectionState === "connected") {
      onConnected();
    } else if (
      peerConnection.iceConnectionState === "disconnected" ||
      peerConnection.iceConnectionState === "failed"
    ) {
      onDisconnected();
    }
  };

  peerConnection.ondatachannel = (event) => {
    dataChannel = event.channel;
    setupDataChannel(dataChannel);
  };
}

function setupDataChannel(channel) {
  channel.binaryType = "arraybuffer";

  channel.onopen = () => {
    console.log("Data channel opened");
    onConnected();
  };

  channel.onclose = () => {
    console.log("Data channel closed");
    onDisconnected();
  };

  channel.onmessage = (event) => {
    handleIncomingData(event.data);
  };
}

function waitForICEGathering() {
  return new Promise((resolve) => {
    if (peerConnection.iceGatheringState === "complete") {
      resolve();
    } else {
      const checkState = () => {
        if (peerConnection.iceGatheringState === "complete") {
          peerConnection.removeEventListener(
            "icegatheringstatechange",
            checkState,
          );
          resolve();
        }
      };

      peerConnection.addEventListener("icegatheringstatechange", checkState);

      setTimeout(() => {
        if (peerConnection.iceGatheringState !== "complete") {
          console.warn(
            "ICE gathering timed out, proceeding with collected candidates",
          );
        }
        peerConnection.removeEventListener(
          "icegatheringstatechange",
          checkState,
        );
        resolve();
      }, 2000);
    }
  });
}

function onConnected() {
  if (isConnected) return;
  isConnected = true;

  updateStatus("Connected", "connected");
  document.getElementById("connectionSection").style.display = "none";
  document.getElementById("chatContainer").classList.add("active");

  addSystemMessage("🎉 Connected! You can now send messages and files.");

  if (selectedRole === "create") {
    setTimeout(() => {
      const joinerAnswer = prompt(
        "Enter the answer code from the joining device:",
      );
      if (joinerAnswer) {
        processJoinerAnswer(joinerAnswer);
      }
    }, 1000);
  }
}

async function processJoinerAnswer(answerCode) {
  try {
    const answerData = JSON.parse(atob(answerCode));
    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(answerData.sdp),
    );
    addSystemMessage("Peer connected successfully!");
  } catch (error) {
    console.error("Error processing joiner answer:", error);
    alert("Invalid answer code");
  }
}

function onDisconnected() {
  if (!isConnected) return;
  isConnected = false;

  updateStatus("Disconnected", "error");
  addSystemMessage("⚠️ Peer disconnected");
}

function sendMessage() {
  const input = document.getElementById("messageInput");
  const message = input.value.trim();

  if (!message || !isConnected || !dataChannel) return;

  const data = {
    type: "message",
    content: message,
    timestamp: Date.now(),
  };

  try {
    dataChannel.send(JSON.stringify(data));
    addMessage("You", message, "sent");
    input.value = "";
  } catch (error) {
    console.error("Error sending message:", error);
    addSystemMessage("Failed to send message");
  }
}

function handleIncomingData(data) {
  try {
    const parsed = JSON.parse(data);

    if (parsed.type === "message") {
      addMessage("Peer", parsed.content, "received");
    } else if (parsed.type === "file-info") {
      handleFileInfo(parsed);
    } else if (parsed.type === "file-chunk") {
      handleFileChunk(parsed);
    }
  } catch (e) {
    console.log("Received binary data");
  }
}

function addMessage(sender, text, type) {
  const messageList = document.getElementById("messageList");
  const messageItem = document.createElement("div");
  messageItem.className = `message-item ${type}`;
  messageItem.innerHTML = `
        <div class="message-sender">${escapeHtml(sender)}</div>
        <div class="message-text">${escapeHtml(text)}</div>
    `;
  messageList.appendChild(messageItem);
  messageList.scrollTop = messageList.scrollHeight;
}

function addSystemMessage(text) {
  const messageList = document.getElementById("messageList");
  const messageItem = document.createElement("div");
  messageItem.className = "message-item";
  messageItem.style.background = "#FEF3C7";
  messageItem.style.borderLeft = "4px solid #F59E0B";
  messageItem.innerHTML = `
        <div class="message-text" style="color: #92400E;">${escapeHtml(text)}</div>
    `;
  messageList.appendChild(messageItem);
  messageList.scrollTop = messageList.scrollHeight;
}

function handleFiles(files) {
  if (!isConnected || !dataChannel) {
    alert("Please connect to a peer first!");
    return;
  }

  Array.from(files).forEach((file) => {
    sendFile(file);
  });
}

async function sendFile(file) {
  const fileId = Math.random().toString(36).substr(2, 9);
  const chunkSize = 16384;

  addFileToUI(fileId, file.name, file.size, "sending");

  const fileInfo = {
    type: "file-info",
    fileId: fileId,
    name: file.name,
    size: file.size,
    mimeType: file.type,
  };

  dataChannel.send(JSON.stringify(fileInfo));

  const reader = new FileReader();
  let offset = 0;

  const readSlice = () => {
    const slice = file.slice(offset, offset + chunkSize);
    reader.readAsArrayBuffer(slice);
  };

  reader.onload = (e) => {
    const chunkData = {
      type: "file-chunk",
      fileId: fileId,
      offset: offset,
      data: btoa(String.fromCharCode(...new Uint8Array(e.target.result))),
    };

    dataChannel.send(JSON.stringify(chunkData));

    offset += e.target.result.byteLength;

    const progress = (offset / file.size) * 100;
    updateFileProgress(fileId, progress);

    if (offset < file.size) {
      readSlice();
    } else {
      addSystemMessage(`📤 Sent: ${file.name}`);
    }
  };

  readSlice();
}

function handleFileInfo(fileInfo) {
  receivedChunks[fileInfo.fileId] = {
    name: fileInfo.name,
    size: fileInfo.size,
    mimeType: fileInfo.mimeType,
    chunks: [],
    receivedBytes: 0,
  };

  addFileToUI(fileInfo.fileId, fileInfo.name, fileInfo.size, "receiving");
  addSystemMessage(`📥 Receiving: ${fileInfo.name}`);
}

function handleFileChunk(chunkData) {
  const fileData = receivedChunks[chunkData.fileId];

  if (!fileData) return;

  const binary = atob(chunkData.data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  fileData.chunks.push({ offset: chunkData.offset, data: bytes });
  fileData.receivedBytes += bytes.length;

  const progress = (fileData.receivedBytes / fileData.size) * 100;
  updateFileProgress(chunkData.fileId, progress);

  if (fileData.receivedBytes >= fileData.size) {
    completeFileReception(chunkData.fileId);
  }
}

function completeFileReception(fileId) {
  const fileData = receivedChunks[fileId];

  fileData.chunks.sort((a, b) => a.offset - b.offset);

  const totalSize = fileData.chunks.reduce(
    (sum, chunk) => sum + chunk.data.length,
    0,
  );
  const completeFile = new Uint8Array(totalSize);
  let offset = 0;

  fileData.chunks.forEach((chunk) => {
    completeFile.set(chunk.data, offset);
    offset += chunk.data.length;
  });

  const blob = new Blob([completeFile], { type: fileData.mimeType });
  const url = URL.createObjectURL(blob);

  addDownloadButton(fileId, fileData.name, url);
  addSystemMessage(`Received: ${fileData.name}`);

  delete receivedChunks[fileId];
}

function addFileToUI(fileId, fileName, fileSize, status) {
  const fileList = document.getElementById("fileList");
  const fileItem = document.createElement("div");
  fileItem.className = "file-item";
  fileItem.id = `file-${fileId}`;
  fileItem.innerHTML = `
        <div class="file-info">
            <div class="file-name">📎 ${escapeHtml(fileName)}</div>
            <div class="file-meta">${formatFileSize(fileSize)} • ${status}</div>
            <div class="file-progress">
                <div class="file-progress-bar" id="progress-${fileId}" style="width: 0%"></div>
            </div>
        </div>
        <div id="actions-${fileId}"></div>
    `;
  fileList.appendChild(fileItem);
}

function updateFileProgress(fileId, progress) {
  const progressBar = document.getElementById(`progress-${fileId}`);
  if (progressBar) {
    progressBar.style.width = progress + "%";
  }
}

function addDownloadButton(fileId, fileName, url) {
  const actionsDiv = document.getElementById(`actions-${fileId}`);
  if (actionsDiv) {
    actionsDiv.innerHTML = `
            <button class="download-btn" onclick="downloadFile('${url}', '${escapeHtml(fileName)}')">
                ⬇️ Download
            </button>
        `;
  }
}

function downloadFile(url, fileName) {
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function copyCode() {
  const code = document.getElementById("codeDisplay").textContent;
  navigator.clipboard
    .writeText(code)
    .then(() => {
      alert("Code copied to clipboard!");
    })
    .catch(() => {
      alert("Failed to copy. Please copy manually.");
    });
}

function updateStatus(message, type) {
  const badge = document.getElementById("statusBadge");
  const icons = {
    waiting: " Code - 0 :",
    connected: "Code - 1 :",
    error: "Code - WTF ? :",
  };
  badge.textContent = `${icons[type]} ${message}`;
  badge.className = `status-badge ${type}`;
}

function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/* ================= QR CODE HELPERS ================= */

// 1. Generate QR Code
function generateQRCode(text) {
  const container = document.getElementById("qrCodeContainer");
  const qrDiv = document.getElementById("qrcode");

  // Clear previous QR code if any
  qrDiv.innerHTML = "";
  container.style.display = "block";

  // Create new QR Code
  // We use a lower error correction level (L) to keep the code less dense
  new QRCode(qrDiv, {
    text: text,
    width: 256,
    height: 256,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.L,
  });
}

// 2. Scan QR Code
function startQRScanner() {
  document.getElementById("scannerContainer").style.display = "block";

  const html5QrcodeScanner = new Html5QrcodeScanner(
    "reader",
    { fps: 10, qrbox: { width: 250, height: 250 } },
    /* verbose= */ false,
  );

  html5QrcodeScanner.render(
    (decodedText, decodedResult) => {
      // SUCCESS: Code scanned!
      console.log(`Code scanned = ${decodedText}`);

      // Stop scanning
      html5QrcodeScanner.clear();
      document.getElementById("scannerContainer").style.display = "none";

      // Put the scanned code into your logic
      handleScannedCode(decodedText);
    },
    (errorMessage) => {
      // parse error, ignore it.
    },
  );
}

// 3. Handle the Scanned Data
function handleScannedCode(code) {
  // If we are waiting for an Answer (Host Side)
  if (selectedRole === "create") {
    // In your specific flow, processJoinerAnswer(code) directly:
    processJoinerAnswer(code);
  }
  // If we are joining (Joiner Side)
  else {
    // We received the Offer, now process it
    processCreatorOffer(code);
  }
}

// Process the scanned offer for joiner
async function processCreatorOffer(code) {
  try {
    updateStatus("Joining connection...", "waiting");

    const connectionData = JSON.parse(atob(code));

    if (connectionData.keyword !== connectionKeyword) {
      alert(
        "Keyword mismatch! Make sure you entered the same keyword as the creator.",
      );
      document.getElementById("connectBtn").disabled = false;
      return;
    }

    peerConnection = new RTCPeerConnection(rtcConfig);
    setupPeerConnection();

    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(connectionData.sdp),
    );

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    await waitForICEGathering();

    const answerCode = btoa(
      JSON.stringify({ sdp: peerConnection.localDescription }),
    );

    alert("Share this answer code with the creator:\n\n" + answerCode);

    setTimeout(() => {
      const creatorAnswer = prompt(
        "Once the creator sees your answer code above, they will give you their final connection code. Enter it here:",
      );
      if (creatorAnswer) {
        processCreatorAnswer(creatorAnswer);
      }
    }, 1000);
  } catch (error) {
    console.error("Error processing offer:", error);
    updateStatus("Connection failed", "error");
    alert("Invalid connection code");
  }
}

document.addEventListener("DOMContentLoaded", init);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch((err) => {
    console.log("ServiceWorker registration failed:", err);
  });
}
