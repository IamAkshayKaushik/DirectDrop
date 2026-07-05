# Specification: DirectDrop — Next.js Migration

DirectDrop is a peer-to-peer WebRTC file transfer app positioned as a ToffeeShare alternative. This spec covers the migration from the zero-build static site (vanilla JS + Tailwind CDN) to Next.js, preserving all existing behavior.

## 1. Objective

Move to Next.js to unlock the acquisition roadmap (SEO landing pages, comparison pages, blog) while keeping the app itself fully client-side and deployable as static files to a single server or static host.

### Core Goals
- **Feature parity**: Bidirectional transfer, 6-digit PIN connect, share link + QR, file queue with cancel, live chat, transfer log, toasts, reconnect — everything the static app does.
- **Static export**: `next build` emits plain static files (`output: 'export'`). No Node server required in production; `_headers` keeps working on Cloudflare Pages/Netlify.
- **Real Tailwind**: Tailwind 4 via PostCSS replaces the CDN script and the stale prebuilt `styles.css`.
- **npm dependencies**: `peerjs` and QR generation from npm instead of CDN `<script>` tags.
- **XSS-safe by construction**: JSX escaping replaces `innerHTML` rendering of filenames.

## 2. Tech Stack
- **Framework**: Next.js (App Router, static export), React 19, TypeScript 5
- **Styling**: Tailwind CSS 4 (PostCSS plugin) + custom keyframes in `app/globals.css`
- **Libraries**:
  - `peerjs` for WebRTC abstraction and signaling (dynamically imported client-side)
  - `qrcode` for QR generation (data URL → `<img>`)
- **Tests**: `node --test` on pure transfer helpers (`lib/transfer-utils.js` stays plain JS so tests run without a build step)

## 3. Commands
- **Dev server**: `npm run dev`
- **Build (static export)**: `npm run build` → static site in `out/`
- **Type check**: `npx tsc --noEmit`
- **Tests**: `npm test`

### Build-time env vars (all optional, inlined by Next.js)
- `NEXT_PUBLIC_TURN_URL` / `NEXT_PUBLIC_TURN_USERNAME` / `NEXT_PUBLIC_TURN_CREDENTIAL` — TURN relay added to iceServers (required for CG-NAT/symmetric-NAT peers)
- `NEXT_PUBLIC_DONATE_URL` — enables the post-transfer donation prompt and footer link (e.g. Buy Me a Coffee / Ko-fi)

## 4. Project Structure
```
DirectDrop/
├── app/
│   ├── layout.tsx        # Root layout, metadata, manifest link
│   ├── page.tsx          # Main UI (client component)
│   └── globals.css       # Tailwind 4 import + blob/fade/scrollbar styles
├── hooks/
│   └── useDirectDrop.ts  # PeerJS connection + chunked transfer engine
├── lib/
│   └── transfer-utils.js # Pure helpers (chunk math, formatting, PIN)
├── tests/
│   └── transfer-utils.test.js
├── public/               # manifest.json, icon.svg, _headers
├── next.config.ts        # output: 'export'
└── SPEC.md
```

## 5. Architecture

### Connection Flow (unchanged)
1. App loads → engine creates a `Peer` with a random 6-digit PIN as ID
2. Sender shares PIN, link (`?peer=<PIN>`), or QR
3. Receiver opens link (auto-connect) or types the PIN
4. Connected → chat visible, queued files start sending

### Transfer Protocol (unchanged)
Pull-based chunked streaming over one data channel, 64KB chunks, 8-chunk pipeline window:
1. Sender: `bbb.<name>` → `bytes:<n>` → `size:<chunks>`
2. Receiver accepts → `"next"` per chunk → sender sends `{index, data}`
3. `"done"` → receiver assembles Blob, triggers download, replies `"file_received"`
4. `"all_done"` after queue drains. Chat: `{type:"chat", text}`.

### React Split
- `useDirectDrop` owns all imperative engine state in refs (peer, chunk counters, in-flight window) and exposes UI state via React state (connection phase, queue, progress, chat, toasts, incoming prompt).
- `app/page.tsx` is markup only; no DOM manipulation anywhere.

## 6. Testing Strategy
- `npm test` — pure-function tests for chunk math, formatting, PIN validation.
- Manual two-tab test for handshake, bidirectional transfer, queue cancel, reconnect (same checklist as before).

## 7. Boundaries
- **Always do**: Preserve chunked `Blob.slice` streaming — never load entire files into memory to send. Keep the Teal/Slate glassmorphism design.
- **Ask first**: New runtime dependencies. Changing the signaling server configuration.
- **Never do**: `innerHTML` with peer-controlled strings. Browser `alert()`. Server-side file handling of any kind.

## 8. Success Criteria
- [ ] `npm run build` succeeds and `out/` serves the working app from any static file server
- [ ] All static-app features work identically (two-tab manual test passes)
- [ ] Remote filenames render via JSX text (no HTML injection path)
- [ ] `npm test` passes
- [ ] Legacy files (`index.html`, `app.js`, `styles.css`, `transfer-utils.js` at root) removed

## 9. Roadmap (post-migration, from acquisition review)
1. ~~Service-worker streaming downloads~~ — DONE (`public/sw.js` + `lib/stream-download.ts`, Blob fallback kept)
2. Self-hosted PeerServer + TURN (coturn) on the production VPS — reliability on CG-NAT/mobile. TURN client config DONE via `NEXT_PUBLIC_TURN_*`; the server itself still needs provisioning
3. `bufferedAmountLow` backpressure instead of per-chunk acks — throughput
4. Resume from chunk index after reconnect
5. Multi-receiver, folder send, nearby devices
6. SEO landing/comparison pages (Next.js static routes) — the acquisition engine
7. Voice/video calls — PeerJS `MediaConnection` (`peer.call()` + getUserMedia) over the same signaling; UI slot: action buttons in the Live Chat header
