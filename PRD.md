# DirectDrop — Product Requirements Document

**Product:** DirectDrop  
**Status:** Shipped core transfer; DirectDrop wedge next  
**Primary wedge:** Receiver-first DirectDrop for iPhone ↔ Windows / Android ↔ Mac  
**North star (90 days):** Organic growth — recipients become senders via DirectDrop requests  
**Competitors:** ToffeeShare (browser P2P), Blip (native cross-platform)

---

## 1. Problem Statement

How might we make DirectDrop the default way a cross-platform pair (especially iPhone ↔ Windows or Android ↔ Mac) moves original-quality files—without an app, account, or cloud upload—such that every invite turns the contributor into the next request creator?

AirDrop and Quick Share fail across ecosystems. Cloud tools (Drive, Dropbox File Requests, WeTransfer) require accounts, size quotas, or uploading private files to someone else's server. Browser P2P tools exist, but most present a symmetric “room” and compete on commodity claims (no size limit, encrypted, no account). DirectDrop already has the transfer engine; it lacks a sharp, ownable job and a built-in acquisition loop.

---

## 2. Product Vision

**One sentence:** Open DirectDrop on the device that should receive, share a QR or link, and anyone can send original files straight to you—any phone or computer, no app.

**Category position:** Live, receiver-first file handoff — file requests without cloud storage, accounts, app installs, or size quotas.

**Not:** Another generic “P2P file sharing” clone of ToffeeShare. Not a Blip-style native suite. Not an async cloud inbox.

---

## 3. Target User & Jobs

### Primary user (first wedge)

Cross-platform pairs who need to move files **now** while both people (or both devices) are available:

- iPhone → Windows PC (photos, videos, PDFs)
- Android → Mac
- Phone ↔ laptop when AirDrop / Quick Share do not apply

### Jobs to be done

| Job | Priority |
|-----|----------|
| Get original photos/files from this phone onto that computer without installing anything | P0 |
| Collect files from one other person via a single shareable link/QR | P0 |
| Send large files privately without uploading to cloud storage | P1 |
| Chat briefly during a live transfer | P2 |

### Success looks like

- A non-technical contributor completes a send after scanning a QR, with no coaching.
- After success, that contributor can explain and start **Receive files** on their own device.
- Measured loop: request open → transfer complete → own DirectDrop started → child request completed.

---

## 4. Current Product (shipped)

DirectDrop is a fully client-side Next.js app (static export) using WebRTC via PeerJS. Files stream browser-to-browser in 64KB chunks with an 8-chunk pipeline; receives can stream to disk via service worker.

### Capabilities today

- 6-digit PIN, share link (`?peer=<PIN>`), QR connect
- Bidirectional transfer, queue with cancel, accept/reject, live chat
- Progress, ETA, transfer log, reconnect with backoff, toasts
- Streaming download (`public/sw.js` + `lib/stream-download.ts`), Blob fallback
- Optional TURN via `NEXT_PUBLIC_TURN_*` (client wired; production relay must be provisioned)
- Comparison page `/vs/toffeeshare`, FAQ/HowTo SEO, PWA manifest

### Core architecture (do not break)

1. App loads → PeerJS peer with random 6-digit PIN as ID  
2. Share PIN / link / QR → peer connects  
3. Sender: `bbb.<name>` → `bytes:<n>` → `size:<chunks>`  
4. Receiver accepts → pull-based `"next"` → `{index, data}` chunks  
5. `"done"` → save → `"file_received"`; `"all_done"` when queue drains  
6. Chat: `{type: "chat", text}` on the same data channel  

Engine: [`hooks/useDirectDrop.ts`](hooks/useDirectDrop.ts). UI markup: [`app/page.tsx`](app/page.tsx). Helpers: [`lib/transfer-utils.js`](lib/transfer-utils.js).

---

## 5. Recommended Direction — DirectDrop

### What it is

One mode: **Receive files**.

1. On the **receiving** device, user taps **Receive files**.  
2. App shows PIN / link / QR with copy: *Scan or share this link to send files to this device.*  
3. Contributor opens `?peer=<PIN>&mode=drop` and sees a focused **Choose files to send** screen (not the full two-sided dashboard).  
4. Receiver must still **Accept** before download (no silent auto-download).  
5. After the contributor’s queue completes: primary CTA **Create your own DirectDrop**; donation remains secondary.

### Viral loop

```
Need files → share DirectDrop link → contributor sends → contributor sees value
  → contributor creates own DirectDrop → next invite
```

### Why this (vs alternatives)

| Direction | Verdict |
|-----------|---------|
| DirectDrop (receiver-first request) | **Build** — highest acquisition leverage; reuses existing bidirectional session |
| Event Drop (many → one QR) | Later — needs multi-peer rooms |
| Remember this device | Retention, not acquisition; crowded |
| OS share-target PWA | Retention; weak on iOS |
| Resume + checksums | Reliability moat; not the invite loop |
| Clipboard sync | Dilutes file-handoff promise |

### Differentiation claim

**File requests without cloud upload, accounts, app installs, or size quotas** — for the live, same-moment cross-platform handoff Dropbox-style requests solve asynchronously (and with storage/quota cost).

---

