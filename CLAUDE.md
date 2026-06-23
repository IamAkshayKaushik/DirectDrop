# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. Always follow Ponytail Skill and Karpathy-Guidelines Skill while working.

## Project Overview

DirectDrop is a peer-to-peer file transfer web app using WebRTC (via PeerJS). It's a zero-build, zero-dependency static site — no npm, no bundler, no framework. Files transfer directly between browsers using chunked streaming over WebRTC data channels.

## Development

**Run dev server:** `python3 -m http.server 8000` (or `npx serve -l 8000`)

**Lint (optional):** `npx eslint app.js`

**Testing:** Manual multi-tab browser testing — open two tabs, connect via PIN or share link, transfer files both ways. No automated test suite exists.

## Architecture

The entire app is three files:

- **`index.html`** — Layout and structure. Loads Tailwind via CDN, PeerJS (v1.5.2) and QRCode.js (v1.0.0) from CDN. Contains inline drag-and-drop event wiring.
- **`app.js`** — All application logic in a single DOMContentLoaded closure. Handles PeerJS connection setup, chunked file transfer (16KB chunks via `Blob.slice`), file queue management, chat messaging, and transfer analytics (speed/ETA).
- **`styles.css`** — Pre-built Tailwind CSS output plus custom QR code styles. Tailwind utility classes in HTML come from the CDN `<script>` tag, not this file.

### Connection Flow

1. Sender opens the app → `initializePeerConnection()` generates a random 6-digit PIN as the PeerJS ID
2. Sender selects files → share link with `?peer=<PIN>` is displayed along with a QR code
3. Receiver opens the link → `handlePeerOpen()` detects the `peer` query param and connects via `peer.connect(peerIdParam)`
4. Connection established → chat becomes visible, file transfer begins

### Transfer Protocol

Files are sent one at a time from a queue. For each file:
1. Sender sends filename (`bbb.<name>`) then chunk count (`size:<n>`)
2. Receiver sees accept/reject prompt
3. On accept, receiver sends `"next"` → sender sends one chunk as `{index, data: ArrayBuffer}`
4. Receiver stores chunk, sends `"next"` for the next one (pull-based flow)
5. Sender sends `"done"` when complete → receiver assembles blob and triggers download
6. Receiver sends `"file_received"` → sender moves to next file in queue
7. After all files: sender sends `"all_done"`

Chat messages use `{type: "chat", text}` objects on the same data channel.

## Code Style

- Vanilla ES6+ JavaScript, no modules or imports
- Event-driven architecture with PeerJS callbacks
- Tailwind utility classes for styling (via CDN script tag in HTML)
- Teal/Slate color palette with glassmorphism design

## Boundaries

- **Always do:** Preserve chunked `Blob.slice` streaming — never load entire files into memory. Keep the Teal/Slate glassmorphism design palette.
- **Ask first:** Adding new external JS dependencies. Changing the PeerJS signaling server config.
- **Never do:** Load entire files into memory for transfer. Use browser `alert()` popups.
