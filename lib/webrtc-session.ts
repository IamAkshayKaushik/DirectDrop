/**
 * One room, two browsers. The worker assigns host (first socket) and guest.
 * SDP and ICE go through the room. File bytes go through the data channel.
 */

export type IceServer = { urls: string | string[]; username?: string; credential?: string };

export type Link = {
  open: boolean;
  send: (data: unknown) => void;
  close: () => void;
};

export type SessionHandlers = {
  onLink: (link: Link, role: "host" | "guest") => void;
  onSafetyCode: (code: string) => void;
  onClose: () => void;
  onFail: (message: string) => void;
};

type Signal =
  | { type: "welcome"; role: "host" | "guest"; iceServers: IceServer[] }
  | { type: "offer"; sdp: string }
  | { type: "answer"; sdp: string }
  | { type: "ice"; candidate: RTCIceCandidateInit | null };

/** Local DTLS fingerprint, last 8 hex digits. Both screens must show the same code. */
export function safetyCode(sdp: string | null | undefined): string {
  const match = sdp?.match(/a=fingerprint:\S+\s+([0-9A-Fa-f:]+)/);
  if (!match) return "";
  const hex = match[1].replace(/:/g, "").slice(-8).toUpperCase();
  return `${hex.slice(0, 4)} ${hex.slice(4)}`;
}

export function encodeChannel(data: unknown): string | ArrayBuffer {
  if (typeof data === "string") return data;
  if (data && typeof data === "object" && "index" in data && "data" in data) {
    const record = data as { index: number; data: ArrayBuffer };
    const bytes = new Uint8Array(record.data);
    const frame = new Uint8Array(4 + bytes.byteLength);
    new DataView(frame.buffer).setUint32(0, record.index);
    frame.set(bytes, 4);
    return frame.buffer;
  }
  return JSON.stringify(data);
}

export function decodeChannel(data: string | ArrayBuffer): unknown {
  if (typeof data === "string") {
    if (data.startsWith("{")) {
      try {
        return JSON.parse(data);
      } catch {
        return data;
      }
    }
    return data;
  }
  const view = new DataView(data);
  return { index: view.getUint32(0), data: data.slice(4) };
}

export function startSession(roomId: string, handlers: SessionHandlers) {
  const wsUrl = `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/room/${roomId}`;
  const ws = new WebSocket(wsUrl);
  let pc: RTCPeerConnection | null = null;
  let closed = false;
  let opened = false;
  let failed = false;
  let onData: ((data: unknown) => void) | null = null;

  const fail = (message: string) => {
    if (closed || opened || failed) return;
    failed = true;
    handlers.onFail(message);
  };

  let remoteReady = false;
  const iceQueue: RTCIceCandidateInit[] = [];

  const addIce = (candidate: RTCIceCandidateInit) => {
    if (!pc || !remoteReady) {
      iceQueue.push(candidate);
      return;
    }
    pc.addIceCandidate(candidate).catch(() => {});
  };

  const markRemote = () => {
    remoteReady = true;
    for (const candidate of iceQueue) pc?.addIceCandidate(candidate).catch(() => {});
    iceQueue.length = 0;
  };

  const sendSignal = (message: Exclude<Signal, { type: "welcome" }>) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  };

  const shutdown = () => {
    if (closed) return;
    closed = true;
    pc?.close();
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close();
  };

  const wireChannel = (channel: RTCDataChannel, role: "host" | "guest") => {
    channel.binaryType = "arraybuffer";
    const link: Link = {
      open: false,
      send: (data) => {
        if (channel.readyState !== "open") return;
        const payload = encodeChannel(data);
        if (typeof payload === "string") channel.send(payload);
        else channel.send(payload);
      },
      close: () => channel.close(),
    };
    channel.onmessage = (event) => onData?.(decodeChannel(event.data));
    channel.onopen = () => {
      link.open = true;
      opened = true;
      const sdp = role === "host" ? pc?.localDescription?.sdp : pc?.remoteDescription?.sdp;
      handlers.onSafetyCode(safetyCode(sdp));
      handlers.onLink(link, role);
    };
    channel.onclose = () => {
      link.open = false;
      if (!closed) handlers.onClose();
    };
  };

  const openPeer = (role: "host" | "guest", iceServers: IceServer[]) => {
    pc = new RTCPeerConnection({ iceServers });
    pc.onicecandidate = (event) => {
      sendSignal({ type: "ice", candidate: event.candidate?.toJSON() ?? null });
    };
    pc.onconnectionstatechange = () => {
      if (pc?.connectionState === "failed") fail("Connection failed on this network.");
    };
    if (role === "host") {
      wireChannel(pc.createDataChannel("files"), role);
      pc.createOffer()
        .then((offer) => pc!.setLocalDescription(offer))
        .then(() => sendSignal({ type: "offer", sdp: pc!.localDescription!.sdp }))
        .catch(() => fail("Could not start the connection."));
    } else {
      pc.ondatachannel = (event) => wireChannel(event.channel, role);
    }
  };

  ws.onmessage = (event) => {
    let message: Signal;
    try {
      message = JSON.parse(String(event.data)) as Signal;
    } catch {
      return;
    }
    if (message.type === "welcome") {
      openPeer(message.role, message.iceServers);
      return;
    }
    if (!pc) return;
    if (message.type === "offer") {
      pc.setRemoteDescription({ type: "offer", sdp: message.sdp })
        .then(() => {
          markRemote();
          return pc!.createAnswer();
        })
        .then((answer) => pc!.setLocalDescription(answer))
        .then(() => sendSignal({ type: "answer", sdp: pc!.localDescription!.sdp }))
        .catch(() => fail("Could not answer the connection."));
    } else if (message.type === "answer") {
      pc.setRemoteDescription({ type: "answer", sdp: message.sdp })
        .then(markRemote)
        .catch(() => fail("Could not finish the connection."));
    } else if (message.type === "ice" && message.candidate) {
      addIce(message.candidate);
    }
  };

  ws.onerror = () => fail("Signaling room is unavailable. Connections need the Cloudflare worker.");
  ws.onclose = () => {
    if (!opened && !closed) fail("Could not join the room. It may be offline or full.");
  };

  return {
    close: shutdown,
    set onData(handler: (data: unknown) => void) {
      onData = handler;
    },
  };
}