## 6. MVP Scope (DirectDrop)

### In

- `?mode=drop` client-side mode marker; no new protocol or backend  
- **Receive files** entry on the host/receiving device; retuned share-panel copy  
- Focused contributor UI: connection status, dominant file picker, queue/progress, privacy line  
- Hide on contributor screen: PIN entry, QR, FAQ, chat-first empty panel, donate-first moment  
- Keep accept/reject before download  
- Post-success: **Create your own DirectDrop** CTA; donate secondary  
- Preserve existing generic bidirectional session for non-drop users  
- TURN/reliability baseline before driving acquisition traffic  

### Out (Not Doing)

- Persistent / async inbox or offline delivery (server storage)  
- Multi-contributor event rooms  
- Accounts, contacts, remembered devices, native apps  
- Folders, clipboard, voice/video, AI, referral rewards  
- Auto-accept downloads  

### Primary files for DirectDrop

- [`app/page.tsx`](app/page.tsx) — mode UI, copy, CTA  
- [`hooks/useDirectDrop.ts`](hooks/useDirectDrop.ts) — parse/preserve drop mode; minimal new state  
- [`lib/site.ts`](lib/site.ts) — homepage promise **after** the flow proves itself  

---

## 7. Assumptions & Kill Criteria

### Must be true

- Users often transfer while both ends are online. If they demand an async inbox, DirectDrop is the wrong product.  
- Production connections succeed on mobile networks (TURN provisioned and verified).  

### Should be true

- Receiver-first labeling reduces confusion vs the symmetric dashboard.  
- Contributors understand the post-success CTA without accounts or incentives.  

### Kill the growth thesis

After **100** qualified DirectDrop link opens:

- &lt; **10%** start creating their own DirectDrop, **or**  
- &lt; **3%** complete a child request  

→ Stop treating DirectDrop as the acquisition engine. The mode may still help usability; do not build a suite around a failed loop.

---

## 8. Success Metrics

Track **funnel events only** — never PINs, filenames, chat, or file contents:

| Event | Meaning |
|-------|---------|
| `request_created` | Receiver entered DirectDrop and shared |
| `request_opened` | Contributor opened drop link |
| `file_selected` | Contributor chose files |
| `transfer_completed` | Handoff finished |
| `own_request_clicked` | Post-success CTA |
| `child_request_completed` | New DirectDrop produced a completed transfer |

**Validation sequence**

1. Reliability: cellular iPhone ↔ Windows transfer works with TURN.  
2. Observe 10 no-coaching sessions (existing or early drop UI); record go/no-go.  
3. Ship MVP DirectDrop; verify iPhone↔Windows, Android↔Mac (happy path, reject, disconnect).  
4. 100-open experiment vs matched generic `?peer=` cohort.  

---

## 9. Technical Constraints (standing)

### Stack

- Next.js App Router, `output: 'export'`, React 19, TypeScript, Tailwind 4  
- `peerjs`, `qrcode`; pure helpers in `lib/transfer-utils.js` tested with `node --test`  

### Always

- Chunked `Blob.slice` streaming — never load entire files into memory to send  
- Orange-red flat design system (hairline borders; no inventing tokens; no second accent)  
- State-driven UI; no DOM hacks; JSX text for peer-controlled strings  

### Ask first

- New runtime dependencies  
- PeerJS / TURN signaling server changes  
- New design-system tokens  
- Analytics vendor (none in repo today)  

### Never

- `dangerouslySetInnerHTML` with peer-controlled strings  
- Browser `alert()`  
- Server-side file handling  
- Breaking static export for core transfer  

### Commands

- Dev: `npm run dev`  
- Build: `npm run build` → `out/`  
- Typecheck: `npx tsc --noEmit`  
- Tests: `npm test`  

### Build-time env (optional)

- `NEXT_PUBLIC_TURN_URL` / `NEXT_PUBLIC_TURN_USERNAME` / `NEXT_PUBLIC_TURN_CREDENTIAL`  
- `NEXT_PUBLIC_DONATE_URL`  
- `NEXT_PUBLIC_SITE_URL` (default `https://directdrop.app`)  

---

## 10. Implementation Phases (summary)

Detailed task breakdown lives in the DirectDrop implementation plan. High level:

| Phase | Goal |
|-------|------|
| 1 | Reliability baseline (TURN, reconnect clarity, iOS save pre-flight) |
| 2 | Manual validation of the live job (go/no-go) |
| 3 | DirectDrop mode: protocol marker → receiver entry → contributor UI → success CTA |
| 4 | Cross-platform verification + 100-open acquisition experiment |

---

## 11. Open Questions

1. Analytics: Plausible / Umami / PostHog / none? (ask before adding a dependency)  
2. TURN: Metered, Cloudflare Realtime, or self-hosted coturn?  
3. Homepage: lead with **Receive files** only, or keep send + receive equally visible? (decide after Phase 2 observation)  

---

## 12. 90-Day Outcome

Users should describe DirectDrop as:

> “Open it on the device that should receive, share the QR, and anyone can send original files straight to you.”

If they do that **and** create the next DirectDrop, deepen the wedge (resume, then optionally Event Drop). If they do not, stop—do not expand into a feature suite around a failed loop.
