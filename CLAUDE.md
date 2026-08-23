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
- **`app/globals.css`** — Tailwind 4 import plus custom keyframes (fade-in, confetti) and scrollbar styles. Holds the full design-system token map and the `@theme` block that exposes them as Tailwind colors.
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
- Tailwind utility classes; orange-red-on-near-black design system (inspired by rig.ai) — flat surfaces, hairline borders, semantic color tokens (`bg-surface`, `text-text-muted`, `border-hairline`, `text-interactive`, etc.) defined in `app/globals.css`. Dark is the default theme; light is a first-class opt-in via the existing toggle.
- Inter (sans) + JetBrains Mono (code) via Google Fonts. Display type is Inter 700–800 with tight tracking (-0.03em); eyebrow labels are uppercase 12px in `--interactive` with 0.18em tracking.
- No DOM manipulation — state drives the UI

## Design system

The full brand spec lives in `/DirectDrop Design System/` (read `README.md` for philosophy, then `tokens/`, `guidelines/`, `components/`, `ui_kits/`). It is the source of truth for visual decisions; `app/globals.css` is the implementation. Three rules keep them in sync:

1. **Never invent new color, type, or spacing values.** Use the existing semantic tokens (`bg-interactive`, `text-text-muted`, `border-hairline-strong`, `font-sans`, `font-mono`, etc.). New tokens go in both the design system tokens and the app's `:root` / `.dark` blocks.
2. **Never rename a token without updating both files.** The class names (`bg-surface`, `text-interactive`, etc.) and the CSS variable names (`--surface`, `--interactive`) are public contracts. Renames are a design-system change, not a refactor.
3. **Eyebrows are always in `--interactive`, always uppercase, always tracked.** That's the rig.ai rhythm that gives the brand its confidence.

## Boundaries

- **Always do:** Preserve chunked `Blob.slice` streaming — never load entire files into memory to send. Keep the orange-red flat design system (hairline borders, no translucency/blur on content containers — glass/blur is reserved for fixed chrome over scrolling content, like the full-page drag overlay). The single warm radial wash on the hero is the only ambient layer.
- **Ask first:** Adding new runtime dependencies. Changing the PeerJS signaling server config. Adding new design-system tokens (extend the existing scale, don't fork).
- **Never do:** Render peer-controlled strings with `dangerouslySetInnerHTML`. Use browser `alert()` popups. Add server-side file handling. Add a second accent color — the orange-red is the only signal color.
