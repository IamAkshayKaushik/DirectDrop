# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. Always follow Ponytail Skill and Karpathy-Guidelines Skill while working.

## Project Overview

DirectDrop is a peer-to-peer file transfer web app using WebRTC (via PeerJS). It's a Next.js app (App Router, static export) — fully client-side, no API routes, no server rendering in production. Files transfer directly between browsers using chunked streaming over WebRTC data channels.

## Development

**Dev server:** `npm run dev`

**Build (static export):** `npm run build` → static site in `out/`, servable from any static host

**Type check:** `npx tsc --noEmit`

**Tests:** `npm test` (node --test on pure helpers)

**Manual testing:** Open two tabs, connect via PIN or share link, transfer files both ways.

## Architecture

- **`app/page.tsx`** — Main UI, a single client component. Markup only; all logic comes from the hook.
- **`hooks/useDirectDrop.ts`** — The engine. PeerJS connection lifecycle, chunked file transfer (64KB chunks, 8-chunk pipeline window via `Blob.slice`), file queue, chat, reconnect with backoff, toasts. Imperative transfer state lives in refs; UI state in React state.
- **`lib/transfer-utils.js`** — Pure helpers (chunk math, size/ETA formatting, PIN generation/validation). Plain JS so `node --test` runs it without a build step.
- **`app/globals.css`** — Tailwind 4 import plus custom keyframes (blob, fade-in) and scrollbar styles.
- **`public/`** — `manifest.json` (PWA), `icon.svg`, `_headers` (Cloudflare Pages/Netlify headers).

### Connection Flow

1. App loads → `useDirectDrop` creates a PeerJS `Peer` with a random 6-digit PIN as its ID
2. Sender shares the PIN, the `?peer=<PIN>` link, or the QR code
3. Receiver opens the link (auto-connect) or types the PIN
4. Connection established → chat becomes visible, queued files start sending

### Transfer Protocol

Files are sent one at a time from a queue. For each file:
1. Sender sends filename (`bbb.<name>`), byte size (`bytes:<n>`), then chunk count (`size:<n>`)
2. Receiver sees accept/reject prompt
3. On accept, receiver sends `"next"` per chunk (pull-based); sender keeps up to 8 chunks in flight as `{index, data: ArrayBuffer}`
4. Sender sends `"done"` → receiver assembles blob and triggers download
5. Receiver sends `"file_received"` → sender moves to next file; `"all_done"` after the queue drains

Chat messages use `{type: "chat", text}` objects on the same data channel.

## Code Style

- TypeScript for app/hook code; `lib/transfer-utils.js` stays plain JS (test-runner compatibility)
- Tailwind utility classes; Teal/Slate palette with glassmorphism design
- No DOM manipulation — state drives the UI

## Boundaries

- **Always do:** Preserve chunked `Blob.slice` streaming — never load entire files into memory to send. Keep the Teal/Slate glassmorphism design palette.
- **Ask first:** Adding new runtime dependencies. Changing the PeerJS signaling server config.
- **Never do:** Render peer-controlled strings with `dangerouslySetInnerHTML`. Use browser `alert()` popups. Add server-side file handling.
