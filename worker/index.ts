/**
 * Cloudflare can host this site and can mint TURN credentials.
 * It cannot be the TURN relay. UDP/TCP relay is Cloudflare Realtime
 * (turn.cloudflare.com). This worker only mints short-lived iceServers
 * and forwards SDP/ICE between the two browsers in a room.
 * File bytes stay on the WebRTC data channel.
 */

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  ROOM: {
    idFromName: (name: string) => unknown;
    get: (id: unknown) => { fetch: (request: Request) => Promise<Response> };
  };
  TURN_KEY_ID?: string;
  TURN_KEY_API_TOKEN?: string;
}

type IceServer = { urls: string | string[]; username?: string; credential?: string };

const ROOM_ID = /^[A-Za-z0-9_-]{22}$/;
const ICE_TTL_SECONDS = 3600;
const STUN_ONLY: IceServer[] = [{ urls: "stun:stun.cloudflare.com:3478" }];

declare const WebSocketPair: {
  new (): { 0: WebSocket; 1: WebSocket };
};

async function mintIceServers(env: Env): Promise<IceServer[]> {
  if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) return STUN_ONLY;

  const response = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl: ICE_TTL_SECONDS }),
    },
  );

  if (!response.ok) return STUN_ONLY;

  const body = (await response.json()) as { iceServers?: IceServer[] };
  return body.iceServers?.length ? body.iceServers : STUN_ONLY;
}

export class Room {
  private host: WebSocket | null = null;
  private guest: WebSocket | null = null;
  private pendingForGuest: string[] = [];

  constructor(_state: unknown, _env: Env) {}

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    let role: "host" | "guest";
    if (!this.host) {
      this.host = server;
      role = "host";
    } else if (!this.guest) {
      this.guest = server;
      role = "guest";
    } else {
      server.close(1013, "room full");
      return new Response(null, { status: 101, webSocket: client });
    }

    let ice: IceServer[] = STUN_ONLY;
    try {
      ice = JSON.parse(request.headers.get("x-dd-ice") || "") as IceServer[];
    } catch {
      ice = STUN_ONLY;
    }

    server.send(JSON.stringify({ type: "welcome", role, iceServers: ice }));
    if (role === "guest") {
      for (const message of this.pendingForGuest) server.send(message);
      this.pendingForGuest = [];
    }

    const relay = (event: MessageEvent) => {
      const text = typeof event.data === "string" ? event.data : "";
      if (text.length === 0 || text.length > 100_000) return;
      let type = "";
      try {
        type = (JSON.parse(text) as { type?: string }).type || "";
      } catch {
        return;
      }
      if (type !== "offer" && type !== "answer" && type !== "ice") return;
      const other = role === "host" ? this.guest : this.host;
      if (other) other.send(text);
      else if (role === "host" && this.pendingForGuest.length < 64) this.pendingForGuest.push(text);
    };

    const release = () => {
      if (this.host === server) {
        this.host = null;
        this.pendingForGuest = [];
      }
      if (this.guest === server) this.guest = null;
    };

    server.addEventListener("message", relay);
    server.addEventListener("close", release);
    server.addEventListener("error", release);

    return new Response(null, { status: 101, webSocket: client });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const roomMatch = url.pathname.match(/^\/room\/([^/]+)$/);
    if (!roomMatch) return env.ASSETS.fetch(request);

    if (!ROOM_ID.test(roomMatch[1])) {
      return new Response("Unknown room", { status: 404 });
    }

    // Credentials are minted only for a room join, never from a public GET.
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const ice = await mintIceServers(env);
    const headers = new Headers(request.headers);
    headers.set("x-dd-ice", JSON.stringify(ice));
    const id = env.ROOM.idFromName(roomMatch[1]);
    return env.ROOM.get(id).fetch(new Request(request, { headers }));
  },
};
